"""
Meeting summarization using local Ollama (llama3).
Sends full transcript with speaker context to get accurate, relevant summary.
"""
import os
import json
import re
import logging
from typing import Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

OLLAMA_URL  = os.getenv("OLLAMA_URL",   "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
REQUEST_TIMEOUT = 300.0   # 5 min — long meetings need time


SUMMARY_PROMPT = """You are a professional meeting analyst. I will give you a FULL meeting transcript. Read it completely and carefully.

MEETING TRANSCRIPT (read every line):
---
{transcript}
---

Now focus heavily on identifying the CORE CONCEPTS and underlying themes. Answer these questions based on the ENTIRE meeting, not just one part. do NOT copy sentences, write in your own words.

1. SHORT TOPIC: Provide a single, engaging "one-liner" topic sentence that captures the essence of the entire meeting (max 12 words).

2. OVERVIEW: Write a very detailed, comprehensive summary of the WHOLE meeting. The first paragraph should describe the main purpose and thoroughly explain the core concepts and ideas discussed. The second paragraph should detail the major decisions made, the flow of the conversation, and overall outcomes. Give me a highly detailed snapshot of what they spoke about.

2. KEY POINTS: List 5-7 of the most important concepts, insights, or concerns raised across the ENTIRE meeting, providing robust context for each point.

3. TOPICS: List the main subject areas discussed (e.g., "Meeting restructuring", "KPI metrics", "Community contributions").

4. DECISIONS: List specific things that were agreed upon or decided during the meeting.

5. ACTION ITEMS: List specific tasks that were assigned or committed to. For each, identify WHO will do it and by WHEN if mentioned.

Return ONLY a JSON object. No markdown. No explanation. Just the JSON:
{
  "short_topic": "One liner topic goes here",
  "overview": "Your 3-5 sentence summary of the whole meeting in your own words",
  "key_points": [
    "Important insight 1 from the meeting",
    "Important insight 2 from the meeting",
    "Important insight 3 from the meeting",
    "Important insight 4 from the meeting",
    "Important insight 5 from the meeting"
  ],
  "topics": ["Topic 1", "Topic 2", "Topic 3"],
  "decisions": ["Decision 1", "Decision 2", "Decision 3"],
  "action_items": [
    {{"task": "Specific task description", "owner": "Person name or null", "deadline": "When or null", "priority": "high"}}
  ]
  ]
}}"""


SPEAKER_PROMPT = """Read the following transcript snippet. Several speakers are labeled as SPEAKER_00, SPEAKER_01, etc.
Try to identify their real names from the conversation (e.g., if SPEAKER_00 says "Hi, I'm John" or someone says "Thanks Alice" after SPEAKER_01 speaks).

TRANSCRIPT SNIPPET:
---
{transcript}
---

Return ONLY a valid JSON object mapping the SPEAKER label to their first name or full name. If you cannot identify a speaker, leave them out. Do not include any explanations or markdown.
Example format:
{{
  "SPEAKER_00": "John",
  "SPEAKER_01": "Alice"
}}"""


async def extract_speaker_names(transcript: str) -> Dict[str, str]:
    """Identify speaker actual names from transcript context."""
    if not transcript or len(transcript) < 50:
        return {}
        
    # Use first 8000 chars for introduction clues
    snippet = transcript[:8000]
    prompt = SPEAKER_PROMPT.format(transcript=snippet)

    logger.info("Extracting speaker names via Ollama...")
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model":   OLLAMA_MODEL,
                    "prompt":  prompt,
                    "stream":  False,
                    "options": {
                        "temperature":  0.1,
                        "top_p":        0.9,
                        "num_predict":  200,
                    },
                },
            )
            response.raise_for_status()
            raw = response.json().get("response", "")
            
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"```\s*",     "", raw)
        raw = raw.strip()
        
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            return {}
            
        parsed = json.loads(match.group())
        # Filter to ensure valid mapping
        mapping = {k: str(v).strip() for k, v in parsed.items() if k.startswith("SPEAKER_") and len(str(v).strip()) > 1}
        logger.info(f"Ollama extracted names: {mapping}")
        return mapping
    except Exception as e:
        logger.warning(f"Failed to extract speaker names: {e}")
        return {}


async def summarize_meeting(
    transcript: str,
    speaker_names: Optional[Dict[str, str]] = None,
) -> Dict:
    """Generate meeting summary using Ollama LLM."""
    if not transcript or not transcript.strip():
        return _empty_summary()

    # Replace speaker labels with real names if available
    if speaker_names:
        for label, name in speaker_names.items():
            transcript = transcript.replace(f"[{label}]", f"[{name}]")
            transcript = transcript.replace(label, name)

    # Keep full transcript — do NOT truncate too aggressively
    # Llama3 context is 4096 tokens ≈ ~12000 chars
    max_chars = 14000
    if len(transcript) > max_chars:
        # Take first 70% + last 30% to capture beginning and end decisions
        first_part  = transcript[:int(max_chars * 0.7)]
        last_part   = transcript[-(int(max_chars * 0.3)):]
        transcript  = first_part + "\n...[middle portion omitted for length]...\n" + last_part

    logger.info(f"Sending {len(transcript)} chars to Ollama for summarization")

    try:
        result = await _call_ollama(transcript)
        # Validate we got a real summary, not a fragment
        if not result.get("overview") or len(result["overview"]) < 50:
            logger.warning("Ollama returned thin overview, retrying with extractive fallback")
            return _extractive_summary(transcript)
        return result
    except Exception as e:
        logger.warning(f"Ollama failed: {e} — using extractive fallback")
        return _extractive_summary(transcript)


