"""
File upload transcription with real-time streaming.
Pipeline: STT -> Diarization -> Sentiment -> Stream -> Summary -> Done
"""
import os
import shutil
import asyncio
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from db.database import get_db, AsyncSessionLocal
from db.models import Meeting, Segment, Speaker, MeetingSummary, ActionItem
from services.transcriber import transcribe_file
from services.diarizer import diarize, merge_transcript_with_diarization
from services.sentiment import batch_analyze_sentiment, compute_speaker_sentiment_stats
from services.summarizer import summarize_meeting, extract_speaker_names
from services.audio_stats import compute_speaker_talk_stats
from services.ws_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload/{meeting_id}")
async def transcribe_upload(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    ext = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    save_path = os.path.join(UPLOAD_DIR, f"{meeting_id}{ext}")
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    meeting.audio_path = save_path
    meeting.status = "uploaded"
    await db.commit()

    return {"status": "uploaded", "meeting_id": meeting_id, "file": file.filename}

@router.post("/process/{meeting_id}")
async def process_audio(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    if not meeting.audio_path:
        raise HTTPException(400, "Audio file not uploaded for this meeting")

    meeting.status = "processing"
    await db.commit()

    background_tasks.add_task(_process_file, meeting_id, meeting.audio_path)
    return {"status": "processing", "meeting_id": meeting_id}


@router.get("/status/{meeting_id}")
async def get_status(meeting_id: str, db: AsyncSession = Depends(get_db)):
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    return {"meeting_id": meeting_id, "status": meeting.status, "word_count": meeting.word_count}


async def _broadcast_status(meeting_id: str, stage: str, message: str):
    await manager.broadcast(meeting_id, {
        "type": "status", "stage": stage, "message": message
    })


async def _process_file(meeting_id: str, audio_path: str):
    """
    Streaming pipeline — each Whisper segment is broadcast to the frontend
    immediately as it is produced, not after the whole file is done.

    Pipeline:
      1. Diarize full audio (fast, energy-based, ~seconds)
      2. Stream Whisper segments one-by-one
         └─ per segment: assign speaker → sentiment → save DB → broadcast
      3. Summarise + finalize
    """
    try:
        # ── STEP 1: Diarization (needs full file, but very fast) ───────────
        await _broadcast_status(meeting_id, "diarizing", "Identifying speakers…")
        logger.info(f"[{meeting_id}] Diarizing…")
        turns = diarize(audio_path)
        logger.info(f"[{meeting_id}] Diarization done — {len(turns)} turns")

        # Helper: assign speaker to a segment via max-overlap matching
        def assign_speaker(start: float, end: float) -> str | None:
            if end <= start:
                return None
            best_spk, best_overlap = None, 0.0
            for turn in turns:
                overlap = min(end, turn["end"]) - max(start, turn["start"])
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_spk = turn["speaker"]
            seg_dur = end - start
            return best_spk if best_spk and (best_overlap / seg_dur) > 0.2 else None

        # ── STEP 2: Stream Whisper segments ───────────────────────────────
        await _broadcast_status(meeting_id, "transcribing", "Transcribing audio — segments will appear in real-time…")
        logger.info(f"[{meeting_id}] Streaming Whisper transcription…")

        all_segments: list = []          # accumulated for summary / speaker stats
        speaker_sentiment_map: dict = {}
        duration = 0.0

        # transcribe_file_generator yields segments one at a time from faster-whisper
        loop = asyncio.get_event_loop()
        seg_gen = await loop.run_in_executor(None, lambda: list(__import__('itertools').islice(
            __import__('builtins').iter([]),  # just to get the generator started
            0
        )))
        # Use the proper generator — wrap in thread so async loop stays free
        from services.transcriber import transcribe_file_generator
        from services.sentiment import analyze_sentiment

        # Run the (blocking) generator in a thread pool, yielding results to async
        import concurrent.futures
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)

        def _gen_segments():
            """Blocking generator called in executor — produces dicts."""
            for seg in transcribe_file_generator(audio_path):
                yield seg

        # We need to iterate an async-friendly version
        # Use a queue: producer thread feeds it, consumer (this coroutine) reads it
        import queue as _queue
        seg_queue: _queue.Queue = _queue.Queue()
        _SENTINEL = object()

        def _producer():
            try:
                for seg in transcribe_file_generator(audio_path):
                    seg_queue.put(seg)
            finally:
                seg_queue.put(_SENTINEL)

        producer_future = loop.run_in_executor(executor, _producer)

        async with AsyncSessionLocal() as db:
            total_duration = None
            while True:
                # Poll queue without blocking the event loop
                try:
                    seg = seg_queue.get_nowait()
                except _queue.Empty:
                    await asyncio.sleep(0.05)
                    continue

                if seg is _SENTINEL:
                    break
                    
                if seg.get("type") == "info":
                    total_duration = seg.get("duration")
                    continue

                speaker = assign_speaker(seg["start"], seg["end"])
                sent    = analyze_sentiment(seg["text"])

                # Track duration
                if seg["end"] > duration:
                    duration = seg["end"]

                # Accumulate for post-processing
                merged_seg = {**seg, "speaker": speaker}
                all_segments.append(merged_seg)

                spk_key = speaker or "Unknown"
                speaker_sentiment_map.setdefault(spk_key, []).append(sent)

                # Save to DB
                segment = Segment(
                    meeting_id=meeting_id,
                    speaker_label=speaker,
                    speaker_name=None,
                    start_time=seg["start"],
                    end_time=seg["end"],
                    text=seg["text"],
                    sentiment=sent["tag"],
                    sentiment_score=sent["score"],
                    confidence=seg.get("confidence"),
                )
                db.add(segment)
                await db.flush()

                # Broadcast immediately — frontend sees it right away
                await manager.broadcast(meeting_id, {
                    "type":            "segment",
                    "meeting_id":      meeting_id,
                    "segment_id":      segment.id,
                    "speaker_label":   speaker,
                    "speaker_name":    None,
                    "start_time":      round(seg["start"], 2),
                    "end_time":        round(seg["end"],   2),
                    "text":            seg["text"],
                    "sentiment":       sent["tag"],
                    "sentiment_score": round(sent["score"], 3),
                    "is_partial":      False,
                    "total":           total_duration,
                    "progress":        round((seg["end"] / total_duration) * 100) if total_duration else 0,
                })

                await asyncio.sleep(0)  # yield event loop

            await db.commit()
            logger.info(f"[{meeting_id}] Streaming done — {len(all_segments)} segments")

        await producer_future   # ensure thread is cleaned up
        executor.shutdown(wait=False)

        # ── STEP 3: Speaker statistics ─────────────────────────────────────
        await _broadcast_status(meeting_id, "analyzing", "Computing speaker statistics…")

        # Build transcript text for name extraction + summary
        full_transcript = ""
        for seg in all_segments:
            spk  = seg.get("speaker") or "Unknown"
            mins = int(seg["start"] // 60)
            secs = int(seg["start"] % 60)
            full_transcript += f"[{mins:02d}:{secs:02d}] [{spk}]: {seg['text']}\n"

        logger.info(f"[{meeting_id}] Extracting speaker names…")
        extracted_names = await extract_speaker_names(full_transcript)

        async with AsyncSessionLocal() as db:
            speaker_talk = compute_speaker_talk_stats(all_segments, duration)
            for label, stats in speaker_talk.items():
                sent_stats = compute_speaker_sentiment_stats(
                    speaker_sentiment_map.get(label, [])
                )
                db.add(Speaker(
                    meeting_id=meeting_id,
                    label=label,
                    name=extracted_names.get(label),
                    talk_time_seconds=stats["talk_time_seconds"],
                    talk_percentage=stats["talk_percentage"],
                    word_count=stats["word_count"],
                    avg_wpm=stats["avg_wpm"],
                    turn_count=stats["turn_count"],
                    avg_sentiment_score=sent_stats["avg_score"],
                    dominant_sentiment=sent_stats["dominant"],
                    positive_pct=sent_stats["positive_pct"],
                    negative_pct=sent_stats["negative_pct"],
                    neutral_pct=sent_stats["neutral_pct"],
                ))
            await db.commit()
            logger.info(f"[{meeting_id}] Speakers saved")

        # ── STEP 4: AI Summary ─────────────────────────────────────────────
        await _broadcast_status(meeting_id, "summarizing", "Generating AI summary with Llama3…")
        logger.info(f"[{meeting_id}] Summarising {len(full_transcript)} chars…")
        summary_data = await summarize_meeting(transcript=full_transcript, speaker_names=extracted_names)
        logger.info(f"[{meeting_id}] Summary done — overview: {len(summary_data.get('overview',''))} chars")

        async with AsyncSessionLocal() as db:
            db.add(MeetingSummary(
                meeting_id=meeting_id,
                short_topic=summary_data.get("short_topic"),
                overview=summary_data["overview"],
                key_points=summary_data["key_points"],
                topics=summary_data["topics"],
                decisions=summary_data["decisions"],
            ))
            for ai in summary_data.get("action_items", []):
                db.add(ActionItem(
                    meeting_id=meeting_id,
                    task=ai["task"],
                    owner=ai.get("owner"),
                    deadline=ai.get("deadline"),
                    priority=ai.get("priority", "medium"),
                ))
            await db.commit()

        # ── STEP 5: Finalize meeting ───────────────────────────────────────
        full_text = " ".join(s["text"] for s in all_segments)
        speaker_talk = compute_speaker_talk_stats(all_segments, duration)

        async with AsyncSessionLocal() as db:
            meeting = await db.get(Meeting, meeting_id)
            if meeting is None:
                result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
                meeting = result.scalar_one_or_none()

            if meeting:
                meeting.status            = "done"
                meeting.duration_seconds  = duration
                meeting.word_count        = len(full_text.split())
                meeting.participant_count = len(speaker_talk)
                meeting.ended_at          = datetime.utcnow()
                await db.commit()
                logger.info(f"[{meeting_id}] Meeting finalised ✓")
            else:
                logger.error(f"[{meeting_id}] Could not find meeting to finalise!")

        await manager.broadcast(meeting_id, {
            "type": "done", "meeting_id": meeting_id,
            "message": "Processing complete",
        })
        logger.info(f"[{meeting_id}] ✓ Streaming pipeline complete")

    except Exception as e:
        logger.error(f"[{meeting_id}] Pipeline failed: {e}", exc_info=True)
        try:
            await manager.broadcast(meeting_id, {"type": "error", "message": str(e)})
            async with AsyncSessionLocal() as db:
                meeting = await db.get(Meeting, meeting_id)
                if meeting:
                    meeting.status = "error"
                    await db.commit()
        except Exception as inner:
            logger.error(f"[{meeting_id}] Cleanup also failed: {inner}")