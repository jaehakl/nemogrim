from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

from ..db import DATA_DIR, IMAGE_DIR, Image, MovieFile, SessionLocal
from .scene_models import (
    SdxlGenerationSettings,
    generate_images_from_snapshot,
)
from .media_processing import _run_command


def generate_movie_images(
    movie_id: int,
    timestamp_ms: int,
    settings: SdxlGenerationSettings,
) -> list[dict]:
    with SessionLocal() as database:
        movie = database.get(MovieFile, movie_id)
        if movie is None:
            raise LookupError("영상을 찾을 수 없습니다")
        if movie.duration_ms is not None and timestamp_ms > movie.duration_ms:
            raise ValueError("영상 길이를 벗어난 timestamp입니다")
        source_path = Path(movie.path).resolve()

    if not source_path.is_file():
        raise FileNotFoundError("원본 영상 파일을 찾을 수 없습니다")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix="image-generation-", dir=DATA_DIR) as temporary_dir:
        snapshot = Path(temporary_dir) / "snapshot.webp"
        _run_command(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-ss",
                f"{timestamp_ms / 1000:.3f}", "-i", str(source_path), "-map", "0:v:0",
                "-frames:v", "1", "-vf",
                "scale=1280:-2:force_original_aspect_ratio=decrease",
                "-c:v", "libwebp", "-q:v", "90", "-y", str(snapshot),
            ],
            timeout=180,
        )
        if not snapshot.is_file() or snapshot.stat().st_size == 0:
            raise RuntimeError("FFmpeg가 이미지 생성 snapshot을 만들지 못했습니다")
        analysis = generate_images_from_snapshot(snapshot, settings)

    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    temporary_paths: list[Path] = []
    final_paths: list[Path] = []
    with SessionLocal() as database:
        try:
            rows: list[Image] = []
            for generated in analysis.images:
                final_path = IMAGE_DIR / f"{uuid4().hex}.{generated.format}"
                temporary_path = final_path.with_name(f".{final_path.name}.tmp")
                temporary_paths.append(temporary_path)
                temporary_path.write_bytes(generated.data)
                temporary_path.replace(final_path)
                final_paths.append(final_path)
                image = Image(
                    file_path=final_path.relative_to(DATA_DIR).as_posix(),
                    prompt=analysis.prompt,
                    embedding=generated.embedding,
                )
                database.add(image)
                rows.append(image)
            database.flush()
            items = [
                {
                    "id": image.id,
                    "prompt": image.prompt,
                    "image_url": f"/api/images/{image.id}/file",
                }
                for image in sorted(rows, key=lambda item: item.id, reverse=True)
            ]
            database.commit()
            return items
        except BaseException:
            database.rollback()
            for path in [*temporary_paths, *final_paths]:
                path.unlink(missing_ok=True)
            raise
