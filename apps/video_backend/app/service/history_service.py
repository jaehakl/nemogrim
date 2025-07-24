from db import *
from sqlalchemy.orm import Session
from typing import List, Dict
from fastapi import HTTPException
from datetime import datetime


class HistoryService:
    @staticmethod
    def create_history(video_id: int, current_time: float, is_favorite: bool = False, keywords: str = "") -> Dict:
        """
        시청 기록을 생성합니다.
        """
        db = SessionLocal()
        try:
            # 비디오 존재 확인
            video = db.query(Video).filter(Video.id == video_id).first()
            if not video:
                raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다.")
            
            # 시청 기록 생성
            history = VideoHistory(
                video_id=video_id,
                timestamp=datetime.now(),
                current_time=int(current_time),
                keywords=keywords,
                is_favorite=is_favorite
            )
            
            db.add(history)
            db.commit()
            db.refresh(history)
            
            return {
                "id": history.id,
                "video_id": history.video_id,
                "timestamp": history.timestamp.isoformat(),
                "current_time": history.current_time,
                "keywords": history.keywords,
                "is_favorite": history.is_favorite
            }
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"시청 기록 생성 중 오류가 발생했습니다: {str(e)}")
        finally:
            db.close()

    @staticmethod
    def get_video_history(video_id: int) -> List[Dict]:
        """
        특정 영상의 시청 기록을 조회합니다.
        """
        db = SessionLocal()
        try:
            # 비디오 존재 확인
            video = db.query(Video).filter(Video.id == video_id).first()
            if not video:
                raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다.")
            
            histories = db.query(VideoHistory).filter(VideoHistory.video_id == video_id).order_by(VideoHistory.timestamp.desc()).all()
            
            return [
                {
                    "id": history.id,
                    "video_id": history.video_id,
                    "timestamp": history.timestamp.isoformat(),
                    "current_time": history.current_time,
                    "keywords": history.keywords,
                    "is_favorite": history.is_favorite
                }
                for history in histories
            ]
        finally:
            db.close()

    @staticmethod
    def get_all_favorites() -> List[Dict]:
        """
        모든 즐겨찾기 기록을 조회합니다.
        """
        db = SessionLocal()
        try:
            favorites = db.query(VideoHistory).filter(VideoHistory.is_favorite == True).order_by(VideoHistory.timestamp.desc()).all()
            
            return [
                {
                    "id": history.id,
                    "video_id": history.video_id,
                    "timestamp": history.timestamp.isoformat(),
                    "current_time": history.current_time,
                    "keywords": history.keywords,
                    "is_favorite": history.is_favorite,
                    "video": {
                        "id": history.video.id,
                        "filename": history.video.filename,
                        "title": history.video.title,
                        "actor": history.video.actor
                    }
                }
                for history in favorites
            ]
        finally:
            db.close()

    @staticmethod
    def toggle_favorite(history_id: int) -> Dict:
        """
        즐겨찾기 상태를 토글합니다.
        """
        db = SessionLocal()
        try:
            history = db.query(VideoHistory).filter(VideoHistory.id == history_id).first()
            if not history:
                raise HTTPException(status_code=404, detail="시청 기록을 찾을 수 없습니다.")
            
            history.is_favorite = not history.is_favorite
            db.commit()
            db.refresh(history)
            
            return {
                "id": history.id,
                "video_id": history.video_id,
                "timestamp": history.timestamp.isoformat(),
                "current_time": history.current_time,
                "keywords": history.keywords,
                "is_favorite": history.is_favorite
            }
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"즐겨찾기 토글 중 오류가 발생했습니다: {str(e)}")
        finally:
            db.close()

    @staticmethod
    def delete_history(history_id: int) -> Dict:
        """
        시청 기록을 삭제합니다.
        """
        db = SessionLocal()
        try:
            history = db.query(VideoHistory).filter(VideoHistory.id == history_id).first()
            if not history:
                raise HTTPException(status_code=404, detail="시청 기록을 찾을 수 없습니다.")
            
            db.delete(history)
            db.commit()
            
            return {"message": "시청 기록이 성공적으로 삭제되었습니다."}
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"시청 기록 삭제 중 오류가 발생했습니다: {str(e)}")
        finally:
            db.close() 