from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Meeting ──────────────────────────────────────────────────────────────────

class MeetingCreate(BaseModel):
    title: str


class MeetingOut(BaseModel):
    id: str
    title: str
    status: str
    started_at: datetime
    ended_at: Optional[datetime]
    duration_seconds: float
    participant_count: int
    word_count: int

    class Config:
        from_attributes = True


# ── Segment ───────────────────────────────────────────────────────────────────

class SegmentOut(BaseModel):
    id: str
    speaker_label: Optional[str]
    speaker_name: Optional[str]
    start_time: float
    end_time: float
    text: str
    sentiment: Optional[str]
    sentiment_score: Optional[float]
    confidence: Optional[float]
    words_per_minute: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Speaker ───────────────────────────────────────────────────────────────────

class SpeakerOut(BaseModel):
    id: str
    label: str
    name: Optional[str]
    role: Optional[str]
    talk_time_seconds: float
    talk_percentage: float
    word_count: int
    avg_wpm: float
    turn_count: int
    dominant_sentiment: Optional[str]
    positive_pct: float
    negative_pct: float
    neutral_pct: float

    class Config:
        from_attributes = True


class SpeakerUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None


# ── Summary ───────────────────────────────────────────────────────────────────

class SummaryOut(BaseModel):
    id: str
    short_topic: Optional[str] = None
    overview: Optional[str]
    key_points: List[str]
    topics: List[str]
    decisions: List[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Action Item ───────────────────────────────────────────────────────────────

class ActionItemOut(BaseModel):
    id: str
    task: str
    owner: Optional[str]
    deadline: Optional[str]
    priority: str
    done: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ActionItemUpdate(BaseModel):
    done: Optional[bool] = None
    owner: Optional[str] = None
    deadline: Optional[str] = None
    priority: Optional[str] = None


# ── Analytics ─────────────────────────────────────────────────────────────────

class SentimentBreakdown(BaseModel):
    positive: float
    negative: float
    neutral: float
    questioning: float


class TopicSegment(BaseModel):
    topic: str
    start_time: float
    end_time: float
    keywords: List[str]


class AnalyticsOut(BaseModel):
    meeting_id: str
    sentiment_breakdown: SentimentBreakdown
    top_keywords: List[dict]
    topic_timeline: List[TopicSegment]
    avg_wpm: float
    silence_percentage: float
    most_active_speaker: Optional[str]
    engagement_score: float


# ── WebSocket Messages ────────────────────────────────────────────────────────

class LiveSegment(BaseModel):
    type: str = "segment"
    meeting_id: str
    segment_id: str
    speaker_label: Optional[str]
    speaker_name: Optional[str]
    start_time: float
    end_time: float
    text: str
    sentiment: Optional[str]
    sentiment_score: Optional[float]
    confidence: Optional[float]
    is_partial: bool = False


class LiveStatus(BaseModel):
    type: str = "status"
    meeting_id: str
    active_speaker: Optional[str]
    duration_seconds: float
    word_count: int
    participant_count: int
