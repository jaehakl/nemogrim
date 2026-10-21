"""CLIP 임베딩 유사도 검색용 인메모리 인덱스.

검색 가능한 Scene 전체를 정규화된 (N, 768) float32 행렬로 캐시하고 행렬 곱 한 번으로 순위를 매긴다.
DB 상태의 시그니처(개수, 최대 id, 최대 updated_at)가 바뀌면 다시 읽으므로 캐시가 낡지 않는다.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..ai.types import CLIP_DIMENSIONS, CLIP_MODEL_NAME, EMBEDDING_BYTES
from ..db import Scene


SEARCHABLE = (
    Scene.analysis_status == "ready",
    Scene.embedding_model == CLIP_MODEL_NAME,
    Scene.embedding.is_not(None),
)


@dataclass(frozen=True, slots=True)
class _Snapshot:
    signature: tuple
    ids: np.ndarray
    matrix: np.ndarray


class SceneVectorIndex:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._snapshot: _Snapshot | None = None

    def invalidate(self) -> None:
        with self._lock:
            self._snapshot = None

    def rank(
        self,
        session: Session,
        query: np.ndarray,
        *,
        exclude_id: int | None = None,
    ) -> list[int]:
        """유사도 내림차순(동점이면 id 내림차순)으로 정렬한 Scene id 목록."""
        snapshot = self._current(session)
        ids, matrix = snapshot.ids, snapshot.matrix
        if exclude_id is not None:
            keep = ids != exclude_id
            ids, matrix = ids[keep], matrix[keep]
        if ids.size == 0:
            return []
        scores = matrix @ _normalize(query)
        order = np.lexsort((-ids, -scores))
        return ids[order].tolist()

    def _current(self, session: Session) -> _Snapshot:
        signature = tuple(
            session.execute(
                select(func.count(Scene.id), func.max(Scene.id), func.max(Scene.updated_at))
                .where(*SEARCHABLE)
            ).one()
        )
        with self._lock:
            if self._snapshot is not None and self._snapshot.signature == signature:
                return self._snapshot

        rows = session.execute(select(Scene.id, Scene.embedding).where(*SEARCHABLE)).all()
        valid = [(scene_id, blob) for scene_id, blob in rows if len(blob) == EMBEDDING_BYTES]
        ids = np.fromiter((scene_id for scene_id, _ in valid), dtype=np.int64, count=len(valid))
        if valid:
            matrix = np.frombuffer(b"".join(blob for _, blob in valid), dtype="<f4")
            matrix = matrix.reshape(len(valid), CLIP_DIMENSIONS).astype(np.float32)
            norms = np.linalg.norm(matrix, axis=1, keepdims=True)
            matrix = np.divide(matrix, norms, out=np.zeros_like(matrix), where=norms > 0)
        else:
            matrix = np.zeros((0, CLIP_DIMENSIONS), dtype=np.float32)

        snapshot = _Snapshot(signature, ids, matrix)
        with self._lock:
            self._snapshot = snapshot
        return snapshot


def _normalize(vector: np.ndarray) -> np.ndarray:
    values = np.asarray(vector, dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(values))
    return values / norm if norm > 0 else values


scene_index = SceneVectorIndex()
