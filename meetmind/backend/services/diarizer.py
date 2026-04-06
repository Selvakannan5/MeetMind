"""
Speaker diarization using pyannote.audio 3.1.
Identifies WHO spoke WHEN, then merges with transcript segments.
Requires: HF_TOKEN env var (free at huggingface.co)
"""
import os
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

_pipeline = None


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            logger.warning("HF_TOKEN not set — diarization will use mock")
            _pipeline = "mock"
            return _pipeline
        try:
            from pyannote.audio import Pipeline
            import torch
            logger.info("Loading pyannote diarization pipeline...")
            _pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=hf_token,
            )
            device = "cuda" if torch.cuda.is_available() else "cpu"
            _pipeline = _pipeline.to(device)
            logger.info(f"Diarization pipeline loaded on {device}")
        except ImportError:
            logger.warning("pyannote.audio not installed — using mock diarizer")
            _pipeline = "mock"
    return _pipeline


def diarize(audio_path: str, num_speakers: Optional[int] = None) -> List[Dict]:
    """
    Returns list of speaker turns:
    [{"speaker": "SPEAKER_00", "start": 0.0, "end": 2.5}, ...]
    """
    pipeline = get_pipeline()

    if pipeline == "mock":
        return _mock_diarize(audio_path)

    params = {}
    if num_speakers:
        params["num_speakers"] = num_speakers

    diarization = pipeline(audio_path, **params)

    turns = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        turns.append({
            "speaker": speaker,
            "start": round(turn.start, 3),
            "end": round(turn.end, 3),
        })

    return turns


def merge_transcript_with_diarization(
    transcript_segments: List[Dict],
    diarization_turns: List[Dict],
) -> List[Dict]:
    """
    Assigns speaker labels to transcript segments by overlap.
    Each transcript segment gets the speaker with most overlap.
    """
    merged = []

    for seg in transcript_segments:
        seg_start = seg["start"]
        seg_end = seg["end"]
        seg_duration = seg_end - seg_start

        if seg_duration <= 0:
            merged.append({**seg, "speaker": None})
            continue

        # Calculate overlap with each diarization turn
        overlap_by_speaker: Dict[str, float] = {}
        for turn in diarization_turns:
            overlap = min(seg_end, turn["end"]) - max(seg_start, turn["start"])
            if overlap > 0:
                spk = turn["speaker"]
                overlap_by_speaker[spk] = overlap_by_speaker.get(spk, 0) + overlap

        if overlap_by_speaker:
            best_speaker = max(overlap_by_speaker, key=overlap_by_speaker.get)
        else:
            best_speaker = None

        merged.append({**seg, "speaker": best_speaker})

    return merged


def _mock_diarize(audio_path: str) -> List[Dict]:
    """Fallback mock returns 2 alternating speakers."""
    import random
    turns = []
    t = 0.0
    speaker_idx = 0
    while t < 60.0:
        duration = random.uniform(2.0, 8.0)
        turns.append({
            "speaker": f"SPEAKER_0{speaker_idx % 2}",
            "start": round(t, 2),
            "end": round(t + duration, 2),
        })
        t += duration + random.uniform(0.1, 0.5)
        speaker_idx += 1
    return turns
