import numpy as np

from app.ai.types import CLIP_MODEL_NAME, pack_embedding
from app.db import Scene
from app.services.vector_index import SceneVectorIndex
from tests.conftest import axis
from tests.test_models import make_movie


def add_scenes(session_factory, tmp_path, vectors):
    with session_factory() as database:
        movie = make_movie(str(tmp_path / "movie.mp4"))
        database.add(movie)
        database.flush()
        scenes = [
            Scene(
                movie_file_id=movie.id,
                timestamp_ms=index * 1_000,
                analysis_status="ready",
                embedding=pack_embedding(vector),
                embedding_model=CLIP_MODEL_NAME,
            )
            for index, vector in enumerate(vectors)
        ]
        database.add_all(scenes)
        database.commit()
        return [scene.id for scene in scenes]


def test_rank_orders_by_cosine_then_id_and_normalizes_rows(session_factory, tmp_path):
    diagonal = (axis(0) + axis(1)) * 5  # 정규화되지 않은 벡터도 cosine으로 비교된다.
    ids = add_scenes(session_factory, tmp_path, [axis(0), axis(1), diagonal, axis(0)])
    index = SceneVectorIndex()

    with session_factory() as database:
        ranked = index.rank(database, axis(0) * 3)
        excluded = index.rank(database, axis(0), exclude_id=ids[3])

    assert ranked == [ids[3], ids[0], ids[2], ids[1]]
    assert excluded == [ids[0], ids[2], ids[1]]


def test_rank_reloads_when_searchable_scenes_change(session_factory, tmp_path):
    ids = add_scenes(session_factory, tmp_path, [axis(0)])
    index = SceneVectorIndex()
    with session_factory() as database:
        assert index.rank(database, axis(0)) == ids

    with session_factory() as database:
        scene = database.get(Scene, ids[0])
        scene.analysis_status = "pending"
        database.commit()
    with session_factory() as database:
        assert index.rank(database, axis(0)) == []


def test_rank_on_empty_index_returns_nothing(session_factory):
    with session_factory() as database:
        assert SceneVectorIndex().rank(database, np.ones(768, dtype=np.float32)) == []
