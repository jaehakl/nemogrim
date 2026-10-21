from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    Engine,
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
    inspect,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

from .paths import DATA_DIR, scene_dir, thumbnail_dir


SCHEMA_VERSION = 2
DATABASE_PATH = DATA_DIR / "keyframe.sqlite3"

JOB_STATUSES = ("pending", "processing", "ready", "failed")
ACTIVE_JOB_STATUSES = ("pending", "processing")
PLAYBACK_STATUSES = ("unprepared", "direct", "failed")


def utc_now() -> datetime:
    """Return a naive UTC datetime for predictable SQLite storage."""
    return datetime.now(UTC).replace(tzinfo=None)


def _in_check(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


class Base(DeclarativeBase):
    pass


class MovieFile(Base):
    __tablename__ = "movie_files"
    __table_args__ = (
        CheckConstraint(
            _in_check("metadata_status", JOB_STATUSES),
            name="ck_movie_files_metadata_status",
        ),
        Index("ix_movie_files_status", "metadata_status"),
        CheckConstraint(
            _in_check("playback_status", PLAYBACK_STATUSES),
            name="ck_movie_files_playback_status",
        ),
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
    playback_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now, onupdate=utc_now
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
        CheckConstraint(
            _in_check("analysis_status", JOB_STATUSES),
            name="ck_scenes_analysis_status",
        ),
        Index("ix_scenes_search", "analysis_status", "embedding_model"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    movie_file_id: Mapped[int] = mapped_column(
        ForeignKey("movie_files.id", ondelete="CASCADE"), nullable=False
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
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now, onupdate=utc_now
    )

    movie_file: Mapped[MovieFile] = relationship(back_populates="scenes")


engine = create_engine(
    f"sqlite:///{DATABASE_PATH.as_posix()}",
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


def new_session() -> Session:
    """호출 시점의 `SessionLocal`로 세션을 연다. 테스트는 `app.db.SessionLocal`만 바꾸면 된다."""
    return SessionLocal()


def ensure_schema(bind: Engine) -> None:
    """빈 DB면 스키마를 만들고, 다른 버전의 DB면 기동을 중단한다. 마이그레이션은 하지 않는다."""
    with bind.begin() as connection:
        has_tables = bool(inspect(connection).get_table_names())
        version = connection.exec_driver_sql("PRAGMA user_version").scalar()
        if has_tables and version != SCHEMA_VERSION:
            raise RuntimeError(
                f"DB 스키마 버전(v{version})이 현재 버전(v{SCHEMA_VERSION})과 다릅니다. "
                "data/keyframe.sqlite3* 파일을 백업한 뒤 삭제하고 다시 시작하세요."
            )
        Base.metadata.create_all(connection)
        if version != SCHEMA_VERSION:
            connection.exec_driver_sql(f"PRAGMA user_version = {SCHEMA_VERSION}")


def init_db() -> None:
    for directory in (DATA_DIR, thumbnail_dir(), scene_dir()):
        directory.mkdir(parents=True, exist_ok=True)
    ensure_schema(engine)
