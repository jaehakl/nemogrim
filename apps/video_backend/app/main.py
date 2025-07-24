from fastapi import Form
from initserver import server
from fastapi import UploadFile, File
from pydantic import BaseModel
from service.services import VideoService
from service.history_service import HistoryService

app = server()


@app.post("/upload-video/")
async def upload_video(
    file: UploadFile = File(...),
    actor: str = Form(...),
    title: str = Form(...),
    keywords: str = Form(""),
    filename: str = Form("")
):
    """영상 파일과 메타데이터를 업로드합니다."""
    return VideoService.upload_video(file, actor, title, keywords, filename)


@app.get("/list-videos/")
async def list_videos():
    """저장된 영상 목록을 반환합니다."""
    return VideoService.list_videos()


@app.get("/video/{video_id}")
async def get_video(video_id: int):
    """특정 ID의 영상 메타데이터를 조회합니다."""
    return VideoService.get_video_by_id(video_id)


@app.put("/video/{video_id}")
async def update_video(
    video_id: int,
    actor: str = Form(default=None),
    title: str = Form(default=None),
    keywords: str = Form(default=None)
):
    """영상의 메타데이터를 업데이트합니다."""
    return VideoService.update_video(video_id, actor, title, keywords)


@app.delete("/video/{video_id}")
async def delete_video(video_id: int):
    """영상을 삭제합니다."""
    return VideoService.delete_video(video_id)


# 시청 기록 관련 엔드포인트
class HistoryCreateRequest(BaseModel):
    video_id: int
    current_time: float
    is_favorite: bool = False
    keywords: str = ""

@app.post("/history/")
async def create_history(request: HistoryCreateRequest):
    """시청 기록을 생성합니다."""
    return HistoryService.create_history(request.video_id, request.current_time, request.is_favorite, request.keywords)

@app.get("/history/{video_id}")
async def get_video_history(video_id: int):
    """특정 영상의 시청 기록을 조회합니다."""
    return HistoryService.get_video_history(video_id)

@app.get("/favorites/")
async def get_all_favorites():
    """모든 즐겨찾기 기록을 조회합니다."""
    return HistoryService.get_all_favorites()

@app.put("/history/{history_id}/favorite")
async def toggle_favorite(history_id: int):
    """즐겨찾기 상태를 토글합니다."""
    return HistoryService.toggle_favorite(history_id)

@app.delete("/history/{history_id}")
async def delete_history(history_id: int):
    """시청 기록을 삭제합니다."""
    return HistoryService.delete_history(history_id)

# 로컬에서 실행하기 위한 부분 (개발용)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)