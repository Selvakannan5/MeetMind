"""
Transcription service using faster-whisper (large-v3, int8).
4× faster than original Whisper with same accuracy.
"""
import os
import tempfile
import logging
from typing import Optional
import numpy as np

logger = logging.getLogger(__name__)

# Lazy-load model so import doesn't crash if package missing
_model = None


def get_model():
    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel
            model_size = os.getenv("WHISPER_MODEL", "base")  # base | small | medium | large-v3
            compute_type = os.getenv("WHISPER_COMPUTE", "int8")
            device = os.getenv("WHISPER_DEVICE", "cpu")
            logger.info(f"Loading faster-whisper model: {model_size} ({compute_type}) on {device}")
            _model = WhisperModel(model_size, compute_type=compute_type, device=device)
            logger.info("Whisper model loaded successfully")
        except ImportError:
            logger.warning("faster-whisper not installed — using mock transcriber")
            _model = "mock"
    return _model


def transcribe_file(audio_path: str, language: Optional[str] = None) -> dict:
    """Transcribe a full audio file. Returns segments with word timestamps."""
    model = get_model()

    if model == "mock":
        return _mock_transcribe(audio_path)

    options = dict(
        language=language,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
        word_timestamps=True,
        beam_size=5,
    )

    segments_gen, info = model.transcribe(audio_path, **options)

    segments = []
    full_text = []

    for seg in segments_gen:
        words = []
        if seg.words:
            words = [{"word": w.word, "start": w.start, "end": w.end, "prob": w.probability} for w in seg.words]

        segments.append({
            "id": seg.id,
            "start": seg.start,
            "end": seg.end,
            "text": seg.text.strip(),
            "words": words,
            "avg_logprob": seg.avg_logprob,
            "no_speech_prob": seg.no_speech_prob,
            "confidence": max(0.0, 1.0 + seg.avg_logprob),
        })
        full_text.append(seg.text.strip())

    return {
        "text": " ".join(full_text),
        "language": info.language,
        "language_probability": info.language_probability,
        "duration": info.duration,
        "segments": segments,
    }


def transcribe_bytes(audio_bytes: bytes, suffix: str = ".webm") -> dict:
    """Transcribe raw audio bytes (used for WebSocket chunks)."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = transcribe_file(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    return result


def _mock_transcribe(audio_path: str) -> dict:
    """Fallback mock when faster-whisper is not installed."""
    return {
        "text": "Mock transcription — install faster-whisper for real results.",
        "language": "en",
        "language_probability": 1.0,
        "duration": 5.0,
        "segments": [{
            "id": 0,
            "start": 0.0,
            "end": 5.0,
            "text": "Mock transcription — install faster-whisper for real results.",
            "words": [],
            "confidence": 0.95,
            "avg_logprob": -0.2,
            "no_speech_prob": 0.01,
        }],
    }
