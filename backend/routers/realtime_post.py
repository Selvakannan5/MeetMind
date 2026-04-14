import asyncio
import logging
from datetime import datetime
from sqlalchemy import select
from db.database import AsyncSessionLocal
from db.models import Meeting, Segment, Speaker, MeetingSummary, ActionItem
from services.diarizer import diarize
from services.summarizer import summarize_meeting, extract_speaker_names
from services.audio_stats import compute_speaker_talk_stats
from services.ws_manager import manager

logger = logging.getLogger(__name__)

async def _broadcast_status(meeting_id: str, stage: str, message: str):
    await manager.broadcast(meeting_id, {
        "type": "status", "stage": stage, "message": message
    })

async def _post_process_live(meeting_id: str, audio_path: str):
    """
    Called after a live WebSocket stream disconnects.
    The audio is saved. Segments exist in DB but have no Speaker Labels.
    We need to Diarize, assign labels, compute stats, and Summarize.
    """
    try:
        await _broadcast_status(meeting_id, "diarizing", "Assigning speaker identities to live text…")
        
        # 1. Diarize the complete wav file
        turns = await asyncio.get_event_loop().run_in_executor(None, diarize, audio_path)
        
        def assign_speaker(start: float, end: float) -> str | None:
            if end <= start: return None
            best_spk = None
            best_overlap = 0.0
            for turn in turns:
                overlap = min(end, turn["end"]) - max(start, turn["start"])
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_spk = turn["speaker"]
            return best_spk if best_spk and (best_overlap / (end - start)) > 0.2 else None

        # 2. Update existing Segments
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Segment).where(Segment.meeting_id == meeting_id).order_by(Segment.start_time)
            )
            segments = result.scalars().all()
            
            # Keep array of dicts for stats
            all_segments = []
            duration = 0.0
            
            for seg in segments:
                spk = assign_speaker(seg.start_time, seg.end_time)
                if spk:
                    seg.speaker_label = spk
                
                duration = max(duration, seg.end_time)
                all_segments.append({
                    "start": seg.start_time,
                    "end": seg.end_time,
                    "speaker": seg.speaker_label,
                    "text": seg.text,
                    "sentiment": seg.sentiment,
                    "score": seg.sentiment_score
                })
            await db.commit()

        # 3. Speakers
        await _broadcast_status(meeting_id, "analyzing", "Extracting speaker names…")
        full_transcript = ""
        for seg in all_segments:
            spk  = seg.get("speaker") or "Unknown"
            mins = int(seg["start"] // 60)
            secs = int(seg["start"] % 60)
            full_transcript += f"[{mins:02d}:{secs:02d}] [{spk}]: {seg['text']}\n"
            
        extracted_names = await extract_speaker_names(full_transcript)
        
        async with AsyncSessionLocal() as db:
            speaker_talk = compute_speaker_talk_stats(all_segments, duration)
            for label, stats in speaker_talk.items():
                db.add(Speaker(
                    meeting_id=meeting_id,
                    label=label,
                    name=extracted_names.get(label),
                    talk_time_seconds=stats["talk_time_seconds"],
                    talk_percentage=stats["talk_percentage"],
                    word_count=stats["word_count"],
                    avg_wpm=stats["avg_wpm"],
                    turn_count=stats["turn_count"],
                    dominant_sentiment=None, # simplified
                    positive_pct=0,
                ))
            await db.commit()
            
        # 4. Summary
        await _broadcast_status(meeting_id, "summarizing", "Generating AI summary…")
        summary_data = await summarize_meeting(transcript=full_transcript, speaker_names=extracted_names)
        
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
            
            # finalize
            meeting = await db.get(Meeting, meeting_id)
            if meeting:
                meeting.status = "done"
                meeting.duration_seconds = duration
                meeting.word_count = len(" ".join(s["text"] for s in all_segments).split())
                meeting.participant_count = len(speaker_talk)
                meeting.ended_at = datetime.utcnow()
            await db.commit()

        await manager.broadcast(meeting_id, {
            "type": "done", "meeting_id": meeting_id, "message": "Post-processing complete"
        })

    except Exception as e:
        logger.error(f"Live post process failed: {e}")
        try:
            await manager.broadcast(meeting_id, {"type": "error", "message": "Failed final process"})
            async with AsyncSessionLocal() as db:
                meeting = await db.get(Meeting, meeting_id)
                if meeting:
                    meeting.status = "error"
                    await db.commit()
        except: pass