async def _call_ollama(transcript: str) -> Dict:
    prompt = SUMMARY_PROMPT.format(transcript=transcript)

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model":   OLLAMA_MODEL,
                "prompt":  prompt,
                "stream":  False,
                "format":  "json",
                "options": {
                    "temperature":  0.3,
                    "top_p":        0.9,
                    "num_predict":  2000,
                    "num_ctx":      8192,  # increase context window
                },
            },
        )
        response.raise_for_status()
        raw = response.json().get("response", "")

    logger.info(f"Ollama responded with {len(raw)} chars")

    # Strip markdown
    raw = re.sub(r"```json\s*", "", raw)
    raw = re.sub(r"```\s*",     "", raw)
    raw = raw.strip()

    # Find JSON object
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON in response: {raw[:300]}")

    parsed = json.loads(match.group())
    return _clean_summary(parsed)


def _clean_summary(data: Dict) -> Dict:
    """Validate and clean LLM output."""

    def clean_str_list(lst):
        if not isinstance(lst, list):
            return []
        cleaned = []
        for item in lst:
            s = str(item).strip()
            # Skip if it looks like a raw transcript line
            if len(s) < 10 or len(s) > 400:
                continue
            if s.startswith("[00:") or s.startswith("SPEAKER_"):
                continue
            cleaned.append(s)
        return cleaned[:8]

    def clean_actions(items):
        if not isinstance(items, list):
            return []
        result = []
        for item in items:
            if not isinstance(item, dict):
                continue
            task = str(item.get("task", "")).strip()
            if len(task) < 10 or len(task) > 300:
                continue
            # Skip if it's a transcript fragment
            if task.startswith("[00:") or "SPEAKER_" in task:
                continue
            result.append({
                "task":     task,
                "owner":    item.get("owner")   or None,
                "deadline": item.get("deadline") or None,
                "priority": item.get("priority", "medium"),
            })
        return result[:8]

    overview = str(data.get("overview", "")).strip()
    short_topic = str(data.get("short_topic", "")).strip()

    return {
        "short_topic":  short_topic,
        "overview":     overview,
        "key_points":   clean_str_list(data.get("key_points",  [])),
        "topics":       clean_str_list(data.get("topics",      [])),
        "decisions":    clean_str_list(data.get("decisions",   [])),
        "action_items": clean_actions( data.get("action_items",[])),
    }


def _extractive_summary(transcript: str) -> Dict:
    """Improved fallback when Ollama not available."""

    # Clean timestamps and speaker labels
    clean = re.sub(r'\[\d+:\d+:\d+\]\s*', '', transcript)
    clean = re.sub(r'(SPEAKER_\d+|Unknown)\s*', '', clean)
    clean = re.sub(r'\[.*?\]\s*', '', clean)

    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', clean)
                 if 25 < len(s.strip()) < 350]

    # Score by importance keywords
    keywords = {
        'propose', 'proposal', 'decide', 'decision', 'agree', 'agreed',
        'action', 'will', 'should', 'problem', 'issue', 'important',
        'goal', 'metric', 'KPI', 'change', 'update', 'review', 'suggest',
        'recommend', 'concern', 'focus', 'plan', 'strategy', 'measure',
    }

    def score_sentence(s):
        words = set(s.lower().split())
        return len(words & keywords)

    scored    = sorted(sentences, key=score_sentence, reverse=True)
    key_points = scored[:6]

    # Build meaningful overview from top scored sentences
    overview_sents = scored[:3]
    overview = " ".join(overview_sents) if overview_sents else clean[:500]

    # Extract action items from patterns
    action_patterns = [
        r'(?:will|going to|need to|should|must|have to|I\'ll|we\'ll|can you|let\'s)\s+(.{15,120}?)(?:\.|,|$)',
        r'(?:action item|next step|follow up)[:\s]+(.{15,120}?)(?:\.|$)',
    ]
    action_items = []
    seen_tasks = set()
    for pattern in action_patterns:
        for m in re.finditer(pattern, clean, re.IGNORECASE):
            task = m.group(1).strip()
            if 15 < len(task) < 150 and task not in seen_tasks:
                seen_tasks.add(task)
                action_items.append({
                    "task":     task,
                    "owner":    None,
                    "deadline": None,
                    "priority": "medium",
                })
    action_items = action_items[:6]

    # Topic extraction
    stop = {
        'this', 'that', 'with', 'have', 'from', 'they', 'will', 'been',
        'were', 'when', 'what', 'which', 'there', 'their', 'about', 'just',
        'like', 'know', 'think', 'going', 'yeah', 'okay', 'right', 'also',
        'some', 'more', 'very', 'than', 'then', 'only', 'also', 'would',
        'could', 'should', 'really', 'actually', 'because', 'something',
    }
    words = re.findall(r'\b[a-zA-Z]{4,}\b', clean.lower())
    freq  = {}
    for w in words:
        if w not in stop:
            freq[w] = freq.get(w, 0) + 1
    top_words = sorted(freq, key=freq.get, reverse=True)[:6]

    return {
        "short_topic":  (top_words[0].title() + " Discussion") if top_words else "General Meeting",
        "overview":     overview[:700],
        "key_points":   key_points[:6],
        "topics":       [w.title() for w in top_words],
        "decisions":    [],
        "action_items": action_items,
    }


def _empty_summary() -> Dict:
    return {
        "short_topic":  "",
        "overview":     "No transcript available to summarize.",
        "key_points":   [],
        "topics":       [],
        "decisions":    [],
        "action_items": [],
    }