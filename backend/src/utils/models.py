from __future__ import annotations

from dataclasses import dataclass, field, replace
from enum import Enum
from typing import Optional


class ChunkType(str, Enum):
    SPEAKER_TURN = "speaker_turn"
    SEMANTIC = "semantic"
    ACTION_ITEM = "action_item"


@dataclass
class TranscriptSegment:
    speaker: str
    text: str
    timestamp_start: float
    timestamp_end: float

    def model_copy(self) -> "TranscriptSegment":
        return replace(self)


@dataclass
class NormalizedTranscript:
    meet_id: str
    org_id: str
    meet_title: str
    meet_date: str
    duration_seconds: float
    segments: list[TranscriptSegment]


@dataclass
class ActionItem:
    owner: Optional[str] = None
    task: str = ""
    deadline: Optional[str] = None
    context_sentence: str = ""


@dataclass
class TranscriptChunk:
    chunk_id: str
    meet_id: str
    org_id: str
    chunk_type: ChunkType
    text: str
    speaker: Optional[str] = None
    speaker_role: Optional[str] = None
    timestamp_start: Optional[float] = None
    timestamp_end: Optional[float] = None
    topic_label: Optional[str] = None
    action_flag: bool = False
    chunk_index: int = 0
    embedding: Optional[list[float]] = field(default=None, repr=False)
