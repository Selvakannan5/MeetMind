"""
Sentiment analysis using SiEBERT (siebert/sentiment-roberta-large-english).
High accuracy on conversational / meeting text.
Falls back to a rule-based approach if transformers not available.
"""
import logging
import re
from typing import Dict, List

logger = logging.getLogger(__name__)

_sentiment_pipeline = None
_emotion_pipeline = None


def get_sentiment_pipeline():
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        try:
            from transformers import pipeline
            logger.info("Loading sentiment model (SiEBERT)...")
            _sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model="siebert/sentiment-roberta-large-english",
                truncation=True,
                max_length=512,
            )
            logger.info("Sentiment model loaded")
        except ImportError:
            logger.warning("transformers not installed — using rule-based sentiment")
            _sentiment_pipeline = "rule_based"
    return _sentiment_pipeline


def get_emotion_pipeline():
    global _emotion_pipeline
    if _emotion_pipeline is None:
        try:
            from transformers import pipeline
            logger.info("Loading emotion model...")
            _emotion_pipeline = pipeline(
                "text-classification",
                model="j-hartmann/emotion-english-distilroberta-base",
                return_all_scores=True,
                truncation=True,
                max_length=512,
            )
            logger.info("Emotion model loaded")
        except ImportError:
            _emotion_pipeline = "mock"
    return _emotion_pipeline


def analyze_sentiment(text: str) -> Dict:
    """
    Returns: {label: POSITIVE|NEGATIVE|NEUTRAL, score: float, tag: str}
    """
    if not text.strip():
        return {"label": "NEUTRAL", "score": 0.5, "tag": "neutral"}

    pipe = get_sentiment_pipeline()

    if pipe == "rule_based":
        return _rule_based_sentiment(text)

    result = pipe(text[:512])[0]
    label = result["label"]          # POSITIVE | NEGATIVE
    score = result["score"]

    # Detect questions (questioning = separate tag)
    if text.strip().endswith("?") or re.search(r'\b(how|what|why|when|where|who|can|could|would|should)\b', text, re.I):
        tag = "questioning"
    elif label == "POSITIVE" and score > 0.75:
        tag = "positive"
    elif label == "NEGATIVE" and score > 0.65:
        tag = "negative"
    else:
        tag = "neutral"

    return {
        "label": label,
        "score": score,
        "tag": tag,
    }


def analyze_emotions(text: str) -> Dict:
    """
    Returns emotion scores: {joy, anger, sadness, fear, surprise, disgust, neutral}
    """
    pipe = get_emotion_pipeline()

    if pipe == "mock" or not text.strip():
        return {"neutral": 0.6, "joy": 0.2, "surprise": 0.1, "anger": 0.05, "sadness": 0.05}

    results = pipe(text[:512])[0]
    return {item["label"]: round(item["score"], 4) for item in results}


def batch_analyze_sentiment(texts: List[str]) -> List[Dict]:
    """Batch sentiment for efficiency."""
    pipe = get_sentiment_pipeline()

    if pipe == "rule_based":
        return [_rule_based_sentiment(t) for t in texts]

    # Process in batches of 16
    results = []
    batch_size = 16
    for i in range(0, len(texts), batch_size):
        batch = [t[:512] for t in texts[i: i + batch_size]]
        batch_results = pipe(batch)
        for text, res in zip(texts[i: i + batch_size], batch_results):
            label = res["label"]
            score = res["score"]
            tag = "questioning" if text.strip().endswith("?") else (
                "positive" if label == "POSITIVE" and score > 0.75 else
                "negative" if label == "NEGATIVE" and score > 0.65 else
                "neutral"
            )
            results.append({"label": label, "score": score, "tag": tag})

    return results


def compute_speaker_sentiment_stats(sentiments: List[Dict]) -> Dict:
    """Aggregate sentiment stats for a speaker across their segments."""
    if not sentiments:
        return {"positive_pct": 0, "negative_pct": 0, "neutral_pct": 0, "avg_score": 0.5, "dominant": "neutral"}

    pos = sum(1 for s in sentiments if s["label"] == "POSITIVE")
    neg = sum(1 for s in sentiments if s["label"] == "NEGATIVE")
    neu = len(sentiments) - pos - neg

    total = len(sentiments)
    pos_pct = round(pos / total * 100, 1)
    neg_pct = round(neg / total * 100, 1)
    neu_pct = round(neu / total * 100, 1)
    avg_score = round(sum(s["score"] for s in sentiments) / total, 3)

    dominant = "positive" if pos >= neg and pos >= neu else \
               "negative" if neg >= pos and neg >= neu else "neutral"

    return {
        "positive_pct": pos_pct,
        "negative_pct": neg_pct,
        "neutral_pct": neu_pct,
        "avg_score": avg_score,
        "dominant": dominant,
    }


# ── Rule-based fallback ────────────────────────────────────────────────────────

_POSITIVE_WORDS = {
    "great", "good", "excellent", "amazing", "wonderful", "fantastic",
    "perfect", "love", "best", "happy", "glad", "agree", "yes", "definitely",
    "absolutely", "sure", "thanks", "thank", "appreciate", "helpful", "nice",
    "awesome", "brilliant", "clear", "solved", "done", "completed", "fixed",
}
_NEGATIVE_WORDS = {
    "bad", "terrible", "awful", "hate", "wrong", "no", "not", "never",
    "broken", "failed", "issue", "problem", "bug", "error", "crash", "slow",
    "difficult", "hard", "complicated", "stuck", "blocked", "concerned",
    "worried", "risk", "delay", "miss", "missed", "unclear", "confused",
}


def _rule_based_sentiment(text: str) -> Dict:
    words = set(re.findall(r'\b\w+\b', text.lower()))
    pos = len(words & _POSITIVE_WORDS)
    neg = len(words & _NEGATIVE_WORDS)

    is_question = text.strip().endswith("?")

    if is_question:
        tag = "questioning"
        label = "NEUTRAL"
        score = 0.6
    elif pos > neg:
        tag = "positive"
        label = "POSITIVE"
        score = 0.6 + min(0.35, pos * 0.05)
    elif neg > pos:
        tag = "negative"
        label = "NEGATIVE"
        score = 0.6 + min(0.35, neg * 0.05)
    else:
        tag = "neutral"
        label = "NEUTRAL"
        score = 0.5

    return {"label": label, "score": round(score, 3), "tag": tag}
