# db.py
from sqlalchemy import (
    Column, Integer, String, ForeignKey, Date, JSON,
    create_engine, DateTime
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from pgvector.sqlalchemy import Vector
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
import os, sys
from datetime import datetime
from dotenv import load_dotenv

def get_base_dir():
    if getattr(sys, 'frozen', False):
        # 실행파일(.exe)로 패키징된 경우
        return os.path.dirname(sys.executable)
    else:
        # 일반 파이썬 스크립트로 실행되는 경우
        return os.path.dirname(os.path.abspath(__file__))+'/..'
    
BASE_DIR = get_base_dir()
os.environ['QUTAT_NEMOGRIM_CURA_BASE_DIR'] = BASE_DIR
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(env_path)
print("BASE_DIR: ", os.getenv('QUTAT_NEMOGRIM_CURA_BASE_DIR'))

# DB URL 설정
DATABASE_URL = os.getenv("QUTAT_NEMOGRIM_CURA_DB_URL")
print("DATABASE_URL: ", DATABASE_URL)

# 비동기 엔진 및 세션
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()

class Figure(Base):
    __tablename__ = "figure"
    id = Column(Integer, primary_key=True)
    action = Column(String)
    girl_type = Column(String)
    girl_emotion = Column(String)
    girl_head = Column(String)
    girl_body = Column(String)
    girl_pose = Column(String)
    girl_top = Column(String)
    girl_bottom = Column(String)
    girl_underwear = Column(String)
    people = Column(String)
    situation = Column(String)
    background = Column(String)
    embedding = Column(Vector(768))
    file_path = Column(String)