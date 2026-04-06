"""
WebSocket endpoint for live audio transcription.
Client streams 3s audio chunks → server transcribes + analyzes → broadcasts result.
"""
import asyncio
import logging
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import AsyncSessionLocal
from db.models import Meeting, Segment
from services.transcriber import transcribe_bytes
from services.sentiment import analyze_sentiment
from services.ws_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/{meeting_id}")
async def websocket_live(websocket: WebSocket, meeting_id: str):
    """
    Live transcription WebSocket.
    Protocol:
      Client → binary audio chunks (webm/wav, ~3s each)
      Server → JSON messages: {type: "segment", ...} | {type: "status", ...} | {type: "error", ...}
    """
    await manager.connect(websocket, meeting_id)
    logger.info(f"[{meeting_id}] WS connected")
    chunk_count = 0
    session_start = time.time()

    async with AsyncSessionLocal() as db:
        # Ensure meeting exists
        meeting = await db.get(Meeting, meeting_id)
        if not meeting:
            await manager.send_personal(websocket, {
                "type": "error",
                "message": f"Meeting {meeting_id} not found"
            })
            manager.disconnect(websocket, meeting_id)
            return

    try:
        while True:
            # Accept audio bytes from client
            data = await websocket.receive_bytes()

            if len(data) < 512:
                # Too small — likely a ping or empty chunk
                continue

            chunk_count += 1
            offset_seconds = time.time() - session_start

            # Run transcription in thread pool (blocking CPU work)
            loop = asyncio.get_event_loop()
            transcript = await loop.run_in_executor(
                None, lambda: transcribe_bytes(data, suffix=".webm")
            )

            text = transcript.get("text", "").strip()
            if not text or len(text) < 3:
                continue

            # Sentiment analysis
            sentiment = analyze_sentiment(text)

            # Estimate timing
            duration = transcript.get("duration") or 3.0
            start_time = max(0.0, offset_seconds - duration)
            end_time = offset_seconds

            # Save to DB
            async with AsyncSessionLocal() as db:
                segment = Segment(
                    meeting_id=meeting_id,
                    speaker_label=None,   # Live diarization is added post-session
                    start_time=round(start_time, 2),
                    end_time=round(end_time, 2),
                    text=text,
                    sentiment=sentiment["tag"],
                    sentiment_score=sentiment["score"],
                    confidence=transcript["segments"][0].get("confidence") if transcript["segments"] else None,
                )
                db.add(segment)
                await db.flush()
                seg_id = segment.id

                # Update word count
                meeting = await db.get(Meeting, meeting_id)
                if meeting:
                    meeting.word_count = (meeting.word_count or 0) + len(text.split())
                await db.commit()

            # Broadcast to all listeners in this meeting room
            await manager.broadcast(meeting_id, {
                "type": "segment",
                "meeting_id": meeting_id,
                "segment_id": seg_id,
                "speaker_label": None,
                "speaker_name": None,
                "start_time": round(start_time, 2),
                "end_time": round(end_time, 2),
                "text": text,
                "sentiment": sentiment["tag"],
                "sentiment_score": round(sentiment["score"], 3),
                "confidence": transcript["segments"][0].get("confidence") if transcript["segments"] else None,
                "is_partial": False,
                "chunk": chunk_count,
            })

    except WebSocketDisconnect:
        logger.info(f"[{meeting_id}] WS disconnected after {chunk_count} chunks")
    except Exception as e:
        logger.error(f"[{meeting_id}] WS error: {e}", exc_info=True)
        try:
            await manager.send_personal(websocket, {"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        manager.disconnect(websocket, meeting_id)


@router.websocket("/ws/{meeting_id}/listen")
async def websocket_listen(websocket: WebSocket, meeting_id: str):
    """
    Read-only WebSocket for dashboard clients.
    Receives all broadcast events for a meeting (transcript, status updates).
    """
    await manager.connect(websocket, meeting_id)
    try:
        # Keep alive — just wait for disconnect
        while True:
            await asyncio.sleep(30)
            await manager.send_personal(websocket, {"type": "ping"})
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        manager.disconnect(websocket, meeting_id)
