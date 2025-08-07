from initserver import VIDEO_DIR
from db import *
import os, random
import uuid
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict
from fastapi.responses import FileResponse
from .thumbnail_service import ThumbnailService
from .history_service import HistoryService


class VideoService:
    @staticmethod
    def sync_video_files() -> Dict:
        """
        VIDEO_DIR 내의 영상 파일들을 스캔하여 데이터베이스에 없는 파일들을 자동으로 등록합니다.
        """
        db = SessionLocal()
        try:
            # 지원하는 비디오 파일 확장자
            video_extensions = ('.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv')
            
            # VIDEO_DIR 내의 모든 파일 스캔
            if not os.path.exists(VIDEO_DIR):
                raise HTTPException(status_code=404, detail="VIDEO_DIR이 존재하지 않습니다.")
            
            video_files = []
            for filename in os.listdir(VIDEO_DIR):
                if filename.lower().endswith(video_extensions):
                    video_files.append(filename)
            
            # 데이터베이스에 이미 등록된 파일명들 가져오기
            existing_videos = db.query(Video.filename).all()
            existing_filenames = {video.filename for video in existing_videos}
            
            # 새로 등록할 파일들 찾기
            new_files = [filename for filename in video_files if filename not in existing_filenames]
            
            registered_videos = []
            
            for filename in new_files:
                # 파일명에서 확장자 제거하여 제목으로 사용
                title = os.path.splitext(filename)[0]
                
                # 파일명을 기반으로 actor와 title 설정
                # 파일명에 언더스코어나 하이픈이 있으면 actor와 title로 분리
                if '_' in title:
                    parts = title.split('_', 1)  # 첫 번째 언더스코어만 기준으로 분리
                    actor = parts[0].strip()
                    title = parts[1].strip() if len(parts) > 1 else title
                elif '-' in title:
                    parts = title.split('-', 1)  # 첫 번째 하이픈만 기준으로 분리
                    actor = parts[0].strip()
                    title = parts[1].strip() if len(parts) > 1 else title
                else:
                    # 구분자가 없으면 전체를 title로 사용하고 actor는 "Unknown"으로 설정
                    actor = "Unknown"
                
                # 빈 문자열 처리
                if not title.strip():
                    title = filename
                if not actor.strip():
                    actor = "Unknown"
                
                # 데이터베이스에 새 비디오 레코드 생성
                video_record = Video(
                    actor=actor,
                    title=title,
                    filename=filename,
                    keywords=""  # 빈 키워드로 시작
                )
                
                db.add(video_record)
                registered_videos.append({
                    "filename": filename,
                    "actor": actor,
                    "title": title
                })
            
            db.commit()
            
            return {
                "message": f"총 {len(registered_videos)}개의 새로운 영상 파일이 등록되었습니다.",
                "registered_videos": registered_videos,
                "total_video_files": len(video_files),
                "existing_files": len(existing_filenames),
                "new_files": len(new_files)
            }
            
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"영상 파일 동기화 중 오류가 발생했습니다: {str(e)}")
        finally:
            db.close()

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
    def list_videos() -> Dict:
        """
        데이터베이스에 저장된 영상 메타데이터 목록을 반환합니다.
        """
        db = SessionLocal()
        try:
            videos = db.query(Video).all()
            list_videos = []
            keywords = set()
            
            for video in videos:
                # 비디오의 히스토리 중 썸네일이 있는 히스토리를 무작위로 선택
                thumbnail = None
                histories_with_thumbnail = db.query(VideoHistory).filter(
                    VideoHistory.video_id == video.id,
                    VideoHistory.thumbnail.isnot(None)
                ).all()
                
                if histories_with_thumbnail:
                    # 무작위로 하나의 썸네일 선택
                    random_history = random.choice(histories_with_thumbnail)
                    thumbnail = random_history.thumbnail
                
                for keyword in video.keywords.split(","):
                    keywords.add(keyword.strip())   

                list_videos.append({
                    "id": video.id,
                    "actor": video.actor,
                    "title": video.title,
                    "fps": video.fps,
                    "filename": video.filename,
                    "keywords": video.keywords,
                    "url": f"/videos/{video.filename}",
                    "thumbnail": "videos/" + thumbnail if thumbnail else None
                })
            random.shuffle(list_videos)
            return {"videos": list_videos, "keywords": list(keywords)}
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
                "fps": video.fps,
                "filename": video.filename,
                "keywords": video.keywords,
                "url": f"/videos/{video.filename}"
            }
        finally:
            db.close()

    @staticmethod
    def update_video(video_id: int, data: dict) -> Dict:
        actor = data.get("actor")
        title = data.get("title")
        keywords = data.get("keywords")
        fps = data.get("fps")
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
            if fps is not None:
                video.fps = fps
            db.commit()
            db.refresh(video)
            
            return {
                "id": video.id,
                "actor": video.actor,
                "title": video.title,
                "filename": video.filename,
                "keywords": video.keywords,
                "fps": video.fps,
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
            
            # 해당 영상의 모든 시청 기록을 개별적으로 삭제 (썸네일 파일도 함께 삭제됨)
            video_histories = db.query(VideoHistory).filter(VideoHistory.video_id == video_id).all()
            deleted_histories = []
            
            for history in video_histories:
                try:
                    # HistoryService의 delete_history 메서드 사용
                    result = HistoryService.delete_history(history.id)
                    deleted_histories.append(history.id)
                    print(f"시청 기록 삭제: {history.id}")
                except Exception as e:
                    print(f"시청 기록 삭제 실패: {history.id}, 오류: {str(e)}")
            
            # 데이터베이스에서 영상 삭제
            db.delete(video)
            db.commit()
            
            # 파일 시스템에서 영상 파일 삭제
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    print(f"영상 파일 삭제: {file_path}")
                except Exception as e:
                    # 파일 삭제 실패 시 로그 기록 (데이터베이스는 이미 삭제됨)
                    print(f"영상 파일 삭제 실패: {file_path}, 오류: {str(e)}")
            
            return {
                "message": "영상과 관련 파일들이 성공적으로 삭제되었습니다.",
                "deleted_video_id": video_id,
                "deleted_filename": video.filename,
                "deleted_histories": deleted_histories
            }
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"영상 삭제 중 오류가 발생했습니다: {str(e)}")
        finally:
            db.close()
