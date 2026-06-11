"""
Chunking Pipeline
=================
Produces three chunk types from a NormalizedTranscript:

  1. Speaker-turn chunks   – one chunk per contiguous speaker block, ≤300 tokens
  2. Semantic chunks       – topic-boundary splits using sentence embeddings, ≤512 tokens
  3. Action-item chunks    – LLM-extracted tasks, one chunk per action item

Run all three in sequence via `chunk_transcript()`.
"""

from __future__ import annotations
import json
import os
import re
from typing import Optional

import numpy as np
import requests
from sentence_transformers import SentenceTransformer

from utils.models import (
    ActionItem,
    ChunkType,
    NormalizedTranscript,
    TranscriptChunk,
    TranscriptSegment,
)
from utils.text_utils import count_tokens, split_by_token_limit

# ── Config ────────────────────────────────────────────────────────────────────

SPEAKER_MAX_TOKENS = 300
SPEAKER_OVERLAP_TOKENS = 30
SEMANTIC_MAX_TOKENS = 512
SEMANTIC_OVERLAP_TOKENS = 64
TOPIC_SPLIT_THRESHOLD = 0.75     # cosine similarity drop triggers a new topic
SENTENCE_MODEL = "all-MiniLM-L6-v2"   # fast, 384-dim, runs locally
ACTION_EXTRACTION_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

_sentence_model: Optional[SentenceTransformer] = None


def _get_sentence_model() -> SentenceTransformer:
    global _sentence_model
    if _sentence_model is None:
        _sentence_model = SentenceTransformer(SENTENCE_MODEL)
    return _sentence_model


