from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List
from datetime import datetime

from db.database import get_db
from db.models import Meeting, Speaker, Segment, MeetingSummary, ActionItem
from models.schemas import MeetingCreate, MeetingOut, SpeakerOut, SpeakerUpdate, ActionItemOut, ActionItemUpdate

router = APIRouter()


@router.post("/", response_model=MeetingOut)
async def create_meeting(data: MeetingCreate, db: AsyncSession = Depends(get_db)):
    meeting = Meeting(title=data.title, status="live")
    db.add(meeting)
    await db.flush()
    await db.refresh(meeting)
    return meeting


@router.get("/", response_model=List[MeetingOut])
async def list_meetings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Meeting).order_by(desc(Meeting.started_at)).limit(50))
    return result.scalars().all()


@router.get("/{meeting_id}", response_model=MeetingOut)
async def get_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    return meeting


@router.post("/{meeting_id}/end")
async def end_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    meeting.status = "processing"
    meeting.ended_at = datetime.utcnow()
    if meeting.started_at:
        meeting.duration_seconds = (meeting.ended_at - meeting.started_at).total_seconds()
    return {"status": "ok", "duration_seconds": meeting.duration_seconds}


@router.get("/{meeting_id}/speakers", response_model=List[SpeakerOut])
async def get_speakers(meeting_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Speaker).where(Speaker.meeting_id == meeting_id)
    )
    return result.scalars().all()


@router.patch("/{meeting_id}/speakers/{speaker_id}", response_model=SpeakerOut)
async def update_speaker(
    meeting_id: str,
    speaker_id: str,
    data: SpeakerUpdate,
    db: AsyncSession = Depends(get_db),
):
    speaker = await db.get(Speaker, speaker_id)
    if not speaker or speaker.meeting_id != meeting_id:
        raise HTTPException(404, "Speaker not found")
    if data.name is not None:
        speaker.name = data.name
    if data.role is not None:
        speaker.role = data.role
    return speaker


@router.get("/{meeting_id}/action-items", response_model=List[ActionItemOut])
async def get_action_items(meeting_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ActionItem).where(ActionItem.meeting_id == meeting_id)
    )
    return result.scalars().all()


@router.patch("/{meeting_id}/action-items/{item_id}", response_model=ActionItemOut)
async def update_action_item(
    meeting_id: str,
    item_id: str,
    data: ActionItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(ActionItem, item_id)
    if not item or item.meeting_id != meeting_id:
        raise HTTPException(404, "Action item not found")
    if data.done is not None:
        item.done = data.done
    if data.owner is not None:
        item.owner = data.owner
    if data.deadline is not None:
        item.deadline = data.deadline
    if data.priority is not None:
        item.priority = data.priority
    return item
