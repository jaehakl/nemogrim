from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import relationship, Session, declarative_base
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey, DateTime, Boolean
from datetime import datetime

DATABASE_URL = "sqlite:///./db.sqlite3"
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

Base = declarative_base()

class Video(Base):
    __tablename__ = "video"
    id = Column(Integer, primary_key=True, index=True)
    actor = Column(String(100))
    title = Column(Text)
    filename = Column(Text)
    keywords = Column(Text)
    history = relationship("VideoHistory", back_populates="video", cascade="all, delete")

class VideoHistory(Base):
    __tablename__ = "video_history"
    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("video.id", ondelete="CASCADE"))
    timestamp = Column(DateTime, default=datetime.now)    
    current_time = Column(Integer, default=0)  # 재생 시점 (초)
    thumbnail = Column(Text, nullable=True)
    keywords = Column(Text)
    is_favorite = Column(Boolean, default=False)
    video = relationship("Video", back_populates="history")


