import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor

def create_presentation(output_path):
    prs = Presentation()

    # Define Colors (CodeNest Dark Theme)
    BG_COLOR = RGBColor(13, 17, 23)      # Dark Navy/Black
    TEXT_COLOR = RGBColor(230, 237, 243) # Off-white
    ACCENT_COLOR = RGBColor(88, 166, 255) # Bright Blue
    MUTED_COLOR = RGBColor(139, 148, 158) # Gray

    def add_slide(title_text, content_items=None):
        slide_layout = prs.slide_layouts[1] # Title and Content
        slide = prs.slides.add_slide(slide_layout)
        
        # Background
        background = slide.background
        fill = background.fill
        fill.solid()
        fill.fore_color.rgb = BG_COLOR

        # Title
        title = slide.shapes.title
        title.text = title_text
        title_text_frame = title.text_frame
        p = title_text_frame.paragraphs[0]
        p.font.color.rgb = ACCENT_COLOR
        p.font.bold = True
        p.font.size = Pt(44)
        p.alignment = PP_ALIGN.LEFT

        # Content
        if content_items:
            content = slide.placeholders[1]
            tf = content.text_frame
            tf.word_wrap = True
            
            for item in content_items:
                p = tf.add_paragraph()
                p.text = str(item)
                p.font.color.rgb = TEXT_COLOR
                p.font.size = Pt(24)
                p.space_after = Pt(10)
                if item.startswith("-"):
                    p.level = 1
                    p.text = item[1:].strip()
                elif item.startswith("  -"):
                    p.level = 2
                    p.text = item[3:].strip()

        return slide

    # 1. Title Slide
    title_slide_layout = prs.slide_layouts[0]
    slide = prs.slides.add_slide(title_slide_layout)
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = BG_COLOR
    
    title = slide.shapes.title
    subtitle = slide.placeholders[1]
    
    title.text = "MeetMind"
    title.text_frame.paragraphs[0].font.color.rgb = ACCENT_COLOR
    title.text_frame.paragraphs[0].font.size = Pt(64)
    title.text_frame.paragraphs[0].font.bold = True
    
    subtitle.text = "Professional Meeting Intelligence Platform\nTechnical Architecture & AI Pipeline Overview"
    subtitle.text_frame.paragraphs[0].font.color.rgb = TEXT_COLOR
    subtitle.text_frame.paragraphs[0].font.size = Pt(32)

    # 2. System Overview
    add_slide("System Overview", [
        "MeetMind transforms raw audio into actionable meeting intelligence.",
        "- Core Capabilities:",
        "  - Real-time transcription using Faster-Whisper",
        "  - Speaker diarization via pyannote.audio",
        "  - Sentiment & Emotion analysis (SiEBERT)",
        "  - Automated summaries & Action items (Llama 3)"
    ])

    # 3. Technical Stack
    add_slide("Technical Stack", [
        "- Frontend: React 18, Vite, Tailwind CSS, Zustand",
        "- Backend: FastAPI (Python 3.10+), SQLAlchemy (Async)",
        "- Database: SQLite (Metadata) + Redis (Real-time Pub/Sub)",
        "- AI Ecosystem:",
        "  - faster-whisper (STT Optimization)",
        "  - Ollama (Local LLM Serving)",
        "  - Librosa (Audio Analytics)"
    ])

    # 4. AI Engine: Speech-to-Text
    add_slide("AI Engine: Transcription", [
        "- Engine: faster-whisper (large-v3 model)",
        "- Key Advantages:",
        "  - 4x faster than OpenAI's original Whisper",
        "  - int8 quantization for CPU efficiency",
        "  - Integrated VAD (Voice Activity Detection)",
        "- Output: Segments with word-level confidence and timestamps."
    ])

    # 5. AI Engine: Speaker Diarization
    add_slide("AI Engine: Diarization", [
        "- Model: pyannote.audio 3.1",
        "- Goal: Identifying 'Who spoke When'",
        "- Features:",
        "  - Clustering-based speaker identification",
        "  - Overlap detection and resolution",
        "  - Support for multi-speaker meetings (2-10+)",
        "- Fallback: Heuristic energy-based diarizer for low-resource environments."
    ])

    # 6. Real-Time Pipeline
    add_slide("Real-Time Architecture", [
        "- WebSocket Streaming:",
        "  - Binary audio chunks (~3.5s) sent from browser",
        "  - Redis Pub/Sub for multi-client broadcasting",
        "- Processing Flow:",
        "  - Raw Audio -> Temp Buffer -> STT Segment -> WebSocket Push",
        "- UI: Instant transcript updates with <500ms latency."
    ])

    # 7. Sentiment & Intelligence
    add_slide("Meeting Intelligence", [
        "- Sentiment Analysis: SiEBERT roberta-large (converational-tuned)",
        "- Emotion Detection: 7-label classification (Joy, Anger, etc.)",
        "- Audio Analytics: Words Per Minute (WPM), Silence Ratio, Pitch tracking",
        "- Keyword Extraction: Identifying recurring themes via RAKE algorithm."
    ])

    # 8. Post-Meeting Summarization
    add_slide("AI Insights (Llama 3)", [
        "- Model: Meta Llama 3 (8B) via Ollama",
        "- Synthesis Workflow:",
        "  - Context Injection: Full transcript + metadata",
        "  - Custom Prompting: Extractive and abstractive summarization",
        "  - Outcome: Concise summary, key takeaways, and action items with owners."
    ])

    # 9. Deployment & Security
    add_slide("Deployment & Privacy", [
        "- Privacy First: 100% On-Premise / Local execution",
        "- Environment: Docker Compose (Frontend, Backend, Redis, Ollama)",
        "- Optimization: CUDA/GPU support for Whisper and LLM",
        "- Scalability: Vertical scaling with worker processes."
    ])

    # 10. Conclusion
    add_slide("Conclusion & Future", [
        "- MeetMind offers a production-ready meeting intelligence suite.",
        "- Future Roadmap:",
        "  - Team-based workspaces and permissions",
        "  - External integrations (Slack, Jira, Notion)",
        "  - Visual expression analysis in video meetings."
    ])

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    prs.save(output_path)
    print(f"Presentation saved to: {output_path}")

if __name__ == "__main__":
    output = os.path.join(os.getcwd(), "artifacts", "MeetMind_Technical_Overview.pptx")
    create_presentation(output)