def _generate_with_gemini(prompt: str) -> str:
    api_key = os.environ["GEMINI_API_KEY"]
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{ACTION_EXTRACTION_MODEL}:generateContent"
    )
    response = requests.post(
        url,
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        json={
            "systemInstruction": {"parts": [{"text": _ACTION_SYSTEM_PROMPT}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0, "maxOutputTokens": 1500},
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return "".join(
        part.get("text", "")
        for part in data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    ).strip()


# ── Public entry point ────────────────────────────────────────────────────────

def chunk_transcript(transcript: NormalizedTranscript) -> list[TranscriptChunk]:
    """
    Run all three chunkers and return a combined, deduplicated chunk list.

    Order in the returned list:
      speaker-turn chunks → semantic chunks → action-item chunks
    """
    speaker_chunks = _speaker_turn_chunks(transcript)
    semantic_chunks = _semantic_chunks(transcript)
    action_chunks = _action_item_chunks(transcript)

    all_chunks = speaker_chunks + semantic_chunks + action_chunks

    # Re-index chunk_index globally
    for i, chunk in enumerate(all_chunks):
        chunk.chunk_index = i

    print(
        f"[chunker] {transcript.meet_id}: "
        f"{len(speaker_chunks)} speaker | "
        f"{len(semantic_chunks)} semantic | "
        f"{len(action_chunks)} action-item chunks"
    )
    return all_chunks


# ── 1. Speaker-turn chunker ───────────────────────────────────────────────────

def _speaker_turn_chunks(transcript: NormalizedTranscript) -> list[TranscriptChunk]:
    """
    One chunk per speaker turn. Long turns are split at sentence boundaries
    with SPEAKER_OVERLAP_TOKENS of overlap. Best for "what did Alice say" queries.
    """
    chunks: list[TranscriptChunk] = []
    idx = 0

    for seg in transcript.segments:
        sub_texts = split_by_token_limit(
            seg.text,
            max_tokens=SPEAKER_MAX_TOKENS,
            overlap_tokens=SPEAKER_OVERLAP_TOKENS,
        )
        for sub in sub_texts:
            chunks.append(TranscriptChunk(
                chunk_id=f"{transcript.meet_id}_speaker_{idx}",
                meet_id=transcript.meet_id,
                org_id=transcript.org_id,
                chunk_type=ChunkType.SPEAKER_TURN,
                text=sub,
                speaker=seg.speaker,
                timestamp_start=seg.timestamp_start,
                timestamp_end=seg.timestamp_end,
                action_flag=False,
                chunk_index=idx,
            ))
            idx += 1

    return chunks


# ── 2. Semantic chunker ───────────────────────────────────────────────────────

def _semantic_chunks(transcript: NormalizedTranscript) -> list[TranscriptChunk]:
    """
    Split transcript on topic boundaries detected via cosine-similarity drops
    between consecutive sentence embeddings. Each topic window is then split
    into ≤512-token sub-chunks with overlap. Best for "what was discussed
    about X" queries.
    """
    # Flatten all segments to (sentence, timestamp_start, timestamp_end)
    sentences: list[tuple[str, float, float]] = []
    for seg in transcript.segments:
        for sent in _split_sentences(seg.text):
            sentences.append((sent, seg.timestamp_start, seg.timestamp_end))

    if not sentences:
        return []

    texts = [s[0] for s in sentences]
    model = _get_sentence_model()
    embeddings = model.encode(texts, batch_size=64, show_progress_bar=False)

    # Compute cosine similarities between consecutive sentences
    sims = _cosine_similarities(embeddings)

    # Identify topic boundaries where similarity drops below threshold
    boundaries: list[int] = [0]
    for i, sim in enumerate(sims):
        if sim < TOPIC_SPLIT_THRESHOLD:
            boundaries.append(i + 1)
    boundaries.append(len(sentences))

    chunks: list[TranscriptChunk] = []
    idx = 0

    for b_start, b_end in zip(boundaries, boundaries[1:]):
        window = sentences[b_start:b_end]
        if not window:
            continue

        window_text = " ".join(w[0] for w in window)
        topic_label = _detect_topic_label(window_text)
        ts_start = window[0][1]
        ts_end = window[-1][2]

        sub_texts = split_by_token_limit(
            window_text,
            max_tokens=SEMANTIC_MAX_TOKENS,
            overlap_tokens=SEMANTIC_OVERLAP_TOKENS,
        )
        for sub in sub_texts:
            chunks.append(TranscriptChunk(
                chunk_id=f"{transcript.meet_id}_semantic_{idx}",
                meet_id=transcript.meet_id,
                org_id=transcript.org_id,
                chunk_type=ChunkType.SEMANTIC,
                text=sub,
                speaker=None,
                timestamp_start=ts_start,
                timestamp_end=ts_end,
                topic_label=topic_label,
                action_flag=False,
                chunk_index=idx,
            ))
            idx += 1

    return chunks


def _cosine_similarities(embeddings: np.ndarray) -> list[float]:
    """Return cosine similarity between each consecutive pair of embeddings."""
    sims: list[float] = []
    for i in range(len(embeddings) - 1):
        a, b = embeddings[i], embeddings[i + 1]
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            sims.append(1.0)
        else:
            sims.append(float(np.dot(a, b) / (norm_a * norm_b)))
    return sims


def _detect_topic_label(text: str) -> str:
    """
    Very lightweight keyword-based topic label. No LLM call – instant.
    You can replace this with an LLM call for higher accuracy.
    """
    keywords_map = {
        "budget": ["budget", "cost", "expense", "spend", "financial", "revenue", "pricing"],
        "roadmap": ["roadmap", "feature", "milestone", "sprint", "release", "deadline", "timeline"],
        "hiring": ["hire", "hiring", "interview", "candidate", "onboarding", "recruit"],
        "blockers": ["blocked", "blocker", "issue", "problem", "stuck", "dependency"],
        "action_items": ["action item", "follow up", "todo", "task", "assign", "will do", "responsible"],
        "design": ["design", "ui", "ux", "mockup", "wireframe", "prototype", "figma"],
        "engineering": ["code", "deploy", "bug", "pr", "pull request", "pipeline", "infra", "api"],
        "marketing": ["campaign", "launch", "ads", "brand", "seo", "content", "marketing"],
    }
    lower = text.lower()
    scores: dict[str, int] = {}
    for label, kws in keywords_map.items():
        scores[label] = sum(lower.count(kw) for kw in kws)

    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else "general"


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences."""
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


# ── 3. Action-item chunker ────────────────────────────────────────────────────

_ACTION_SYSTEM_PROMPT = """
You are an expert meeting analyst. Extract ALL action items from the transcript text.
For each action item return a JSON array. Each element must have:
  - "owner"            : person responsible (string or null if unspecified)
  - "task"             : the action to be done (string, concise)
  - "deadline"         : deadline if mentioned (string or null)
  - "context_sentence" : the exact sentence from the transcript that contains this action item

Return ONLY valid JSON array, no markdown, no explanation.
Example: [{"owner": "Alice", "task": "Share Q3 report", "deadline": "Friday", "context_sentence": "Alice will share the Q3 report by Friday."}]
If there are no action items return an empty array: []
""".strip()


def _action_item_chunks(transcript: NormalizedTranscript) -> list[TranscriptChunk]:
    """
    Use an LLM to extract action items from the full transcript.
    Each action item becomes its own tiny chunk with action_flag=True.
    These are indexed separately so "what are my tasks?" queries hit them directly.
    """
    full_text = "\n".join(
        f"{seg.speaker}: {seg.text}" for seg in transcript.segments
    )

    # Call LLM to extract action items
    action_items = _extract_action_items_via_llm(full_text)
    if not action_items:
        return []

    chunks: list[TranscriptChunk] = []
    # Build a timestamp lookup: sentence → approximate timestamp
    ts_map = _build_sentence_timestamp_map(transcript.segments)

    for idx, item in enumerate(action_items):
        # Try to find the timestamp for this context sentence
        ts = ts_map.get(item.context_sentence[:40], None)

        # Construct chunk text: structured fields + context for semantic search
        chunk_text = (
            f"Action item: {item.task}\n"
            f"Owner: {item.owner or 'Unassigned'}\n"
            f"Deadline: {item.deadline or 'Not specified'}\n"
            f"Context: {item.context_sentence}"
        )

        chunks.append(TranscriptChunk(
            chunk_id=f"{transcript.meet_id}_action_{idx}",
            meet_id=transcript.meet_id,
            org_id=transcript.org_id,
            chunk_type=ChunkType.ACTION_ITEM,
            text=chunk_text,
            speaker=item.owner,
            timestamp_start=ts,
            timestamp_end=ts,
            topic_label="action_items",
            action_flag=True,
            chunk_index=idx,
        ))

    return chunks


def _extract_action_items_via_llm(full_text: str) -> list[ActionItem]:
    """Call LLM and parse response into ActionItem list."""
    # Truncate to ~6000 tokens to stay within context limits
    if count_tokens(full_text) > 6000:
        encoded = full_text.encode()
        full_text = full_text[:24000]  # rough char limit

    try:
        raw_json = _generate_with_gemini(full_text)
        # Strip accidental markdown fences
        raw_json = re.sub(r"^```(?:json)?|```$", "", raw_json, flags=re.MULTILINE).strip()
        items_data = json.loads(raw_json)
        return [ActionItem(**item) for item in items_data]
    except Exception as e:
        print(f"[action extractor] LLM call failed: {e}")
        return []


def _build_sentence_timestamp_map(segments: list[TranscriptSegment]) -> dict[str, float]:
    """Map first 40 chars of each sentence to its approximate timestamp."""
    mapping: dict[str, float] = {}
    for seg in segments:
        for sent in _split_sentences(seg.text):
            key = sent[:40]
            if key not in mapping:
                mapping[key] = seg.timestamp_start
    return mapping
