"""
Meeting summarization using local Ollama (llama3 / mistral).
Falls back to extractive summarization if Ollama not available.
"""
import os
import json
import re
import logging
from typing import Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
REQUEST_TIMEOUT = 120.0


SUMMARY_PROMPT = """You are a professional meeting analyst. Analyze this meeting transcript and return a JSON object.

TRANSCRIPT:
{transcript}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{{
  "overview": "2-3 sentence summary of what was discussed and decided",
  "key_points": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "topics": ["topic 1", "topic 2", "topic 3"],
  "decisions": ["decision 1", "decision 2"],
  "action_items": [
    {{"task": "description", "owner": "person name or null", "deadline": "deadline or null", "priority": "high|medium|low"}},
    {{"task": "description", "owner": "person name or null", "deadline": "deadline or null", "priority": "high|medium|low"}}
  ]
}}"""


async def summarize_meeting(transcript: str, speaker_names: Optional[List[str]] = None) -> Dict:
    """
    Generate meeting summary using Ollama LLM.
    Returns structured dict with overview, key_points, topics, action_items.
    """
    if not transcript.strip():
        return _empty_summary()

    # Truncate very long transcripts to ~8000 chars (model context limit)
    if len(transcript) > 8000:
        transcript = transcript[:8000] + "\n[... transcript truncated ...]"

    try:
        result = await _call_ollama(transcript)
        return result
    except Exception as e:
        logger.warning(f"Ollama summarization failed: {e} — falling back to extractive")
        return _extractive_summary(transcript)


async def _call_ollama(transcript: str) -> Dict:
    prompt = SUMMARY_PROMPT.format(transcript=transcript)

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.1, "top_p": 0.9},
            },
        )
        response.raise_for_status()
        data = response.json()
        raw_text = data.get("response", "")

    # Strip any markdown fences
    raw_text = re.sub(r"```json\s*", "", raw_text)
    raw_text = re.sub(r"```\s*", "", raw_text)
    raw_text = raw_text.strip()

    # Extract JSON object
    match = re.search(r"\{.*\}", raw_text, re.DOTALL)
    if not match:
        raise ValueError("No JSON found in Ollama response")

    parsed = json.loads(match.group())
    return _normalize_summary(parsed)


def _normalize_summary(data: Dict) -> Dict:
    return {
        "overview": data.get("overview", ""),
        "key_points": data.get("key_points", []),
        "topics": data.get("topics", []),
        "decisions": data.get("decisions", []),
        "action_items": [
            {
                "task": item.get("task", ""),
                "owner": item.get("owner"),
                "deadline": item.get("deadline"),
                "priority": item.get("priority", "medium"),
            }
            for item in data.get("action_items", [])
        ],
    }


def _extractive_summary(transcript: str) -> Dict:
    """
    Simple extractive fallback when Ollama is unavailable.
    Picks longest sentences as key points.
    """
    sentences = re.split(r'(?<=[.!?])\s+', transcript)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 30]

    # Score by length (proxy for informativeness)
    scored = sorted(sentences, key=len, reverse=True)
    key_points = scored[:5]

    overview = " ".join(scored[:2]) if len(scored) >= 2 else transcript[:300]

    # Simple action item detection
    action_patterns = [
        r"(?:will|should|need to|going to|must|have to|let me|I'll|we'll)\s+(.+?)(?:\.|$)",
        r"(?:action item|todo|follow.?up|next step)[:\s]+(.+?)(?:\.|$)",
    ]
    action_items = []
    for pattern in action_patterns:
        for match in re.finditer(pattern, transcript, re.IGNORECASE):
            task = match.group(1).strip()
            if 10 < len(task) < 150:
                action_items.append({"task": task, "owner": None, "deadline": None, "priority": "medium"})
    action_items = action_items[:6]

    return {
        "overview": overview[:500],
        "key_points": key_points[:5],
        "topics": [],
        "decisions": [],
        "action_items": action_items,
    }


def _empty_summary() -> Dict:
    return {
        "overview": "",
        "key_points": [],
        "topics": [],
        "decisions": [],
        "action_items": [],
    }
