# MeetMind 🎙

**Professional Meeting Intelligence Platform**

Live transcription · Speaker diarization · Sentiment analysis · Auto-summary · Analytics dashboard

---

## Features

| Feature | Tool | Notes |
|---|---|---|
| Speech-to-text | faster-whisper large-v3 | 4× faster than Whisper, int8 CPU |
| Speaker diarization | pyannote.audio 3.1 | SOTA, free HuggingFace token |
| Speaker ID | SpeechBrain | Persistent embeddings |
| Sentiment | SiEBERT roberta-large | Per-utterance, real conversation tuned |
| Summary + Actions | Llama 3 via Ollama | Fully local, no API cost |
| Audio stats | Librosa | WPM, pitch, silence ratio |
| Live streaming | WebSocket + Redis pub/sub | Multi-client broadcast |
| Export | PDF (reportlab) + JSON | Full meeting report |

---

## Project Structure

```
meetmind/
├── backend/
│   ├── main.py                     # FastAPI app entry point
│   ├── db/
│   │   ├── database.py             # SQLAlchemy async engine + session
│   │   └── models.py               # Meeting, Segment, Speaker, Summary, ActionItem
│   ├── models/
│   │   └── schemas.py              # Pydantic request/response schemas
│   ├── routers/
│   │   ├── meetings.py             # CRUD for meetings, speakers, action items
│   │   ├── transcribe.py           # File upload + full processing pipeline
│   │   ├── websocket.py            # Live audio WebSocket endpoint
│   │   ├── analytics.py            # Analytics + summary endpoints
│   │   └── export.py               # PDF / JSON export
│   └── services/
│       ├── transcriber.py          # faster-whisper STT
│       ├── diarizer.py             # pyannote speaker diarization
│       ├── sentiment.py            # SiEBERT sentiment + emotion
│       ├── summarizer.py           # Ollama/Llama3 summarization
│       ├── audio_stats.py          # Librosa analytics + keyword extraction
│       └── ws_manager.py           # WebSocket connection manager + Redis pub/sub
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── MeetingsPage.jsx    # Home — list/create meetings
│       │   └── DashboardPage.jsx   # Main meeting dashboard
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   ├── TopBar.jsx          # Timer, record button, export
│       │   ├── TabBar.jsx          # Tab navigation
│       │   ├── LivePanel.jsx       # Live transcript + stats grid
│       │   ├── SummaryPanel.jsx    # Summary, key points, action items
│       │   ├── SpeakersPanel.jsx   # Speaker bars + radar chart
│       │   ├── SentimentPanel.jsx  # Sentiment charts + keyword cloud
│       │   ├── UploadPanel.jsx     # File upload with pipeline progress
│       │   └── RightPanel.jsx      # Waveform, topic flow, notes
│       ├── hooks/
│       │   ├── useWebSocket.js     # Live audio streaming hook
│       │   └── useMeeting.js       # Data loading + polling hook
│       └── utils/
│           ├── api.js              # Axios API helpers
│           └── store.js            # Zustand global state
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Quick Start (Docker — recommended)

```bash
# 1. Clone and configure
git clone <repo> && cd meetmind
cp .env.example .env
# Edit .env: add your HF_TOKEN for diarization

# 2. Pull Ollama model (run once)
docker compose run --rm ollama ollama pull llama3

# 3. Start everything
docker compose up --build

# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

---

## Quick Start (Local Development)

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install ffmpeg (required for audio processing)
# macOS:   brew install ffmpeg
# Ubuntu:  sudo apt install ffmpeg
# Windows: https://ffmpeg.org/download.html

# Copy and configure env
cp ../.env.example .env   # then edit .env

# Run
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

npm install

# Set API URL
echo "VITE_API_URL=http://localhost:8000" > .env

npm run dev   # http://localhost:3000
```

### Ollama (for summarization)

```bash
# Install Ollama: https://ollama.com
curl -fsSL https://ollama.com/install.sh | sh

# Pull model (one time, ~4GB)
ollama pull llama3

# Ollama runs automatically on http://localhost:11434
```

### Redis (optional — for multi-client live broadcast)

```bash
# macOS:   brew install redis && brew services start redis
# Ubuntu:  sudo apt install redis-server && sudo systemctl start redis
# Docker:  docker run -d -p 6379:6379 redis:alpine
```

---

## WebSocket Protocol

```
Client → Server:  Binary audio chunks (WebM/WAV, ~3s each)
Server → Client:  JSON messages

Segment message:
{
  "type": "segment",
  "meeting_id": "uuid",
  "segment_id": "uuid",
  "speaker_label": "SPEAKER_00",
  "speaker_name": "John Smith",
  "start_time": 12.4,
  "end_time": 15.8,
  "text": "We need to ship this by Friday.",
  "sentiment": "positive",
  "sentiment_score": 0.87,
  "confidence": 0.94,
  "is_partial": false
}
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| POST | `/api/meetings/` | Create meeting |
| GET  | `/api/meetings/` | List all meetings |
| GET  | `/api/meetings/{id}` | Get meeting |
| POST | `/api/meetings/{id}/end` | End meeting |
| GET  | `/api/meetings/{id}/speakers` | Get speakers |
| PATCH| `/api/meetings/{id}/speakers/{sid}` | Rename speaker |
| GET  | `/api/meetings/{id}/action-items` | Get action items |
| PATCH| `/api/meetings/{id}/action-items/{iid}` | Toggle/update action item |
| POST | `/api/transcribe/upload/{id}` | Upload audio file |
| GET  | `/api/transcribe/status/{id}` | Processing status |
| GET  | `/api/analytics/{id}` | Full analytics |
| GET  | `/api/analytics/{id}/summary` | Meeting summary |
| GET  | `/api/analytics/{id}/segments` | All segments |
| GET  | `/api/export/{id}/pdf` | Download PDF report |
| GET  | `/api/export/{id}/json` | Full JSON export |
| WS   | `/ws/{meeting_id}` | Live audio input |
| WS   | `/ws/{meeting_id}/listen` | Dashboard listener |

Full interactive docs at: **http://localhost:8000/docs**

---

## Model Accuracy vs Speed Tradeoffs

| Whisper Model | VRAM / RAM | Speed (1hr audio) | WER |
|---|---|---|---|
| base | 1 GB | ~3 min | Good |
| small | 2 GB | ~5 min | Better |
| medium | 5 GB | ~10 min | Great |
| large-v3 | 10 GB | ~20 min (CPU) | Best |

Set `WHISPER_MODEL` in `.env` to your preference.

---

## Production Checklist

- [ ] Switch `DATABASE_URL` to PostgreSQL
- [ ] Set `WHISPER_MODEL=large-v3` + `WHISPER_DEVICE=cuda` (GPU)
- [ ] Add `HF_TOKEN` for real pyannote diarization
- [ ] Set a strong secret for any auth layer
- [ ] Enable HTTPS via reverse proxy (Caddy/nginx)
- [ ] Set `REDIS_URL` to a managed Redis (e.g. Upstash)
- [ ] Deploy Ollama with GPU for fast summarization
