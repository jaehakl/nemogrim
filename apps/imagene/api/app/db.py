from __future__ import annotations

from typing import List
from sqlalchemy import (create_engine, MetaData, func,
    text, Text,DateTime,Integer,ForeignKey,Index,Float,String,)
from sqlalchemy.orm import (DeclarativeBase,mapped_column,Mapped,relationship,sessionmaker,)
from sqlalchemy.dialects.postgresql import (UUID)
from pgvector.sqlalchemy import Vector

from settings import settings

# ---------------------------------------------------------------------
# Database URL & Engine
# ---------------------------------------------------------------------

DB_URL = settings.db_url
engine = create_engine(DB_URL, future=True, pool_pre_ping=True, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True, expire_on_commit=False)

# ---------------------------------------------------------------------
# Naming convention (good for migrations & consistent constraint names)
# ---------------------------------------------------------------------
naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=naming_convention)


# ---------------------------------------------------------------------
# Mixins
# ---------------------------------------------------------------------
class TimestampMixin:
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

# ---------------------------------------------------------------------
# Tables (App Layer)
# ---------------------------------------------------------------------

class Path(TimestampMixin, Base):
    __tablename__ = "image_paths"
    path: Mapped[str] = mapped_column(String, primary_key=True)
    image_id: Mapped[str] = mapped_column(String, ForeignKey("images.id", ondelete="CASCADE"), nullable=False)
    image: Mapped["Image"] = relationship("Image", back_populates="paths", lazy="selectin")

class Image(TimestampMixin, Base):
    __tablename__ = "images"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=True)
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    positive_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    negative_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    steps: Mapped[int] = mapped_column(Integer, nullable=False)
    cfg: Mapped[float] = mapped_column(Float, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding: Mapped[Vector] = mapped_column(Vector(768), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    paths: Mapped[List["Path"]] = relationship("Path", back_populates="image", cascade="all, delete-orphan")