"""Keyframe 런타임 데이터 경로.

모든 함수가 호출 시점의 `DATA_DIR`을 읽으므로 테스트는 이 심볼 하나만 바꾸면 된다.
"""

from __future__ import annotations

from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = APP_ROOT / "data"


def thumbnail_dir() -> Path:
    return DATA_DIR / "thumbnails"


def scene_dir(movie_id: int | None = None) -> Path:
    root = DATA_DIR / "scenes"
    return root if movie_id is None else root / str(movie_id)


def resolve_data_path(relative_path: str | None) -> Path | None:
    """DATA_DIR 안에 실제로 존재하는 파일이면 절대 경로를, 아니면 None을 반환한다."""
    if not relative_path:
        return None
    root = DATA_DIR.resolve()
    path = (root / relative_path).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        return None
    return path


def to_data_relative(path: Path) -> str:
    return path.resolve().relative_to(DATA_DIR.resolve()).as_posix()
