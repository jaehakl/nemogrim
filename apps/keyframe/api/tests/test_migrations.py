from sqlalchemy import create_engine

from app import db


def test_additive_startup_migration_is_idempotent(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{(tmp_path / 'legacy.sqlite3').as_posix()}")
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE movie_files (id INTEGER PRIMARY KEY)")
        connection.exec_driver_sql(
            "CREATE TABLE scenes ("
            "id INTEGER PRIMARY KEY, snapshot_path TEXT, embedding BLOB, prompt TEXT)"
        )
        connection.exec_driver_sql(
            "INSERT INTO scenes (id, snapshot_path, embedding, prompt) "
            "VALUES (1, 'scenes/1/1.webp', x'00', 'tag'), (2, NULL, NULL, NULL)"
        )
    monkeypatch.setattr(db, "engine", engine)

    db._run_additive_migrations()
    db._run_additive_migrations()

    with engine.connect() as connection:
        movie_columns = {
            row[1] for row in connection.exec_driver_sql("PRAGMA table_info(movie_files)")
        }
        scene_columns = {
            row[1] for row in connection.exec_driver_sql("PRAGMA table_info(scenes)")
        }
        statuses = connection.exec_driver_sql(
            "SELECT analysis_status FROM scenes ORDER BY id"
        ).scalars().all()
    assert {
        "video_codec", "audio_codec", "playback_status", "playback_path", "playback_error"
    }.issubset(movie_columns)
    assert {"prompt_model", "analysis_status", "analysis_error"}.issubset(scene_columns)
    assert statuses == ["ready", "pending"]
    engine.dispose()
