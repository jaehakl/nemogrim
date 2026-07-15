from __future__ import annotations

import os
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable

from sqlalchemy import select

from ..db import MovieFile, SessionLocal


SUPPORTED_EXTENSIONS = frozenset(
    {".mp4", ".m4v", ".webm"}
)
_IMPORT_LOCK = threading.Lock()


def normalize_path(path: str | os.PathLike[str]) -> str:
    return os.path.normcase(os.path.realpath(os.fspath(path))).casefold()


def scan_video_folder(folder: str | os.PathLike[str]) -> tuple[list[str], list[str]]:
    videos: list[str] = []
    failures: list[str] = []

    def handle_walk_error(error: OSError) -> None:
        failures.append(f"{error.filename or folder}: {error.strerror or error}")

    for root, directories, filenames in os.walk(
        folder,
        followlinks=False,
        onerror=handle_walk_error,
    ):
        directories[:] = [
            name for name in directories if not Path(root, name).is_symlink()
        ]
        for filename in filenames:
            candidate = Path(root, filename)
            if candidate.suffix.casefold() in SUPPORTED_EXTENSIONS:
                videos.append(str(candidate))

    videos.sort(key=normalize_path)
    return videos, failures


def register_movie_paths(
    paths: Iterable[str | os.PathLike[str]],
    initial_failures: Iterable[str] = (),
) -> dict:
    path_list = [os.fspath(path) for path in paths]
    failures = list(initial_failures)
    duplicate_count = 0
    candidates: dict[str, dict] = {}

    for raw_path in path_list:
        try:
            candidate = Path(raw_path)
            if candidate.suffix.casefold() not in SUPPORTED_EXTENSIONS:
                raise ValueError("지원하지 않는 영상 확장자입니다")
            resolved = candidate.resolve(strict=True)
            if not resolved.is_file():
                raise ValueError("일반 파일이 아닙니다")
            file_stat = resolved.stat()
            normalized = normalize_path(resolved)
            if normalized in candidates:
                duplicate_count += 1
                continue
            candidates[normalized] = {
                "title": resolved.stem,
                "path": str(resolved),
                "normalized_path": normalized,
                "ext": resolved.suffix.casefold(),
                "size_bytes": file_stat.st_size,
                "file_modified_at": datetime.fromtimestamp(
                    file_stat.st_mtime,
                    tz=UTC,
                ).replace(tzinfo=None),
            }
        except (OSError, ValueError) as error:
            failures.append(f"{raw_path}: {error}")

    added_ids: list[int] = []
    with _IMPORT_LOCK, SessionLocal() as database:
        normalized_paths = list(candidates)
        existing: set[str] = set()
        for start in range(0, len(normalized_paths), 500):
            chunk = normalized_paths[start : start + 500]
            existing.update(
                database.scalars(
                    select(MovieFile.normalized_path).where(
                        MovieFile.normalized_path.in_(chunk)
                    )
                ).all()
            )

        for normalized, values in candidates.items():
            if normalized in existing:
                duplicate_count += 1
                continue
            movie = MovieFile(**values)
            database.add(movie)
            database.flush()
            added_ids.append(movie.id)
        database.commit()

    return {
        "cancelled": False,
        "selected_count": len(path_list),
        "added_count": len(added_ids),
        "duplicate_count": duplicate_count,
        "failed_count": len(failures),
        "added_ids": added_ids,
        "failures": failures[:20],
    }


def empty_import_result(cancelled: bool = True) -> dict:
    return {
        "cancelled": cancelled,
        "selected_count": 0,
        "added_count": 0,
        "duplicate_count": 0,
        "failed_count": 0,
        "added_ids": [],
        "failures": [],
    }
