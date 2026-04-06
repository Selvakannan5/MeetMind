"""
WebSocket connection manager with optional Redis pub/sub.
Handles live audio streaming and broadcasting transcript updates.
"""
import asyncio
import json
import logging
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections per meeting room."""

    def __init__(self):
        # meeting_id -> set of connected websockets
        self.rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, meeting_id: str):
        await websocket.accept()
        if meeting_id not in self.rooms:
            self.rooms[meeting_id] = set()
        self.rooms[meeting_id].add(websocket)
        logger.info(f"Client connected to meeting {meeting_id}. Total: {len(self.rooms[meeting_id])}")

    def disconnect(self, websocket: WebSocket, meeting_id: str):
        if meeting_id in self.rooms:
            self.rooms[meeting_id].discard(websocket)
            if not self.rooms[meeting_id]:
                del self.rooms[meeting_id]
        logger.info(f"Client disconnected from meeting {meeting_id}")

    async def broadcast(self, meeting_id: str, message: dict, exclude: WebSocket = None):
        """Send JSON message to all clients in a meeting room."""
        if meeting_id not in self.rooms:
            return
        disconnected = set()
        payload = json.dumps(message)
        for ws in list(self.rooms[meeting_id]):
            if ws is exclude:
                continue
            try:
                await ws.send_text(payload)
            except Exception:
                disconnected.add(ws)
        for ws in disconnected:
            self.rooms[meeting_id].discard(ws)

    async def send_personal(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.warning(f"Failed to send personal message: {e}")

    def room_size(self, meeting_id: str) -> int:
        return len(self.rooms.get(meeting_id, set()))


# Global singleton
manager = ConnectionManager()


# ── Optional Redis pub/sub ─────────────────────────────────────────────────────

class RedisBroadcaster:
    """
    Bridges Redis pub/sub to WebSocket broadcast.
    Use this when you have multiple backend workers — all workers
    publish to Redis, and all WS connections receive via subscription.
    """

    def __init__(self):
        self._redis = None
        self._pubsub = None
        self._listen_tasks: Dict[str, asyncio.Task] = {}

    async def connect(self):
        try:
            import redis.asyncio as redis
            import os
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            self._redis = redis.from_url(redis_url)
            await self._redis.ping()
            logger.info("Redis connected")
        except Exception as e:
            logger.warning(f"Redis not available: {e} — using in-memory broadcast only")
            self._redis = None

    async def publish(self, meeting_id: str, message: dict):
        if self._redis is None:
            # Fallback to direct in-memory broadcast
            await manager.broadcast(meeting_id, message)
            return
        channel = f"meeting:{meeting_id}"
        try:
            await self._redis.publish(channel, json.dumps(message))
        except Exception as e:
            logger.warning(f"Redis publish failed: {e}")
            await manager.broadcast(meeting_id, message)

    async def subscribe(self, meeting_id: str):
        if self._redis is None:
            return
        if meeting_id in self._listen_tasks:
            return
        task = asyncio.create_task(self._listen(meeting_id))
        self._listen_tasks[meeting_id] = task

    async def _listen(self, meeting_id: str):
        try:
            pubsub = self._redis.pubsub()
            channel = f"meeting:{meeting_id}"
            await pubsub.subscribe(channel)
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    await manager.broadcast(meeting_id, data)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Redis listener error for {meeting_id}: {e}")
        finally:
            self._listen_tasks.pop(meeting_id, None)

    async def unsubscribe(self, meeting_id: str):
        task = self._listen_tasks.pop(meeting_id, None)
        if task:
            task.cancel()


broadcaster = RedisBroadcaster()
