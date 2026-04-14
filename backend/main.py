from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from db.database import init_db
from routers import meetings, transcribe, websocket, analytics, export, auth, realtime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting MeetMind backend...")
    await init_db()
    yield
    logger.info("Shutting down MeetMind backend...")


app = FastAPI(
    title="MeetMind API",
    description="Professional Meeting Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meetings.router, prefix="/api/meetings", tags=["Meetings"])
app.include_router(transcribe.router, prefix="/api/transcribe", tags=["Transcribe"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(realtime.router, tags=["Live Stream"])
app.include_router(websocket.router, tags=["WebSocket"])


@app.get("/")
def root():
    return {"status": "ok", "service": "MeetMind API v1.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}
