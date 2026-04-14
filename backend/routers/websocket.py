"""
WebSocket endpoints.
/ws/{meeting_id}        — live audio input (mic streaming)
/ws/{meeting_id}/listen — dashboard listener (receives broadcast segments)
"""
import asyncio
import json
import logging
from fastapi import WebSocket, WebSocketDisconnect
from fastapi import APIRouter

from db.database import AsyncSessionLocal
from db.models import Meeting, Segment
from services.transcriber import transcribe_bytes
from services.sentiment import analyze_sentiment
from services.ws_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/{meeting_id}")
async def websocket_live(websocket: WebSocket, meeting_id: str):
    """Live mic audio → transcribe → broadcast."""
    await manager.connect(websocket, meeting_id)
    chunk_count  = 0
    import time
    session_start = time.time()

    async with AsyncSessionLocal() as db:
        meeting = await db.get(Meeting, meeting_id)
        if not meeting:
            await manager.send_personal(websocket, {
                "type": "error", "message": f"Meeting {meeting_id} not found"
            })
            manager.disconnect(websocket, meeting_id)
            return

    try:
        while True:
            data = await websocket.receive_bytes()
            if len(data) < 512:
                continue

            chunk_count += 1
            offset = time.time() - session_start

            loop = asyncio.get_event_loop()
            transcript = await loop.run_in_executor(
                None, lambda: transcribe_bytes(data, suffix=".webm")
            )

            text = transcript.get("text", "").strip()
            if not text or len(text) < 3:
                continue

            sentiment = analyze_sentiment(text)
            duration  = transcript.get("duration") or 3.0
            start_t   = max(0.0, offset - duration)
            end_t     = offset

            async with AsyncSessionLocal() as db:
                segment = Segment(
                    meeting_id=meeting_id,
                    start_time=round(start_t, 2),
                    end_time=round(end_t, 2),
                    text=text,
                    sentiment=sentiment["tag"],
                    sentiment_score=sentiment["score"],
                    confidence=transcript["segments"][0].get("confidence") if transcript["segments"] else None,
                )
                db.add(segment)
                await db.flush()
                seg_id = segment.id
                m = await db.get(Meeting, meeting_id)
                if m:
                    m.word_count = (m.word_count or 0) + len(text.split())
                await db.commit()

            await manager.broadcast(meeting_id, {
                "type": "segment",
                "meeting_id": meeting_id,
                "segment_id": seg_id,
                "speaker_label": None,
                "speaker_name": None,
                "start_time": round(start_t, 2),
                "end_time": round(end_t, 2),
                "text": text,
                "sentiment": sentiment["tag"],
                "sentiment_score": round(sentiment["score"], 3),
                "is_partial": False,
                "chunk": chunk_count,
            })

    except WebSocketDisconnect:
        logger.info(f"[{meeting_id}] Live WS disconnected after {chunk_count} chunks")
    except Exception as e:
        logger.error(f"[{meeting_id}] Live WS error: {e}", exc_info=True)
    finally:
        manager.disconnect(websocket, meeting_id)


@router.websocket("/ws/{meeting_id}/listen")
async def websocket_listen(websocket: WebSocket, meeting_id: str):
    """
    Read-only dashboard listener.
    Stays connected and receives all broadcast events for this meeting.
    Sends periodic pings to keep connection alive.
    """
    await manager.connect(websocket, meeting_id)
    logger.info(f"[{meeting_id}] Dashboard listener connected")

    try:
        while True:
            # Keep alive with ping every 20 seconds
            await asyncio.sleep(20)
            try:
                await manager.send_personal(websocket, {"type": "ping"})
            except Exception:
                break
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    except Exception as e:
        logger.warning(f"[{meeting_id}] Listener WS error: {e}")
    finally:
        manager.disconnect(websocket, meeting_id)
        logger.info(f"[{meeting_id}] Dashboard listener disconnected")