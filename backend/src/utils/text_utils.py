from __future__ import annotations


def count_tokens(text: str) -> int:
    return max(1, int(len(str(text).split()) * 1.3))


def split_by_token_limit(
    text: str,
    max_tokens: int,
    overlap_tokens: int = 0,
) -> list[str]:
    words = str(text).split()
    if not words:
        return []
    if len(words) <= max_tokens:
        return [" ".join(words)]

    chunks: list[str] = []
    step = max(max_tokens - overlap_tokens, 1)
    for start in range(0, len(words), step):
        chunks.append(" ".join(words[start:start + max_tokens]))
        if start + max_tokens >= len(words):
            break
    return chunks
