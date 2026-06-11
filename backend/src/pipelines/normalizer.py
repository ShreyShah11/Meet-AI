"""
Transcript Normalizer
Accepts transcripts from 3 sources and normalizes them into a unified format.

Source types:
  - "whisper"  : dict output from OpenAI Whisper (audio → text)
  - "company"  : plain .txt file with optional Speaker: prefix lines
  - "bot"      : structured JSON from Recall.ai / AssemblyAI bot attendee
"""

from __future__ import annotations
import re
import uuid
from datetime import datetime
from typing import Literal

from utils.models import NormalizedTranscript, TranscriptSegment


SourceType = Literal["whisper", "company", "bot"]


# ──────────────────────────────────────────────
# Public entry point
# ──────────────────────────────────────────────

def normalize(
    raw: dict | str,
    source: SourceType,
    meet_id: str | None = None,
    org_id: str = "default_org",
    meet_title: str = "Untitled Meeting",
    meet_date: str | None = None,
) -> NormalizedTranscript:
    """
    Convert raw transcript from any source into a NormalizedTranscript.

    Args:
        raw        : Raw transcript data.
                     - whisper : dict  (Whisper JSON output)
                     - company : str   (plain text / txt file content)
                     - bot     : dict  (Recall.ai / AssemblyAI JSON)
        source     : One of "whisper", "company", "bot"
        meet_id    : Unique meeting ID. Auto-generated if not supplied.
        org_id     : Your organisation / company ID.
        meet_title : Human-readable meeting title.
        meet_date  : ISO 8601 date string. Defaults to today.

    Returns:
        NormalizedTranscript ready for the chunking pipeline.
    """
    meet_id = meet_id or f"meet_{uuid.uuid4().hex[:12]}"
    meet_date = meet_date or datetime.utcnow().date().isoformat()

    if source == "whisper":
        segments = _from_whisper(raw)
    elif source == "company":
        segments = _from_company_txt(raw)
    elif source == "bot":
        segments = _from_bot(raw)
    else:
        raise ValueError(f"Unknown source type: {source!r}")

    duration = segments[-1].timestamp_end if segments else 0.0

    return NormalizedTranscript(
        meet_id=meet_id,
        org_id=org_id,
        meet_title=meet_title,
        meet_date=meet_date,
        duration_seconds=duration,
        segments=segments,
    )


# ──────────────────────────────────────────────
# Source-specific parsers
# ──────────────────────────────────────────────

def _from_whisper(data: dict) -> list[TranscriptSegment]:
    """
    Parse Whisper JSON output.

    Expected format (whisper_timestamped or openai-whisper with word timestamps):
    {
      "segments": [
        {
          "start": 0.0,
          "end": 4.5,
          "text": "Hello everyone ...",
          "speaker": "SPEAKER_00"       # present if diarization was applied
        },
        ...
      ]
    }
    If no speaker field exists, all segments are labelled "Speaker 1".
    """
    raw_segments = data.get("segments", [])
    if not raw_segments:
        raise ValueError("Whisper output has no 'segments' key.")

    result: list[TranscriptSegment] = []
    for seg in raw_segments:
        text = seg.get("text", "").strip()
        if not text:
            continue
        speaker = seg.get("speaker") or seg.get("spk") or "Speaker 1"
        speaker = _clean_speaker_label(speaker)
        result.append(TranscriptSegment(
            speaker=speaker,
            text=text,
            timestamp_start=float(seg.get("start", 0)),
            timestamp_end=float(seg.get("end", 0)),
        ))

    return _merge_consecutive_speaker_segments(result)


def _from_company_txt(raw: str) -> list[TranscriptSegment]:
    """
    Parse plain-text transcript from a company export.

    Supports two common formats:

    Format A – Speaker-prefixed lines (Google Meet / Zoom export style):
        Alice: Good morning everyone.
        Bob: Thanks for joining.
        Alice: Let's start with the agenda.

    Format B – Timestamped lines (Zoom .txt export style):
        00:00:05 Alice: Good morning everyone.
        00:01:10 Bob: Thanks for joining.

    Format C – No speaker tags at all:
        Good morning everyone. Thanks for joining. Let's start...
        (Entire text becomes one segment under "Speaker 1")
    """
    lines = [l.strip() for l in raw.strip().splitlines() if l.strip()]
    segments: list[TranscriptSegment] = []

    # Detect Format B  → "HH:MM:SS Speaker: text"  or  "MM:SS Speaker: text"
    timestamp_pattern = re.compile(
        r"^(\d{1,2}:\d{2}(?::\d{2})?)\s+([^:]+?):\s+(.+)$"
    )
    # Detect Format A  → "Speaker: text"
    speaker_pattern = re.compile(r"^([^:]{2,40}):\s+(.+)$")

    current_speaker = "Speaker 1"
    current_text_parts: list[str] = []
    current_start = 0.0
    fake_clock = 0.0  # used when no real timestamps exist

    def flush(end_time: float):
        nonlocal current_text_parts
        if current_text_parts:
            segments.append(TranscriptSegment(
                speaker=current_speaker,
                text=" ".join(current_text_parts),
                timestamp_start=current_start,
                timestamp_end=end_time,
            ))
            current_text_parts = []

    for line in lines:
        m_ts = timestamp_pattern.match(line)
        m_sp = speaker_pattern.match(line)

        if m_ts:
            ts_str, speaker, text = m_ts.group(1), m_ts.group(2), m_ts.group(3)
            ts = _parse_timestamp(ts_str)
            flush(ts)
            current_speaker = _clean_speaker_label(speaker)
            current_start = ts
            current_text_parts = [text.strip()]

        elif m_sp:
            speaker, text = m_sp.group(1), m_sp.group(2)
            # Avoid false-positive matches like "e.g.: something"
            if _looks_like_speaker_name(speaker):
                flush(fake_clock)
                fake_clock += 30.0  # fake 30s per speaker turn
                current_speaker = _clean_speaker_label(speaker)
                current_start = fake_clock - 30.0
                current_text_parts = [text.strip()]
            else:
                current_text_parts.append(line)

        else:
            # No speaker tag – just accumulate
            current_text_parts.append(line)

    flush(fake_clock + 30.0)

    return _merge_consecutive_speaker_segments(segments)


