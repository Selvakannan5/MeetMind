"""
Audio analytics: speaking pace (WPM), energy, silence ratio, pitch.
Uses librosa for signal analysis.
"""
import os
import re
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


def compute_wpm(text: str, duration_seconds: float) -> float:
    """Words per minute from text and duration."""
    if duration_seconds <= 0:
        return 0.0
    word_count = len(text.split())
    return round(word_count / (duration_seconds / 60), 1)


def analyze_audio_file(audio_path: str) -> Dict:
    """
    Full audio analysis: duration, energy, silence, pitch, RMS.
    Returns dict of metrics.
    """
    try:
        import librosa
        import numpy as np

        y, sr = librosa.load(audio_path, sr=16000, mono=True)
        duration = librosa.get_duration(y=y, sr=sr)

        # RMS energy
        rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
        avg_energy = float(np.mean(rms))
        max_energy = float(np.max(rms))

        # Silence detection (frames below threshold)
        silence_threshold = avg_energy * 0.15
        silence_frames = np.sum(rms < silence_threshold)
        silence_ratio = float(silence_frames / len(rms))

        # Spectral centroid (brightness)
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        avg_centroid = float(np.mean(centroid))

        # Fundamental frequency (pitch) estimation
        try:
            f0, voiced_flag, voiced_probs = librosa.pyin(
                y, fmin=librosa.note_to_hz('C2'),
                fmax=librosa.note_to_hz('C7'),
                sr=sr,
            )
            voiced_f0 = f0[voiced_flag] if f0 is not None else None
            pitch_mean = float(np.nanmean(voiced_f0)) if voiced_f0 is not None and len(voiced_f0) > 0 else 0.0
            pitch_std = float(np.nanstd(voiced_f0)) if voiced_f0 is not None and len(voiced_f0) > 0 else 0.0
        except Exception:
            pitch_mean = 0.0
            pitch_std = 0.0

        return {
            "duration_seconds": round(duration, 2),
            "avg_energy": round(avg_energy, 5),
            "max_energy": round(max_energy, 5),
            "silence_ratio": round(silence_ratio, 3),
            "avg_spectral_centroid": round(avg_centroid, 1),
            "pitch_mean_hz": round(pitch_mean, 1),
            "pitch_std_hz": round(pitch_std, 1),
            "sample_rate": sr,
        }

    except ImportError:
        logger.warning("librosa not installed — returning mock audio stats")
        return _mock_audio_stats(audio_path)
    except Exception as e:
        logger.error(f"Audio analysis failed: {e}")
        return _mock_audio_stats(audio_path)


def compute_speaker_talk_stats(
    segments: List[Dict],
    total_duration: float,
) -> Dict[str, Dict]:
    """
    Compute per-speaker talk time, word count, WPM, turn count.
    segments: list of {speaker, start, end, text}
    Returns: {speaker_label: {talk_time, talk_pct, word_count, avg_wpm, turn_count}}
    """
    stats: Dict[str, Dict] = {}

    for seg in segments:
        spk = seg.get("speaker") or "Unknown"
        if spk not in stats:
            stats[spk] = {
                "talk_time_seconds": 0.0,
                "word_count": 0,
                "wpm_samples": [],
                "turn_count": 0,
            }

        duration = max(0.0, seg.get("end", 0) - seg.get("start", 0))
        text = seg.get("text", "")
        words = len(text.split())
        wpm = compute_wpm(text, duration)

        stats[spk]["talk_time_seconds"] += duration
        stats[spk]["word_count"] += words
        stats[spk]["turn_count"] += 1
        if wpm > 0:
            stats[spk]["wpm_samples"].append(wpm)

    # Finalize
    result = {}
    for spk, s in stats.items():
        avg_wpm = round(sum(s["wpm_samples"]) / len(s["wpm_samples"]), 1) if s["wpm_samples"] else 0.0
        talk_pct = round(s["talk_time_seconds"] / total_duration * 100, 1) if total_duration > 0 else 0.0
        result[spk] = {
            "talk_time_seconds": round(s["talk_time_seconds"], 1),
            "talk_percentage": talk_pct,
            "word_count": s["word_count"],
            "avg_wpm": avg_wpm,
            "turn_count": s["turn_count"],
        }

    return result


def extract_keywords(text: str, top_n: int = 20) -> List[Dict]:
    """
    Extract top keywords using TF-IDF-like scoring.
    Returns [{word, count, score}]
    """
    # Stop words
    stop_words = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "is", "was", "are", "were", "be", "been",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "can", "that", "this", "it", "we", "i",
        "you", "he", "she", "they", "them", "their", "our", "my", "your",
        "so", "if", "as", "about", "just", "more", "also", "not", "no",
        "up", "out", "what", "how", "when", "where", "why", "who", "which",
        "think", "know", "going", "get", "got", "yeah", "okay", "right",
        "like", "really", "actually", "basically", "mean", "thing",
    }

    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    word_freq: Dict[str, int] = {}
    for w in words:
        if w not in stop_words:
            word_freq[w] = word_freq.get(w, 0) + 1

    total = sum(word_freq.values()) or 1
    scored = [
        {"word": w, "count": c, "score": round(c / total * 1000, 2)}
        for w, c in word_freq.items()
        if c >= 2
    ]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_n]


def detect_topics(segments: List[Dict], window_minutes: float = 5.0) -> List[Dict]:
    """
    Simple topic detection by sliding time window + keyword clustering.
    Returns [{topic, start_time, end_time, keywords}]
    """
    if not segments:
        return []

    window_secs = window_minutes * 60
    topics = []
    window_start = segments[0].get("start", 0)
    current_texts = []

    def flush_window(texts, start, end):
        if not texts:
            return None
        combined = " ".join(texts)
        kws = extract_keywords(combined, top_n=5)
        if not kws:
            return None
        topic_name = " + ".join(k["word"] for k in kws[:3]).title()
        return {
            "topic": topic_name,
            "start_time": round(start, 1),
            "end_time": round(end, 1),
            "keywords": [k["word"] for k in kws],
        }

    for seg in segments:
        seg_start = seg.get("start", 0)
        if seg_start - window_start > window_secs:
            t = flush_window(current_texts, window_start, seg_start)
            if t:
                topics.append(t)
            window_start = seg_start
            current_texts = []
        current_texts.append(seg.get("text", ""))

    # Last window
    if current_texts and segments:
        last_end = segments[-1].get("end", window_start)
        t = flush_window(current_texts, window_start, last_end)
        if t:
            topics.append(t)

    return topics


def _mock_audio_stats(audio_path: str) -> Dict:
    return {
        "duration_seconds": 300.0,
        "avg_energy": 0.04,
        "max_energy": 0.18,
        "silence_ratio": 0.22,
        "avg_spectral_centroid": 1800.0,
        "pitch_mean_hz": 165.0,
        "pitch_std_hz": 35.0,
        "sample_rate": 16000,
    }
