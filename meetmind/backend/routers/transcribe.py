"""
File upload transcription endpoint.
Full pipeline: STT → diarization → sentiment → summary → DB save.
"""
import os
import shutil
import tempfile
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from db.database import get_db
from db.models import Meeting, Segment, Speaker, MeetingSummary, ActionItem
from models.schemas import SummaryOut
from services.transcriber import transcribe_file
from services.diarizer import diarize, merge_transcript_with_diarization
from services.sentiment import analyze_sentiment, batch_analyze_sentiment, compute_speaker_sentiment_stats
from services.summarizer import summarize_meeting
from services.audio_stats import analyze_audio_file, compute_speaker_talk_stats, detect_topics, extract_keywords

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
    """Upload audio/video file and process it fully in the background."""
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    # Save file
    ext = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    save_path = os.path.join(UPLOAD_DIR, f"{meeting_id}{ext}")
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    meeting.audio_path = save_path
    meeting.status = "processing"
    await db.commit()

    background_tasks.add_task(_process_file, meeting_id, save_path)

    return {"status": "processing", "meeting_id": meeting_id, "file": file.filename}


@router.get("/status/{meeting_id}")
async def get_status(meeting_id: str, db: AsyncSession = Depends(get_db)):
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    return {"meeting_id": meeting_id, "status": meeting.status, "word_count": meeting.word_count}


async def _process_file(meeting_id: str, audio_path: str):
    """Full background processing pipeline."""
    from db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            logger.info(f"[{meeting_id}] Starting transcription...")
            transcript_result = transcribe_file(audio_path)
            logger.info(f"[{meeting_id}] Transcription done. Segments: {len(transcript_result['segments'])}")

            logger.info(f"[{meeting_id}] Starting diarization...")
            diarization_turns = diarize(audio_path)
            logger.info(f"[{meeting_id}] Diarization done. Turns: {len(diarization_turns)}")

            # Merge transcript + diarization
            merged = merge_transcript_with_diarization(
                transcript_result["segments"],
                diarization_turns,
            )

            # Sentiment analysis (batch)
            texts = [s["text"] for s in merged]
            sentiments = batch_analyze_sentiment(texts)

            # Audio stats
            duration = transcript_result.get("duration", 0)
            speaker_talk = compute_speaker_talk_stats(merged, duration)

            # Save segments to DB
            all_texts = []
            for seg, sent in zip(merged, sentiments):
                segment = Segment(
                    meeting_id=meeting_id,
                    speaker_label=seg.get("speaker"),
                    start_time=seg["start"],
                    end_time=seg["end"],
                    text=seg["text"],
                    sentiment=sent["tag"],
                    sentiment_score=sent["score"],
                    confidence=seg.get("confidence"),
                    words_per_minute=None,
                )
                db.add(segment)
                all_texts.append(seg["text"])

            await db.flush()

            # Save speakers
            speaker_sentiment_segs: dict = {}
            for seg, sent in zip(merged, sentiments):
                spk = seg.get("speaker") or "Unknown"
                if spk not in speaker_sentiment_segs:
                    speaker_sentiment_segs[spk] = []
                speaker_sentiment_segs[spk].append(sent)

            for label, stats in speaker_talk.items():
                sent_stats = compute_speaker_sentiment_stats(speaker_sentiment_segs.get(label, []))
                speaker = Speaker(
                    meeting_id=meeting_id,
                    label=label,
                    name=None,
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
                )
                db.add(speaker)

            # Generate summary
            full_text = " ".join(all_texts)
            logger.info(f"[{meeting_id}] Generating summary...")
            summary_data = await summarize_meeting(full_text)
            logger.info(f"[{meeting_id}] Summary done.")

            summary = MeetingSummary(
                meeting_id=meeting_id,
                overview=summary_data["overview"],
                key_points=summary_data["key_points"],
                topics=summary_data["topics"],
                decisions=summary_data["decisions"],
            )
            db.add(summary)

            # Save action items
            for ai in summary_data.get("action_items", []):
                item = ActionItem(
                    meeting_id=meeting_id,
                    task=ai["task"],
                    owner=ai.get("owner"),
                    deadline=ai.get("deadline"),
                    priority=ai.get("priority", "medium"),
                )
                db.add(item)

            # Update meeting
            meeting = await db.get(Meeting, meeting_id)
            meeting.status = "done"
            meeting.duration_seconds = duration
            meeting.word_count = len(full_text.split())
            meeting.participant_count = len(speaker_talk)
            meeting.ended_at = datetime.utcnow()

            await db.commit()
            logger.info(f"[{meeting_id}] Processing complete ✓")

        except Exception as e:
            logger.error(f"[{meeting_id}] Processing failed: {e}", exc_info=True)
            try:
                meeting = await db.get(Meeting, meeting_id)
                if meeting:
                    meeting.status = "error"
                    await db.commit()
            except Exception:
                pass
