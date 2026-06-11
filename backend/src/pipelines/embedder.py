"""
Embedder + Pinecone Upsert
==========================
  1. Embeds TranscriptChunks via Gemini embeddings
  2. Creates a per-meet Pinecone index if it doesn't exist
  3. Upserts all vectors with rich metadata for filtered retrieval
"""

from __future__ import annotations
import os
import time
from typing import Optional

import requests
from pinecone import Pinecone, ServerlessSpec

from utils.models import TranscriptChunk

# ── Config ────────────────────────────────────────────────────────────────────

EMBEDDING_MODEL = os.environ.get("GEMINI_EMBEDDING_MODEL", "text-embedding-004")
EMBEDDING_DIM = int(os.environ.get("GEMINI_EMBEDDING_DIMENSION", "768"))
EMBEDDING_BATCH_SIZE = 50
PINECONE_BATCH_SIZE = 100           # vectors per upsert call
PINECONE_CLOUD = os.environ.get("PINECONE_CLOUD", "aws")
PINECONE_REGION = os.environ.get("PINECONE_REGION", "us-east-1")
INDEX_METRIC = "cosine"

_pinecone_client: Optional[Pinecone] = None


def _get_pinecone() -> Pinecone:
    global _pinecone_client
    if _pinecone_client is None:
        _pinecone_client = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    return _pinecone_client


# ── Public: full pipeline step ────────────────────────────────────────────────

def embed_and_upsert(chunks: list[TranscriptChunk], meet_id: str, index_name: Optional[str] = None) -> str:
    """
    Embed all chunks and upsert them into a dedicated Pinecone index.

    Args:
        chunks  : Output of chunk_transcript()
        meet_id : Used to derive the index name

    Returns:
        Pinecone index name that was used.
    """
    index_name = index_name or _index_name(meet_id)

    # Step 1 – embed
    print(f"[embedder] Embedding {len(chunks)} chunks …")
    _embed_chunks_inplace(chunks)

    # Step 2 – ensure index exists
    _ensure_index(index_name)

    # Step 3 – upsert
    print(f"[embedder] Upserting to index '{index_name}' …")
    _upsert_chunks(index_name, chunks)

    print(f"[embedder] Done. {len(chunks)} vectors in '{index_name}'")
    return index_name


# ── Embedding ─────────────────────────────────────────────────────────────────

def _embed_chunks_inplace(chunks: list[TranscriptChunk]) -> None:
    """Populate chunk.embedding for every chunk in-place, using batch calls."""
    texts = [c.text for c in chunks]

    for batch_start in range(0, len(texts), EMBEDDING_BATCH_SIZE):
        batch_texts = texts[batch_start : batch_start + EMBEDDING_BATCH_SIZE]
        batch_chunks = chunks[batch_start : batch_start + EMBEDDING_BATCH_SIZE]

        for chunk, text in zip(batch_chunks, batch_texts):
            chunk.embedding = _embed_text(text, "RETRIEVAL_DOCUMENT")


def _embed_text(text: str, task_type: str) -> list[float]:
    api_key = os.environ["GEMINI_API_KEY"]
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{EMBEDDING_MODEL}:embedContent",
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        json={
            "content": {"parts": [{"text": text}]},
            "taskType": task_type,
            "outputDimensionality": EMBEDDING_DIM,
        },
        timeout=60,
    )
    response.raise_for_status()
    values = response.json().get("embedding", {}).get("values")
    if not values:
        raise ValueError("Gemini embedding response did not include vectors")
    return values


# ── Pinecone index management ─────────────────────────────────────────────────

def _index_name(meet_id: str) -> str:
    """Derive a Pinecone-safe index name from a meet_id."""
    # Pinecone index names: lowercase, alphanumeric + hyphens, ≤45 chars
    stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    safe = f"meetflow-{stamp}-{meet_id[-10:]}".lower().replace("_", "-").replace(" ", "-")
    return safe[:45]


def _ensure_index(index_name: str) -> None:
    """Create the Pinecone serverless index if it doesn't already exist."""
    pc = _get_pinecone()
    existing = [idx.name for idx in pc.list_indexes()]

    if index_name not in existing:
        print(f"[pinecone] Creating index '{index_name}' …")
        pc.create_index(
            name=index_name,
            dimension=EMBEDDING_DIM,
            metric=INDEX_METRIC,
            spec=ServerlessSpec(cloud=PINECONE_CLOUD, region=PINECONE_REGION),
        )
        # Wait for index to become ready
        while not pc.describe_index(index_name).status["ready"]:
            time.sleep(1)
        print(f"[pinecone] Index '{index_name}' ready.")
    else:
        print(f"[pinecone] Index '{index_name}' already exists.")


# ── Upsert ────────────────────────────────────────────────────────────────────

def _upsert_chunks(index_name: str, chunks: list[TranscriptChunk]) -> None:
    """Batch-upsert all chunks as Pinecone vectors with metadata."""
    pc = _get_pinecone()
    index = pc.Index(index_name)

    vectors = [_chunk_to_vector(c) for c in chunks if c.embedding is not None]

    for batch_start in range(0, len(vectors), PINECONE_BATCH_SIZE):
        batch = vectors[batch_start : batch_start + PINECONE_BATCH_SIZE]
        index.upsert(vectors=batch)


def _chunk_to_vector(chunk: TranscriptChunk) -> dict:
    """Convert a TranscriptChunk to a Pinecone vector dict."""
    metadata: dict = {
        "meet_id": chunk.meet_id,
        "org_id": chunk.org_id,
        "chunk_type": chunk.chunk_type.value,
        "text": chunk.text,           # stored for retrieval without re-fetch
        "action_flag": chunk.action_flag,
        "chunk_index": chunk.chunk_index,
    }
    # Only store non-null optional fields (Pinecone ignores None values but
    # storing them wastes metadata space)
    if chunk.speaker:
        metadata["speaker"] = chunk.speaker
    if chunk.speaker_role:
        metadata["speaker_role"] = chunk.speaker_role
    if chunk.timestamp_start is not None:
        metadata["timestamp_start"] = chunk.timestamp_start
    if chunk.timestamp_end is not None:
        metadata["timestamp_end"] = chunk.timestamp_end
    if chunk.topic_label:
        metadata["topic_label"] = chunk.topic_label

    return {
        "id": chunk.chunk_id,
        "values": chunk.embedding,
        "metadata": metadata,
    }


# ── Utility: delete a meet's index (GDPR / retention) ────────────────────────

def delete_meet_index(meet_id: str) -> None:
    """Permanently delete a meet's Pinecone index."""
    pc = _get_pinecone()
    index_name = _index_name(meet_id)
    existing = [idx.name for idx in pc.list_indexes()]
    if index_name in existing:
        pc.delete_index(index_name)
        print(f"[pinecone] Deleted index '{index_name}'")
    else:
        print(f"[pinecone] Index '{index_name}' not found, nothing to delete.")
