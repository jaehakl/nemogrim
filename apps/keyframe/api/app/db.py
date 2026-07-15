from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


APP_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = APP_ROOT / "data"
THUMBNAIL_DIR = DATA_DIR / "thumbnails"
SCENE_DIR = DATA_DIR / "scenes"
DATABASE_PATH = DATA_DIR / "keyframe.sqlite3"
DATABASE_URL = f"sqlite:///{DATABASE_PATH.as_posix()}"


def utc_now() -> datetime:
    """Return a naive UTC datetime for predictable SQLite storage."""
    return datetime.now(UTC).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class MovieFile(Base):
    __tablename__ = "movie_files"
    __table_args__ = (
        CheckConstraint(
            "metadata_status IN ('pending', 'processing', 'ready', 'failed')",
            name="ck_movie_files_metadata_status",
        ),
        Index("ix_movie_files_status", "metadata_status"),
        CheckConstraint(
            "playback_status IN ('unprepared', 'direct', 'pending', 'processing', 'ready', 'failed')",
            name="ck_movie_files_playback_status",
        ),
        Index("ix_movie_files_playback_status", "playback_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_path: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    ext: Mapped[str] = mapped_column(String(16), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    file_modified_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    fps: Mapped[float | None] = mapped_column(Float)
    thumbnail_path: Mapped[str | None] = mapped_column(Text)
    metadata_status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    metadata_error: Mapped[str | None] = mapped_column(Text)
    video_codec: Mapped[str | None] = mapped_column(String(32))
    audio_codec: Mapped[str | None] = mapped_column(String(32))
    playback_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="unprepared", server_default="unprepared"
    )
    playback_path: Mapped[str | None] = mapped_column(Text)
    playback_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    scenes: Mapped[list["Scene"]] = relationship(
        back_populates="movie_file",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Scene(Base):
    __tablename__ = "scenes"
    __table_args__ = (
        UniqueConstraint("movie_file_id", "timestamp_ms", name="uq_scenes_movie_timestamp"),
        Index("ix_scenes_movie_timestamp", "movie_file_id", "timestamp_ms"),
        Index("ix_scenes_play_count", "play_count"),
        CheckConstraint(
            "analysis_status IN ('pending', 'processing', 'ready', 'failed')",
            name="ck_scenes_analysis_status",
        ),
        Index("ix_scenes_analysis_status", "analysis_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    movie_file_id: Mapped[int] = mapped_column(
        ForeignKey("movie_files.id", ondelete="CASCADE"),
        nullable=False,
    )
    timestamp_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt: Mapped[str | None] = mapped_column(Text)
    keywords: Mapped[list[str] | None] = mapped_column(JSON)
    embedding: Mapped[bytes | None] = mapped_column(LargeBinary)
    embedding_model: Mapped[str | None] = mapped_column(String(255))
    prompt_model: Mapped[str | None] = mapped_column(String(255))
    snapshot_path: Mapped[str | None] = mapped_column(Text)
    analysis_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending", server_default="pending"
    )
    analysis_error: Mapped[str | None] = mapped_column(Text)
    play_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    movie_file: Mapped[MovieFile] = relationship(back_populates="scenes")


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30},
)


@event.listens_for(engine, "connect")
def configure_sqlite(connection, _connection_record) -> None:
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)
    SCENE_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _run_additive_migrations()


def _run_additive_migrations() -> None:
    movie_columns = {
        "video_codec": "VARCHAR(32)",
        "audio_codec": "VARCHAR(32)",
        "playback_status": "VARCHAR(16) NOT NULL DEFAULT 'unprepared'",
        "playback_path": "TEXT",
        "playback_error": "TEXT",
    }
    scene_columns = {
        "prompt_model": "VARCHAR(255)",
        "analysis_status": "VARCHAR(16) NOT NULL DEFAULT 'pending'",
        "analysis_error": "TEXT",
    }

    with engine.begin() as connection:
        existing_movie_columns = {
            row[1] for row in connection.exec_driver_sql("PRAGMA table_info(movie_files)")
        }
        for name, definition in movie_columns.items():
            if name not in existing_movie_columns:
                connection.exec_driver_sql(
                    f"ALTER TABLE movie_files ADD COLUMN {name} {definition}"
                )

        existing_scene_columns = {
            row[1] for row in connection.exec_driver_sql("PRAGMA table_info(scenes)")
        }
        analysis_status_added = "analysis_status" not in existing_scene_columns
        for name, definition in scene_columns.items():
            if name not in existing_scene_columns:
                connection.exec_driver_sql(
                    f"ALTER TABLE scenes ADD COLUMN {name} {definition}"
                )

        if analysis_status_added:
            connection.exec_driver_sql(
                "UPDATE scenes SET analysis_status = 'ready' "
                "WHERE snapshot_path IS NOT NULL AND embedding IS NOT NULL AND prompt IS NOT NULL"
            )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_movie_files_playback_status "
            "ON movie_files (playback_status)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_scenes_analysis_status "
            "ON scenes (analysis_status)"
        )
