from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.db import Image
from app.routers import images
from app.services import image_generation, image_query, scene_models
from tests.test_models import make_movie


def test_image_api_lists_latest_with_cursor_and_serves_safe_files(
    api_client, session_factory, tmp_path, monkeypatch
):
    data_dir = tmp_path / "data"
    image_dir = data_dir / "images"
    image_dir.mkdir(parents=True)
    monkeypatch.setattr(image_query, "DATA_DIR", data_dir)
    with session_factory() as database:
        for number in range(1, 4):
            path = image_dir / f"{number}.png"
            path.write_bytes(f"image-{number}".encode())
            database.add(Image(
                file_path=f"images/{number}.png",
                prompt=f"prompt {number}",
                embedding=b"clip",
            ))
        database.commit()

    first = api_client.get("/api/images", params={"limit": 2}).json()
    assert [item["id"] for item in first["items"]] == [3, 2]
    assert first == {
        "items": [
            {"id": 3, "prompt": "prompt 3", "image_url": "/api/images/3/file"},
            {"id": 2, "prompt": "prompt 2", "image_url": "/api/images/2/file"},
        ],
        "total": 3,
        "next_cursor": 2,
        "has_more": True,
    }
    second = api_client.get(
        "/api/images", params={"limit": 2, "before_id": 2}
    ).json()
    assert [item["id"] for item in second["items"]] == [1]
    response = api_client.get("/api/images/3/file")
    assert response.content == b"image-3"
    assert response.headers["content-type"] == "image/png"
    assert response.headers["cache-control"] == "no-cache"

    outside = tmp_path / "outside.png"
    outside.write_bytes(b"outside")
    with session_factory() as database:
        database.add(Image(file_path="../outside.png", prompt=None, embedding=None))
        database.commit()
        unsafe_id = database.scalar(select(func.max(Image.id)))
    assert api_client.get(f"/api/images/{unsafe_id}/file").status_code == 404


def test_image_generation_api_validates_settings_and_expands_seed(
    api_client, monkeypatch
):
    captured = {}

    def generate(movie_id, timestamp_ms, settings):
        captured.update(movie_id=movie_id, timestamp_ms=timestamp_ms, settings=settings)
        return [{"id": 9, "prompt": "tag", "image_url": "/api/images/9/file"}]

    monkeypatch.setattr(images, "generate_movie_images", generate)
    response = api_client.post(
        "/api/movies/7/images",
        json={
            "timestamp_ms": 12_345,
            "model": " main-sdxl ",
            "count": 3,
            "negative_prompt": "low quality",
            "seed": 20,
            "step": 24,
            "cfg": 6.5,
            "strength": 0.7,
            "width": 1024,
            "height": 768,
            "format": "jpg",
        },
    )
    assert response.status_code == 201
    assert captured["movie_id"] == 7
    assert captured["timestamp_ms"] == 12_345
    assert captured["settings"].model == "main-sdxl"
    assert captured["settings"].seeds == [20, 21, 22]
    assert api_client.post(
        "/api/movies/7/images",
        json={"timestamp_ms": 0, "model": "x", "width": 1001},
    ).status_code == 422
    assert api_client.post(
        "/api/movies/7/images",
        json={
            "timestamp_ms": 0, "model": "x", "count": 2,
            "seed": 2_147_483_647,
        },
    ).status_code == 422


