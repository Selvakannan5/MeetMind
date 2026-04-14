"""
Export meeting reports as PDF or DOCX.
"""
import io
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from db.database import get_db
from db.models import User, Meeting, Segment, Speaker, MeetingSummary, ActionItem
from routers.auth import get_current_user, get_current_user_ws

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/{meeting_id}/pdf")
async def export_pdf(meeting_id: str, token: str = None, db: AsyncSession = Depends(get_db)):
    current_user = await get_current_user_ws(token, db) if token else None
    if not current_user:
        try:
            # Fallback if accessed via swagger with Bearer token header
            from fastapi import Request
            from routers.auth import oauth2_scheme, get_current_user
        except ImportError: pass
        raise HTTPException(401, "Not authenticated")
    data = await _gather_data(meeting_id, current_user, db)

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        )

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4,
                                leftMargin=2*cm, rightMargin=2*cm,
                                topMargin=2*cm, bottomMargin=2*cm)
        styles = getSampleStyleSheet()
        story = []

        # Title
        title_style = ParagraphStyle("Title", parent=styles["Title"],
                                     fontSize=22, spaceAfter=6, textColor=colors.HexColor("#1a1a2e"))
        story.append(Paragraph(data["title"], title_style))
        story.append(Paragraph(
            f"<font color='#666666' size='10'>{data['date']}  ·  {data['duration']}  ·  {data['participant_count']} participants</font>",
            styles["Normal"]
        ))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#dddddd"), spaceAfter=12))

        heading = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, spaceAfter=4, textColor=colors.HexColor("#2d2d5e"))

        # Summary
        if data["summary"]:
            story.append(Paragraph("Meeting Summary", heading))
            story.append(Paragraph(data["summary"], styles["Normal"]))
            story.append(Spacer(1, 12))

        # Key points
        if data["key_points"]:
            story.append(Paragraph("Key Discussion Points", heading))
            for kp in data["key_points"]:
                story.append(Paragraph(f"• {kp}", styles["Normal"]))
            story.append(Spacer(1, 12))

        # Action items
        if data["action_items"]:
            story.append(Paragraph("Action Items", heading))
            table_data = [["Task", "Owner", "Deadline", "Priority", "Status"]]
            for ai in data["action_items"]:
                table_data.append([
                    ai["task"][:60] + ("..." if len(ai["task"]) > 60 else ""),
                    ai["owner"] or "—",
                    ai["deadline"] or "—",
                    ai["priority"].title(),
                    "✓ Done" if ai["done"] else "Open",
                ])
            t = Table(table_data, colWidths=[7*cm, 3*cm, 3*cm, 2*cm, 2*cm])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2d2d5e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8f8ff"), colors.white]),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#dddddd")),
                ("PADDING", (0, 0), (-1, -1), 4),
            ]))
            story.append(t)
            story.append(Spacer(1, 12))

        # Speaker stats
        if data["speakers"]:
            story.append(Paragraph("Speaker Statistics", heading))
            spk_data = [["Speaker", "Talk Time", "Talk %", "WPM", "Turns", "Sentiment"]]
            for spk in data["speakers"]:
                spk_data.append([
                    spk["name"] or spk["label"],
                    f"{int(spk['talk_time_seconds']//60)}m {int(spk['talk_time_seconds']%60)}s",
                    f"{spk['talk_percentage']}%",
                    str(spk["avg_wpm"]),
                    str(spk["turn_count"]),
                    spk["dominant_sentiment"] or "—",
                ])
            t = Table(spk_data, colWidths=[4*cm, 3*cm, 2*cm, 2*cm, 2*cm, 4*cm])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2d2d5e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8f8ff"), colors.white]),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#dddddd")),
                ("PADDING", (0, 0), (-1, -1), 4),
            ]))
            story.append(t)
            story.append(Spacer(1, 12))

        # Transcript excerpt
        if data["segments"]:
            story.append(Paragraph("Transcript", heading))
            for seg in data["segments"][:60]:  # First 60 segments
                spk_name = seg["speaker_name"] or seg["speaker_label"] or "Unknown"
                ts = _fmt_time(seg["start_time"])
                story.append(Paragraph(
                    f"<font color='#444488'><b>[{ts}] {spk_name}</b></font>  {seg['text']}",
                    styles["Normal"]
                ))
                story.append(Spacer(1, 3))

        doc.build(story)
        buf.seek(0)
        filename = f"meetmind_{meeting_id[:8]}.pdf"
        return StreamingResponse(buf, media_type="application/pdf",
                                 headers={"Content-Disposition": f'attachment; filename="{filename}"'})

    except ImportError:
        raise HTTPException(500, "reportlab not installed. Run: pip install reportlab")


@router.get("/{meeting_id}/json")
async def export_json(meeting_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Export full meeting data as JSON."""
    data = await _gather_data(meeting_id, current_user, db)
    return data


async def _gather_data(meeting_id: str, current_user: User, db: AsyncSession) -> dict:
    meeting = await db.get(Meeting, meeting_id)
    if not meeting or meeting.user_id != current_user.id:
        raise HTTPException(404, "Meeting not found")

    seg_result = await db.execute(
        select(Segment).where(Segment.meeting_id == meeting_id).order_by(Segment.start_time)
    )
    segments = seg_result.scalars().all()

    spk_result = await db.execute(
        select(Speaker).where(Speaker.meeting_id == meeting_id)
    )
    speakers = spk_result.scalars().all()

    summary_result = await db.execute(
        select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id)
    )
    summary = summary_result.scalar_one_or_none()

    ai_result = await db.execute(
        select(ActionItem).where(ActionItem.meeting_id == meeting_id)
    )
    action_items = ai_result.scalars().all()

    duration_secs = meeting.duration_seconds or 0
    duration_str = f"{int(duration_secs//3600)}h {int((duration_secs%3600)//60)}m {int(duration_secs%60)}s"

    return {
        "id": meeting.id,
        "title": meeting.title,
        "status": meeting.status,
        "date": meeting.started_at.strftime("%B %d, %Y %H:%M") if meeting.started_at else "",
        "duration": duration_str,
        "duration_seconds": duration_secs,
        "participant_count": meeting.participant_count,
        "word_count": meeting.word_count,
        "summary": summary.overview if summary else None,
        "key_points": summary.key_points if summary else [],
        "topics": summary.topics if summary else [],
        "decisions": summary.decisions if summary else [],
        "action_items": [
            {
                "task": ai.task, "owner": ai.owner, "deadline": ai.deadline,
                "priority": ai.priority, "done": ai.done,
            }
            for ai in action_items
        ],
        "speakers": [
            {
                "label": s.label, "name": s.name, "role": s.role,
                "talk_time_seconds": s.talk_time_seconds,
                "talk_percentage": s.talk_percentage,
                "word_count": s.word_count,
                "avg_wpm": s.avg_wpm,
                "turn_count": s.turn_count,
                "dominant_sentiment": s.dominant_sentiment,
                "positive_pct": s.positive_pct,
                "negative_pct": s.negative_pct,
                "neutral_pct": s.neutral_pct,
            }
            for s in speakers
        ],
        "segments": [
            {
                "speaker_label": s.speaker_label, "speaker_name": s.speaker_name,
                "start_time": s.start_time, "end_time": s.end_time,
                "text": s.text, "sentiment": s.sentiment,
            }
            for s in segments
        ],
    }


def _fmt_time(secs: float) -> str:
    secs = int(secs)
    return f"{secs//3600:02d}:{(secs%3600)//60:02d}:{secs%60:02d}"
