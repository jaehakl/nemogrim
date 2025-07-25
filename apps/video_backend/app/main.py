from fastapi import Form
from initserver import server
from fastapi import UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from service.video_service import VideoService
from service.history_service import HistoryService, HistoryCreateRequest
from typing import List
import os

app = server()

# 썸네일 정적 파일 제공
if os.path.exists("thumbnails"):
    app.mount("/thumbnails", StaticFiles(directory="thumbnails"), name="thumbnails")


@app.post("/upload-video/")
def upload_video(
    file: UploadFile = File(...),
    actor: str = Form(...),
    title: str = Form(...),
    keywords: str = Form(""),
    filename: str = Form("")
):
    """영상 파일과 메타데이터를 업로드합니다."""
    return VideoService.upload_video(file, actor, title, keywords, filename)


@app.get("/list-videos/")
def list_videos():
    """저장된 영상 목록을 반환합니다."""
    return VideoService.list_videos()


@app.get("/video/{video_id}")
def get_video(video_id: int):
    """특정 ID의 영상 메타데이터를 조회합니다."""
    return VideoService.get_video_by_id(video_id)


@app.post("/video-update/{video_id}")
def update_video(video_id: int, data: dict):
    """영상의 메타데이터를 업데이트합니다."""
    return VideoService.update_video(video_id, data)


@app.delete("/video/{video_id}")
def delete_video(video_id: int):
    """영상을 삭제합니다."""
    return VideoService.delete_video(video_id)

@app.post("/history/")
def create_history(data: dict):
    """시청 기록을 생성합니다."""
    return HistoryService.create_history(data)

@app.get("/history/{video_id}")
def get_video_history(video_id: int):
    """특정 영상의 시청 기록을 조회합니다."""
    return HistoryService.get_video_history(video_id)

@app.get("/favorites/")
def get_all_favorites():
    """모든 즐겨찾기 기록을 조회합니다."""
    return HistoryService.get_all_favorites()

@app.put("/history/{history_id}/favorite")
def toggle_favorite(history_id: int):
    """즐겨찾기 상태를 토글합니다."""
    return HistoryService.toggle_favorite(history_id)

@app.delete("/history/{history_id}")
def delete_history(history_id: int):
    """시청 기록을 삭제합니다."""
    return HistoryService.delete_history(history_id)

@app.post("/history/{history_id}/thumbnail")
def create_thumbnail_for_history(history_id: int):
    """특정 시청 기록에 대한 썸네일을 생성합니다."""
    return HistoryService.create_thumbnail_for_history(history_id)

@app.post("/history/batch-create-thumbnails")
def batch_create_thumbnails(history_ids: List[int]):
    """여러 시청 기록에 대한 썸네일을 일괄 생성합니다."""
    return HistoryService.batch_create_thumbnails(history_ids)

@app.post("/sync-video-files/")
def sync_video_files():
    """VIDEO_DIR 내의 영상 파일들을 스캔하여 데이터베이스에 없는 파일들을 자동으로 등록합니다."""
    return VideoService.sync_video_files()

# 로컬에서 실행하기 위한 부분 (개발용)
if __name__ == "__main__":
    import uvicorn
    import logging
    
    # 정적 파일 요청 로그만 숨기기
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        access_log=False  # access log 비활성화
    )