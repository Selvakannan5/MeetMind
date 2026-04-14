import asyncio
import os
import io
import wave
import logging
import subprocess
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import numpy as np
from datetime import datetime

from db.database import AsyncSessionLocal, get_db
from db.models import Meeting, Segment
from services.transcriber import get_model
from services.sentiment import analyze_sentiment
from services.ws_manager import manager
from routers.transcribe import _process_file

router = APIRouter()
logger = logging.getLogger(__name__)

# Basic VAD threshold strategy
def is_silence(pcm_data: np.ndarray, silence_threshold=0.03, min_silence_duration_frames=1600) -> bool:
    # A highly rudimentary VAD using RMS energy
    # Look at the last `min_silence_duration_frames` (e.g. 100ms)
    tail = pcm_data[-min_silence_duration_frames:]
    rms = np.sqrt(np.mean(tail**2))
    return rms < silence_threshold

@router.websocket("/ws/realtime/{meeting_id}")
async def realtime_transcription(websocket: WebSocket, meeting_id: str):
    await websocket.accept()

    # Verify meeting
    async with AsyncSessionLocal() as db:
        meeting = await db.get(Meeting, meeting_id)
        if not meeting:
            await websocket.close()
            return

        meeting.status = "processing"
        await db.commit()

    ffmpeg = subprocess.Popen(
        ['ffmpeg', '-y', '-i', 'pipe:0', 
         '-f', 's16le', '-ac', '1', '-ar', '16000', 'pipe:1'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL
    )

    # Accumulate full session audio to save at the end for Pyannote
    full_audio_buffer = bytearray()
    
    is_cancelled = False

    async def receive_frames():
        nonlocal is_cancelled
        try:
            while True:
                message = await websocket.receive()
                if "bytes" in message:
                    def _write(data):
                        try:
                            ffmpeg.stdin.write(data)
                            ffmpeg.stdin.flush()
                        except: pass
                    await asyncio.get_event_loop().run_in_executor(None, _write, message["bytes"])
                elif "text" in message:
                    if message["text"] == "CANCEL":
                        is_cancelled = True
                        break
        except WebSocketDisconnect:
            pass
        finally:
            if ffmpeg.stdin:
                try:
                    ffmpeg.stdin.close()
                except:
                    pass

    async def transcribe_loop():
        buffer = bytearray()
        model = get_model()
        chunk_offset_sec = 0.0

        try:
            while True:
                # Read 0.5s of audio (16000 hz * 2 bytes * 0.5 sec = 16000 bytes)
                chunk = await asyncio.get_event_loop().run_in_executor(None, ffmpeg.stdout.read, 16000)
                
                is_eof = not chunk
                if is_eof:
                    if len(buffer) > 16000:
                        should_transcribe = True
                        duration_sec = len(buffer) / 32000
                    else:
                        break
                else:
                    buffer.extend(chunk)
                    full_audio_buffer.extend(chunk)
    
                    pcm = np.frombuffer(buffer, dtype=np.int16).astype(np.float32) / 32768.0
    
                    # Analyze if we've buffered enough audio (min 3s)
                    # If we have 3s+ we wait for a brief silence pause at the end of the buffer, or force transcribe at 8s
                    duration_sec = len(buffer) / 32000
                    
                    # We transcribe if we hit a silence gap, OR we hit max length (4s)
                    should_transcribe = False
                    if duration_sec >= 4.0:
                        should_transcribe = True
                    elif duration_sec >= 2.0:
                        if is_silence(pcm):
                            should_transcribe = True

                if should_transcribe:
                    logger.info(f"[{meeting_id}] Live Transcribing {duration_sec:.1f}s chunk")
                    
                    # Run whisper on thread
                    def _do_transcribe(audio_np):
                        opts = dict(language="en", condition_on_previous_text=False, beam_size=1)
                        segs, _ = model.transcribe(audio_np, **opts)
                        return " ".join([s.text for s in segs]).strip()

                    text = await asyncio.get_event_loop().run_in_executor(None, _do_transcribe, pcm.copy())
                    
                    if text:
                        # Emulate segment
                        sent = analyze_sentiment(text)
                        
                        start_t = chunk_offset_sec
                        end_t   = chunk_offset_sec + duration_sec

                        # Save live segment
                        async with AsyncSessionLocal() as db:
                            db.add(Segment(
                                meeting_id=meeting_id,
                                speaker_label=None, # Cannot diarize live reliably
                                start_time=start_t,
                                end_time=end_t,
                                text=text,
                                sentiment=sent["tag"],
                                sentiment_score=sent["score"]
                            ))
                            await db.commit()

                        # Emit
                        await manager.broadcast(meeting_id, {
                            "type":            "segment",
                            "meeting_id":      meeting_id,
                            "speaker_label":   None,
                            "start_time":      round(start_t, 1),
                            "end_time":        round(end_t, 1),
                            "text":            text,
                            "sentiment":       sent["tag"],
                            "sentiment_score": round(sent["score"], 3),
                            "is_partial":      False,
                            "progress":        None # live stream has no total progress
                        })
                    
                    # Reset buffer, update offset
                    chunk_offset_sec += duration_sec
                    buffer.clear()

                if is_eof:
                    break

        except Exception as e:
            logger.error(f"Live transcribe loop error: {e}")

    try:
        await asyncio.gather(receive_frames(), transcribe_loop())
    finally:
        if ffmpeg.poll() is None:
            try: ffmpeg.kill() 
            except: pass
        
        # Client disconnected
        logger.info(f"[{meeting_id}] Realtime websocket closed. Flushing final audio...")
        
        if is_cancelled:
            logger.info(f"[{meeting_id}] Recording cancelled by user. Discarding audio.")
            async with AsyncSessionLocal() as db:
                meeting = await db.get(Meeting, meeting_id)
                if meeting:
                    meeting.status = "live"
                    meeting.audio_path = None
                    await db.commit()
                    from sqlalchemy import delete
                    await db.execute(delete(Segment).where(Segment.meeting_id == meeting_id))
                    await db.commit()
            return
        
        # We must save full_audio_buffer to a wav file
        upload_dir = os.getenv("UPLOAD_DIR", "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        wav_path = os.path.join(upload_dir, f"{meeting_id}_live.wav")
        
        with wave.open(wav_path, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(full_audio_buffer)

        # Update meeting with audio path
        async with AsyncSessionLocal() as db:
            meeting = await db.get(Meeting, meeting_id)
            if meeting:
                meeting.audio_path = wav_path
                await db.commit()

        # The audio is full. Now we must do post-processing!
        # But wait, we already created segments! _process_file creates segments too!
        # If we run _process_file, it will re-transcribe and duplicate segments!
        # Instead of _process_file, we should run a specialized `_post_process_live` which:
        # Appends Diarization labels to existing segments, and generates a Summary!
        from routers.realtime_post import _post_process_live
        asyncio.create_task(_post_process_live(meeting_id, wav_path))
