"""
Retrieval Pipeline
==================
Given an employee's natural-language query and a meet_id, returns the
most relevant transcript chunks using:

  1. Query embedding         → Gemini text-embedding-004
  2. Pinecone ANN search     → top-k candidates from the meeting's index
  3. Cross-encoder re-ranking → re-order by true relevance
  4. Formatted context string → ready for LLM RAG prompt

Each meeting has its own Pinecone index, so all searches are already
scoped to one meeting — no metadata filters needed.

Usage:
    from retrieval.retriever import retrieve, build_rag_context

    chunks = retrieve(
        query="What action items were assigned to Priya?",
        meet_id="meet_2025_06_11_abc123",
    )
    context = build_rag_context(chunks)
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import requests
from pinecone import Pinecone

try:
    from sentence_transformers import CrossEncoder
except ImportError:  # Optional reranker dependency; retrieval can fall back to vector scores.
    CrossEncoder = None

# ── Config ────────────────────────────────────────────────────────────────────

EMBEDDING_MODEL      = os.environ.get("GEMINI_EMBEDDING_MODEL", "text-embedding-004")
EMBEDDING_DIM        = int(os.environ.get("GEMINI_EMBEDDING_DIMENSION", "768"))
RERANKER_MODEL       = "cross-encoder/ms-marco-MiniLM-L-6-v2"  # ~80 MB, runs locally
TOP_K_FETCH          = 20   # candidates pulled from Pinecone before re-ranking
TOP_K_RETURN         = 8    # final chunks handed to the LLM

_pinecone_client: Optional[Pinecone] = None
_reranker: Optional[CrossEncoder]    = None


# ── Lazy singletons ───────────────────────────────────────────────────────────

def _get_pinecone() -> Pinecone:
    global _pinecone_client
    if _pinecone_client is None:
        _pinecone_client = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    return _pinecone_client


def _get_reranker() -> CrossEncoder:
    global _reranker
    if CrossEncoder is None:
        raise ImportError("sentence_transformers is not installed")
    if _reranker is None:
        _reranker = CrossEncoder(RERANKER_MODEL)
    return _reranker


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class RetrievedChunk:
    chunk_id:        str
    text:            str
    chunk_type:      str
    speaker:         Optional[str]
    timestamp_start: Optional[float]
    timestamp_end:   Optional[float]
    topic_label:     Optional[str]
    action_flag:     bool
    score:           float   # cross-encoder score  (higher = more relevant)
    vector_score:    float   # raw Pinecone cosine score


# ── Public API ────────────────────────────────────────────────────────────────

def retrieve(
    query: str,
    meet_id: str,
    top_k: int = TOP_K_RETURN,
    index_name: Optional[str] = None,
) -> list[RetrievedChunk]:
    """
    Return the most relevant transcript chunks for *query* within a single
    meeting's Pinecone index.

    Args:
        query      : Employee's natural-language question.
        meet_id    : Identifies the meeting; used to derive the index name
                     unless *index_name* is supplied explicitly.
        top_k      : Number of chunks to return after re-ranking.
        index_name : Override the derived Pinecone index name (optional).

    Returns:
        List of RetrievedChunk sorted by cross-encoder score, descending.
    """
    # 1. Embed the query
    query_vector = _embed_query(query)

    # 2. Fetch top-k candidates from this meeting's Pinecone index
    pinecone_index = index_name or _derive_index_name(meet_id)
    raw_matches = _query_pinecone(pinecone_index, query_vector, TOP_K_FETCH)

    if not raw_matches:
        return []

    # 3. Re-rank with a cross-encoder for higher precision
    reranked = _rerank(query, raw_matches)

    return reranked[:top_k]


def build_rag_context(
    chunks: list[RetrievedChunk],
    include_timestamps: bool = True,
) -> str:
    """
    Serialise retrieved chunks into a numbered context block ready to be
    injected into an LLM prompt.

    Each chunk shows: index, speaker (if known), timestamp (if available),
    chunk type, and the transcript text.
    """
    parts: list[str] = []

    for i, chunk in enumerate(chunks, 1):
        header_parts = [f"[{i}]"]

        if chunk.speaker:
            header_parts.append(f"Speaker: {chunk.speaker}")

        if include_timestamps and chunk.timestamp_start is not None:
            header_parts.append(f"@ {_format_timestamp(chunk.timestamp_start)}")

        if chunk.chunk_type:
            header_parts.append(f"Type: {chunk.chunk_type}")

        header = " | ".join(header_parts)
        parts.append(f"{header}\n{chunk.text}")

    return "\n\n---\n\n".join(parts)


# ── Step 1: Embed the query ───────────────────────────────────────────────────

def _embed_query(query: str) -> list[float]:
    """
    Embed *query* with the Gemini Embeddings API.
    Uses RETRIEVAL_QUERY task type so the vector is optimised for search.
    """
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{EMBEDDING_MODEL}:embedContent",
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": os.environ["GEMINI_API_KEY"],
        },
        json={
            "content": {"parts": [{"text": query}]},
            "taskType": "RETRIEVAL_QUERY",
            "outputDimensionality": EMBEDDING_DIM,
        },
        timeout=60,
    )
    response.raise_for_status()

    values = response.json().get("embedding", {}).get("values")
    if not values:
        raise ValueError(
            "Gemini embedding response contained no vectors. "
            f"Raw response: {response.text[:300]}"
        )
    return values


# ── Step 2: Query Pinecone ────────────────────────────────────────────────────

def _derive_index_name(meet_id: str) -> str:
    """
    Convert a meet_id into a valid Pinecone index name.
    Pinecone names must be lowercase, max 45 chars, hyphens allowed.
    """
    return meet_id.lower().replace("_", "-").replace(" ", "-")[:45]


def _query_pinecone(
    index_name: str,
    query_vector: list[float],
    top_k: int,
) -> list[dict]:
    """
    Run an ANN query against the meeting's Pinecone index.
    No metadata filter is applied — the index already contains only
    chunks from this meeting.
    """
    pc    = _get_pinecone()
    index = pc.Index(index_name)

    response = index.query(
        vector=query_vector,
        top_k=top_k,
        include_metadata=True,
    )
    return response.get("matches", [])


# ── Step 3: Cross-encoder re-ranking ─────────────────────────────────────────

def _rerank(query: str, matches: list[dict]) -> list[RetrievedChunk]:
    """
    Score every (query, chunk) pair with a cross-encoder for precise ranking.
    Falls back to the Pinecone cosine scores if the cross-encoder errors out.
    """
    texts = [m["metadata"].get("text", "") for m in matches]

    try:
        reranker = _get_reranker()
        scores   = reranker.predict([[query, t] for t in texts])
    except Exception as exc:  # noqa: BLE001
        print(f"[reranker] Cross-encoder failed, falling back to vector scores: {exc}")
        scores = [m["score"] for m in matches]

    chunks: list[RetrievedChunk] = []
    for match, score in zip(matches, scores):
        meta = match.get("metadata", {})
        chunks.append(
            RetrievedChunk(
                chunk_id        = match.get("id", ""),
                text            = meta.get("text", ""),
                chunk_type      = meta.get("chunk_type", ""),
                speaker         = meta.get("speaker"),
                timestamp_start = meta.get("timestamp_start"),
                timestamp_end   = meta.get("timestamp_end"),
                topic_label     = meta.get("topic_label"),
                action_flag     = bool(meta.get("action_flag", False)),
                score           = float(score),
                vector_score    = float(match.get("score", 0.0)),
            )
        )

    chunks.sort(key=lambda c: c.score, reverse=True)
    return chunks


# ── Helpers ───────────────────────────────────────────────────────────────────

def _format_timestamp(seconds: float) -> str:
    """Convert a float number of seconds to a MM:SS display string."""
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m:02d}:{s:02d}"