def test_image_generation_saves_snapshot_outputs_and_embeddings_atomically(
    session_factory, tmp_path, monkeypatch
):
    data_dir = tmp_path / "data"
    image_dir = data_dir / "images"
    source = tmp_path / "movie.mp4"
    source.write_bytes(b"video")
    monkeypatch.setattr(image_generation, "DATA_DIR", data_dir)
    monkeypatch.setattr(image_generation, "IMAGE_DIR", image_dir)

    def run_command(command, timeout):
        assert timeout == 180
        Path(command[-1]).write_bytes(b"snapshot")

    observed_snapshot = []
    monkeypatch.setattr(image_generation, "_run_command", run_command)
    monkeypatch.setattr(
        image_generation,
        "generate_images_from_snapshot",
        lambda path, _settings: (
            observed_snapshot.append(path.read_bytes())
            or scene_models.ImageGenerationAnalysis(
                model="main-sdxl",
                prompt="blue sky",
                images=[
                    scene_models.GeneratedImageAnalysis(
                        data=b"first", format="png", mime_type="image/png",
                        seed=1, embedding=b"embedding-1",
                    ),
                    scene_models.GeneratedImageAnalysis(
                        data=b"second", format="jpg", mime_type="image/jpeg",
                        seed=2, embedding=b"embedding-2",
                    ),
                ],
            )
        ),
    )
    with session_factory() as database:
        movie = make_movie(str(source), duration_ms=20_000)
        database.add(movie)
        database.commit()
        movie_id = movie.id

    settings = scene_models.SdxlGenerationSettings(
        model="main-sdxl", count=2, negative_prompt="", seeds=None,
        step=30, cfg=7.0, strength=0.8, width=1024, height=1024, format="png",
    )
    items = image_generation.generate_movie_images(movie_id, 5_000, settings)
    assert observed_snapshot == [b"snapshot"]
    assert [item["id"] for item in items] == [2, 1]
    with session_factory() as database:
        rows = list(database.scalars(select(Image).order_by(Image.id)).all())
    assert [row.prompt for row in rows] == ["blue sky", "blue sky"]
    assert [row.embedding for row in rows] == [b"embedding-1", b"embedding-2"]
    assert sorted(path.read_bytes() for path in image_dir.iterdir()) == [b"first", b"second"]
    assert not list(data_dir.glob("image-generation-*"))


def test_image_generation_removes_all_new_files_when_batch_storage_fails(
    session_factory, tmp_path, monkeypatch
):
    data_dir = tmp_path / "data"
    image_dir = data_dir / "images"
    source = tmp_path / "movie.mp4"
    source.write_bytes(b"video")
    monkeypatch.setattr(image_generation, "DATA_DIR", data_dir)
    monkeypatch.setattr(image_generation, "IMAGE_DIR", image_dir)
    monkeypatch.setattr(
        image_generation,
        "_run_command",
        lambda command, timeout: Path(command[-1]).write_bytes(b"snapshot"),
    )
    generated = scene_models.GeneratedImageAnalysis(
        data=b"image", format="png", mime_type="image/png",
        seed=1, embedding=b"embedding",
    )
    monkeypatch.setattr(
        image_generation,
        "generate_images_from_snapshot",
        lambda _path, _settings: scene_models.ImageGenerationAnalysis(
            model="main-sdxl", prompt="prompt", images=[generated, generated]
        ),
    )
    with session_factory() as database:
        movie = make_movie(str(source), duration_ms=10_000)
        database.add(movie)
        database.commit()
        movie_id = movie.id

    original_replace = Path.replace
    replace_count = 0

    def fail_second_replace(path, target):
        nonlocal replace_count
        replace_count += 1
        if replace_count == 2:
            raise OSError("disk full")
        return original_replace(path, target)

    monkeypatch.setattr(Path, "replace", fail_second_replace)
    settings = scene_models.SdxlGenerationSettings(
        model="main-sdxl", count=2, negative_prompt="", seeds=None,
        step=30, cfg=7.0, strength=0.8, width=1024, height=1024, format="png",
    )
    with pytest.raises(OSError, match="disk full"):
        image_generation.generate_movie_images(movie_id, 1_000, settings)
    assert list(image_dir.iterdir()) == []
    with session_factory() as database:
        assert database.scalar(select(func.count(Image.id))) == 0


def test_sdxl_models_api_returns_only_public_generation_defaults(
    api_client, monkeypatch
):
    monkeypatch.setattr(
        images,
        "get_sdxl_models",
        lambda: scene_models.SdxlModelsPayload(
            default_model="main",
            models=[
                scene_models.SdxlModelInfo(
                    name="main", step=24, cfg=6.5, height=1024, width=768,
                    strength=0.75, format="jpeg",
                )
            ],
        ),
    )
    assert api_client.get("/api/images/models").json() == {
        "default_model": "main",
        "models": [
            {
                "name": "main", "step": 24, "cfg": 6.5,
                "height": 1024, "width": 768, "strength": 0.75,
                "format": "jpg",
            }
        ],
    }
