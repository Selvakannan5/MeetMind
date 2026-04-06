from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from db.database import get_db
from db.models import Meeting, Segment, Speaker, MeetingSummary
from models.schemas import AnalyticsOut, SentimentBreakdown, TopicSegment, SummaryOut
from services.audio_stats import extract_keywords, detect_topics

router = APIRouter()


@router.get("/{meeting_id}", response_model=AnalyticsOut)
async def get_analytics(meeting_id: str, db: AsyncSession = Depends(get_db)):
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    # Fetch all segments
    result = await db.execute(
        select(Segment).where(Segment.meeting_id == meeting_id).order_by(Segment.start_time)
    )
    segments = result.scalars().all()

    # Fetch speakers
    spk_result = await db.execute(
        select(Speaker).where(Speaker.meeting_id == meeting_id)
    )
    speakers = spk_result.scalars().all()

    if not segments:
        return _empty_analytics(meeting_id)

    # Sentiment breakdown
    total = len(segments)
    pos = sum(1 for s in segments if s.sentiment in ("positive",))
    neg = sum(1 for s in segments if s.sentiment == "negative")
    ques = sum(1 for s in segments if s.sentiment == "questioning")
    neu = total - pos - neg - ques

    sentiment = SentimentBreakdown(
        positive=round(pos / total * 100, 1),
        negative=round(neg / total * 100, 1),
        neutral=round(neu / total * 100, 1),
        questioning=round(ques / total * 100, 1),
    )

    # Top keywords
    full_text = " ".join(s.text for s in segments)
    keywords = extract_keywords(full_text, top_n=20)

    # Topic timeline
    segs_dicts = [{"start": s.start_time, "end": s.end_time, "text": s.text} for s in segments]
    raw_topics = detect_topics(segs_dicts)
    topic_timeline = [
        TopicSegment(
            topic=t["topic"],
            start_time=t["start_time"],
            end_time=t["end_time"],
            keywords=t["keywords"],
        )
        for t in raw_topics
    ]

    # Avg WPM
    wpm_vals = [s.words_per_minute for s in segments if s.words_per_minute]
    avg_wpm = round(sum(wpm_vals) / len(wpm_vals), 1) if wpm_vals else 0.0

    # Silence ratio (gaps between segments)
    if segments and meeting.duration_seconds > 0:
        speech_time = sum(max(0, s.end_time - s.start_time) for s in segments)
        silence_pct = round((1 - speech_time / meeting.duration_seconds) * 100, 1)
    else:
        silence_pct = 0.0

    # Most active speaker
    most_active = None
    if speakers:
        top_spk = max(speakers, key=lambda s: s.talk_time_seconds)
        most_active = top_spk.name or top_spk.label

    # Engagement score (heuristic: % positive + low silence + good WPM spread)
    engagement = min(100.0, round(
        sentiment.positive * 0.5 +
        max(0, 50 - silence_pct) * 0.3 +
        min(50, avg_wpm / 3) * 0.2,
        1,
    ))

    return AnalyticsOut(
        meeting_id=meeting_id,
        sentiment_breakdown=sentiment,
        top_keywords=keywords,
        topic_timeline=topic_timeline,
        avg_wpm=avg_wpm,
        silence_percentage=silence_pct,
        most_active_speaker=most_active,
        engagement_score=engagement,
    )


@router.get("/{meeting_id}/summary", response_model=SummaryOut)
async def get_summary(meeting_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id)
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(404, "Summary not yet generated")
    return summary


@router.get("/{meeting_id}/segments")
async def get_segments(meeting_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Segment).where(Segment.meeting_id == meeting_id).order_by(Segment.start_time)
    )
    segments = result.scalars().all()
    return [
        {
            "id": s.id,
            "speaker_label": s.speaker_label,
            "speaker_name": s.speaker_name,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "text": s.text,
            "sentiment": s.sentiment,
            "sentiment_score": s.sentiment_score,
            "confidence": s.confidence,
        }
        for s in segments
    ]


def _empty_analytics(meeting_id: str) -> AnalyticsOut:
    return AnalyticsOut(
        meeting_id=meeting_id,
        sentiment_breakdown=SentimentBreakdown(positive=0, negative=0, neutral=100, questioning=0),
        top_keywords=[],
        topic_timeline=[],
        avg_wpm=0,
        silence_percentage=0,
        most_active_speaker=None,
        engagement_score=0,
    )