def _from_bot(data: dict) -> list[TranscriptSegment]:
    """
    Parse structured JSON from a bot attendee API (Recall.ai / AssemblyAI).

    Recall.ai format:
    {
      "transcript": [
        {
          "speaker": "Alice",
          "words": [
            {"text": "Hello", "start_time": 1.2, "end_time": 1.6},
            ...
          ]
        },
        ...
      ]
    }

    AssemblyAI format:
    {
      "utterances": [
        {
          "speaker": "A",
          "text": "Hello everyone.",
          "start": 1200,    ← milliseconds
          "end":   3800
        },
        ...
      ]
    }
    """
    # Try Recall.ai format first
    if "transcript" in data:
        return _from_recall_ai(data["transcript"])

    # Try AssemblyAI format
    if "utterances" in data:
        return _from_assemblyai(data["utterances"])

    # Generic flat segments fallback
    if "segments" in data:
        return _from_whisper(data)  # same structure

    raise ValueError(
        "Bot transcript JSON must contain 'transcript', 'utterances', "
        "or 'segments' key. Got: " + str(list(data.keys()))
    )


def _from_recall_ai(transcript: list[dict]) -> list[TranscriptSegment]:
    segments: list[TranscriptSegment] = []
    for entry in transcript:
        speaker = _clean_speaker_label(entry.get("speaker", "Unknown"))
        words = entry.get("words", [])
        if not words:
            continue
        text = " ".join(w["text"] for w in words)
        start = float(words[0].get("start_time", 0))
        end = float(words[-1].get("end_time", start))
        segments.append(TranscriptSegment(
            speaker=speaker,
            text=text,
            timestamp_start=start,
            timestamp_end=end,
        ))
    return _merge_consecutive_speaker_segments(segments)


def _from_assemblyai(utterances: list[dict]) -> list[TranscriptSegment]:
    segments: list[TranscriptSegment] = []
    for utt in utterances:
        speaker = _clean_speaker_label(utt.get("speaker", "Unknown"))
        text = utt.get("text", "").strip()
        if not text:
            continue
        # AssemblyAI uses milliseconds
        start = utt.get("start", 0) / 1000.0
        end = utt.get("end", 0) / 1000.0
        segments.append(TranscriptSegment(
            speaker=speaker,
            text=text,
            timestamp_start=start,
            timestamp_end=end,
        ))
    return segments


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _clean_speaker_label(label: str) -> str:
    """
    Normalise raw speaker labels:
      SPEAKER_00  → Speaker 1
      spk_1       → Speaker 2
      Alice Smith → Alice Smith  (unchanged)
    """
    label = label.strip()
    # Whisper diarization labels like SPEAKER_00, spk_01
    m = re.match(r"(?:SPEAKER|spk)[_\s](\d+)", label, re.IGNORECASE)
    if m:
        return f"Speaker {int(m.group(1)) + 1}"
    # AssemblyAI single-letter labels A, B, C
    if re.match(r"^[A-Z]$", label):
        return f"Speaker {ord(label) - ord('A') + 1}"
    return label


def _looks_like_speaker_name(candidate: str) -> bool:
    """
    Heuristic: reject obvious non-names so we don't misparse URLs,
    abbreviations, or colons in normal prose as speaker prefixes.
    """
    if len(candidate) > 40 or len(candidate) < 2:
        return False
    if re.search(r"[.@/\\]", candidate):
        return False
    if candidate.lower() in {"e.g", "i.e", "note", "ps", "re"}:
        return False
    return True


def _parse_timestamp(ts: str) -> float:
    """Convert HH:MM:SS or MM:SS string to seconds float."""
    parts = ts.strip().split(":")
    parts = [float(p) for p in parts]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    elif len(parts) == 2:
        return parts[0] * 60 + parts[1]
    return float(parts[0])


def _merge_consecutive_speaker_segments(
    segments: list[TranscriptSegment],
) -> list[TranscriptSegment]:
    """
    Merge back-to-back segments from the same speaker into one.
    This prevents a single long monologue being split into dozens of tiny chunks.
    """
    if not segments:
        return []

    merged: list[TranscriptSegment] = [segments[0].model_copy()]
    for seg in segments[1:]:
        last = merged[-1]
        if seg.speaker == last.speaker:
            merged[-1] = TranscriptSegment(
                speaker=last.speaker,
                text=last.text + " " + seg.text,
                timestamp_start=last.timestamp_start,
                timestamp_end=seg.timestamp_end,
            )
        else:
            merged.append(seg.model_copy())

    return merged
