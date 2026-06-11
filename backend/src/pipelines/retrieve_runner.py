from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipelines.retriever import retrieve  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Run meeting RAG retrieval.")
    parser.add_argument("--query", required=True)
    parser.add_argument("--meet-id", required=True)
    parser.add_argument("--index-name", required=True)
    parser.add_argument("--top-k", type=int, default=8)
    args = parser.parse_args()

    chunks = retrieve(
        query=args.query,
        meet_id=args.meet_id,
        top_k=args.top_k,
        index_name=args.index_name,
    )

    payload = []
    for chunk in chunks:
        item = asdict(chunk)
        item["metadata"] = {
            "chunk_id": chunk.chunk_id,
            "chunk_type": chunk.chunk_type,
            "speaker": chunk.speaker,
            "timestamp_start": chunk.timestamp_start,
            "timestamp_end": chunk.timestamp_end,
            "topic_label": chunk.topic_label,
            "action_flag": chunk.action_flag,
            "startTime": _format_duration(chunk.timestamp_start),
            "endTime": _format_duration(chunk.timestamp_end),
            "vector_score": chunk.vector_score,
        }
        payload.append(item)

    print(json.dumps(payload))
    return 0


def _format_duration(seconds: float | None) -> str | None:
    if seconds is None:
        return None
    seconds = int(seconds)
    hrs = seconds // 3600
    mins = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hrs:02d}:{mins:02d}:{secs:02d}"


if __name__ == "__main__":
    raise SystemExit(main())
