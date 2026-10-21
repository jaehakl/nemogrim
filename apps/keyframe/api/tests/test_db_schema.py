import pytest
from sqlalchemy import create_engine, inspect

from app import db


def make_engine(tmp_path):
    return create_engine(f"sqlite:///{(tmp_path / 'schema.sqlite3').as_posix()}")


def test_fresh_database_gets_current_schema_version(tmp_path):
    engine = make_engine(tmp_path)
    db.ensure_schema(engine)
    db.ensure_schema(engine)  # 재실행해도 문제없다.

    with engine.connect() as connection:
        assert connection.exec_driver_sql("PRAGMA user_version").scalar() == db.SCHEMA_VERSION
        tables = set(inspect(connection).get_table_names())
        scene_columns = {column["name"] for column in inspect(connection).get_columns("scenes")}
        movie_columns = {column["name"] for column in inspect(connection).get_columns("movie_files")}
    assert tables == {"movie_files", "scenes"}
    assert "play_count" not in scene_columns
    assert "playback_path" not in movie_columns
    engine.dispose()


def test_database_from_other_schema_version_is_rejected(tmp_path):
    engine = make_engine(tmp_path)
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE images (id INTEGER PRIMARY KEY)")

    with pytest.raises(RuntimeError, match="스키마 버전"):
        db.ensure_schema(engine)
    engine.dispose()


def test_init_db_creates_data_directories(data_dir, monkeypatch):
    monkeypatch.setattr(db, "ensure_schema", lambda _engine: None)
    db.init_db()
    assert (data_dir / "thumbnails").is_dir()
    assert (data_dir / "scenes").is_dir()
