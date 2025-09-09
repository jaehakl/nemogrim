from __future__ import annotations

from typing import List
from sqlalchemy import (create_engine, MetaData, func,
    text, Text,DateTime,Integer,ForeignKey,Index,Float,)
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

class Keyword(TimestampMixin, Base):
    __tablename__ = "keywords"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    direction: Mapped[float] = mapped_column(Float, nullable=False)
    n_created: Mapped[int] = mapped_column(Integer, nullable=False)
    n_deleted: Mapped[int] = mapped_column(Integer, nullable=False)


class Image(TimestampMixin, Base):
    __tablename__ = "images"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dna: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[Vector] = mapped_column(Vector(768), nullable=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    groups: Mapped[List["ImageGroup"]] = relationship("ImageGroup", back_populates="image", cascade="all, delete-orphan")


class ImageGroup(TimestampMixin, Base):
    __tablename__ = "image_groups"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    image_id: Mapped[int] = mapped_column(Integer, ForeignKey("images.id", ondelete="CASCADE"), nullable=False)
    image: Mapped["Image"] = relationship("Image", back_populates="groups")
    __table_args__ = (Index("idx_image_groups_name", "name"),)