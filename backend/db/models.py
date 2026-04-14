from sqlalchemy import Column, String, Float, Integer, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from db.database import Base


def gen_id():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    meetings = relationship("Meeting", back_populates="user", cascade="all, delete")


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    status = Column(String, default="live")  # live | processing | done
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, default=0)
    audio_path = Column(String, nullable=True)
    participant_count = Column(Integer, default=0)
    word_count = Column(Integer, default=0)

    user = relationship("User", back_populates="meetings")
    segments = relationship("Segment", back_populates="meeting", cascade="all, delete")
    speakers = relationship("Speaker", back_populates="meeting", cascade="all, delete")
    summary = relationship("MeetingSummary", back_populates="meeting", uselist=False, cascade="all, delete")
    action_items = relationship("ActionItem", back_populates="meeting", cascade="all, delete")


class Segment(Base):
    __tablename__ = "segments"

    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False)
    speaker_label = Column(String, nullable=True)
    speaker_name = Column(String, nullable=True)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    text = Column(Text, nullable=False)
    sentiment = Column(String, nullable=True)
    sentiment_score = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    words_per_minute = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="segments")


class Speaker(Base):
    __tablename__ = "speakers"

    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False)
    label = Column(String, nullable=False)       # SPEAKER_00, SPEAKER_01 ...
    name = Column(String, nullable=True)          # human-assigned name
    role = Column(String, nullable=True)
    talk_time_seconds = Column(Float, default=0)
    talk_percentage = Column(Float, default=0)
    word_count = Column(Integer, default=0)
    avg_wpm = Column(Float, default=0)
    turn_count = Column(Integer, default=0)
    avg_sentiment_score = Column(Float, default=0)
    dominant_sentiment = Column(String, nullable=True)
    positive_pct = Column(Float, default=0)
    negative_pct = Column(Float, default=0)
    neutral_pct = Column(Float, default=0)
    embedding = Column(JSON, nullable=True)       # stored for re-identification

    meeting = relationship("Meeting", back_populates="speakers")


class MeetingSummary(Base):
    __tablename__ = "meeting_summaries"

    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False, unique=True)
    short_topic = Column(String, nullable=True)
    overview = Column(Text, nullable=True)
    key_points = Column(JSON, default=list)
    topics = Column(JSON, default=list)
    decisions = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="summary")


class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False)
    task = Column(Text, nullable=False)
    owner = Column(String, nullable=True)
    deadline = Column(String, nullable=True)
    priority = Column(String, default="medium")   # low | medium | high
    done = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="action_items")
