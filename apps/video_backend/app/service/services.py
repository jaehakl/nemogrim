from initserver import VIDEO_DIR
from db import *
import os
import uuid
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict


class VideoService:
    @staticmethod
    def upload_video(file: UploadFile, actor: str, title: str, keywords: str, filename: str = "") -> Dict:
        """
        영상 파일과 메타데이터를 업로드하여 데이터베이스에 저장합니다.
        """
        db = SessionLocal()
        try:
            # 파일 확장자 검증
            if not file.filename.lower().endswith(('.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv')):
                raise HTTPException(status_code=400, detail="지원하지 않는 비디오 파일 형식입니다.")
            
            # 사용자가 지정한 파일명이 있으면 사용, 없으면 원본 파일명 사용
            final_filename = filename if filename.strip() else file.filename
            # 파일 확장자 추가 (원본 파일의 확장자 유지)
            original_ext = os.path.splitext(file.filename)[1]
            if not final_filename.lower().endswith(('.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv')):
                final_filename += original_ext
            
            # 중복 파일명 처리
            base_name, ext = os.path.splitext(final_filename)
            counter = 1
            original_final_filename = final_filename
            
            while os.path.exists(os.path.join(VIDEO_DIR, final_filename)):
                # UUID를 생성하여 파일명에 추가
                unique_id = str(uuid.uuid4())[:8]  # UUID의 앞 8자리만 사용
                final_filename = f"{base_name}_{unique_id}{ext}"
            
            # 파일을 서버에 저장
            file_location = os.path.join(VIDEO_DIR, final_filename)
            with open(file_location, "wb+") as file_object:
                file_object.write(file.file.read())
            
            # 데이터베이스에 메타데이터 저장
            video_record = Video(
                actor=actor,
                title=title,
                filename=final_filename,
                keywords=keywords
            )
            
            db.add(video_record)
            db.commit()
            db.refresh(video_record)
            
            return {
                "id": video_record.id,
                "filename": final_filename,
                "actor": actor,
                "title": title,
                "keywords": keywords,
                "message": "비디오 파일과 메타데이터가 성공적으로 업로드되었습니다."
            }
            
        except HTTPException:
            raise
        except Exception as e:
            # 파일 저장 중 오류 발생 시 저장된 파일 삭제
            if os.path.exists(file_location):
                os.remove(file_location)
            raise HTTPException(status_code=500, detail=f"파일 업로드 중 오류가 발생했습니다: {str(e)}")
        finally:
            db.close()

    @staticmethod
    def list_videos() -> List[Dict]:
        """
        데이터베이스에 저장된 영상 메타데이터 목록을 반환합니다.
        """
        db = SessionLocal()
        try:
            videos = db.query(Video).all()
            return [
                {
                    "id": video.id,
                    "actor": video.actor,
                    "title": video.title,
                    "filename": video.filename,
                    "keywords": video.keywords,
                    "url": f"/videos/{video.filename}"
                }
                for video in videos
            ]
        finally:
            db.close()

    @staticmethod
    def get_video_by_id(video_id: int) -> Dict:
        """
        ID로 특정 영상의 메타데이터를 조회합니다.
        """
        db = SessionLocal()
        try:
            video = db.query(Video).filter(Video.id == video_id).first()
            if not video:
                raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다.")
            
            return {
                "id": video.id,
                "actor": video.actor,
                "title": video.title,
                "filename": video.filename,
                "keywords": video.keywords,
                "url": f"/videos/{video.filename}"
            }
        finally:
            db.close()

    @staticmethod
    def update_video(video_id: int, actor: str = None, title: str = None, keywords: str = None) -> Dict:
        """
        영상의 메타데이터를 업데이트합니다.
        """
        db = SessionLocal()
        try:
            video = db.query(Video).filter(Video.id == video_id).first()
            if not video:
                raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다.")
            
            # 업데이트할 필드들만 변경 (빈 문자열도 유효한 값으로 처리)
            if actor is not None:
                video.actor = actor
            if title is not None:
                video.title = title
            if keywords is not None:
                video.keywords = keywords
            
            db.commit()
            db.refresh(video)
            
            return {
                "id": video.id,
                "actor": video.actor,
                "title": video.title,
                "filename": video.filename,
                "keywords": video.keywords,
                "url": f"/videos/{video.filename}",
                "message": "영상 메타데이터가 성공적으로 업데이트되었습니다."
            }
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"메타데이터 업데이트 중 오류가 발생했습니다: {str(e)}")
        finally:
            db.close()

    @staticmethod
    def delete_video(video_id: int) -> Dict:
        """
        영상을 데이터베이스에서 삭제하고 파일도 함께 삭제합니다.
        """
        db = SessionLocal()
        try:
            video = db.query(Video).filter(Video.id == video_id).first()
            if not video:
                raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다.")
            
            # 파일 경로 생성
            file_path = os.path.join(VIDEO_DIR, video.filename)
            
            # 데이터베이스에서 영상 삭제
            db.delete(video)
            db.commit()
            
            # 파일 시스템에서 파일 삭제
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    # 파일 삭제 실패 시 로그 기록 (데이터베이스는 이미 삭제됨)
                    print(f"파일 삭제 실패: {file_path}, 오류: {str(e)}")
            
            return {
                "message": "영상과 파일이 성공적으로 삭제되었습니다.",
                "deleted_video_id": video_id,
                "deleted_filename": video.filename
            }
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"영상 삭제 중 오류가 발생했습니다: {str(e)}")
        finally:
            db.close()


