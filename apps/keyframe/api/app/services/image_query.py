from pathlib import Path

from sqlalchemy import func, select

from ..db import DATA_DIR, Image, SessionLocal


def get_image_page(limit: int, before_id: int | None) -> dict:
    with SessionLocal() as database:
        statement = select(Image).order_by(Image.id.desc())
        if before_id is not None:
            statement = statement.where(Image.id < before_id)
        rows = list(database.scalars(statement.limit(limit + 1)).all())
        has_more = len(rows) > limit
        page = rows[:limit]
        return {
            "items": [
                {
                    "id": image.id,
                    "prompt": image.prompt,
                    "image_url": f"/api/images/{image.id}/file",
                }
                for image in page
            ],
            "total": database.scalar(select(func.count(Image.id))) or 0,
            "next_cursor": page[-1].id if has_more and page else None,
            "has_more": has_more,
        }


def image_file(image_id: int) -> Path:
    with SessionLocal() as database:
        image = database.get(Image, image_id)
        if image is None:
            raise FileNotFoundError("이미지를 찾을 수 없습니다")
        path = (DATA_DIR / image.file_path).resolve()
    if not path.is_relative_to(DATA_DIR.resolve()) or not path.is_file():
        raise FileNotFoundError("이미지 파일을 찾을 수 없습니다")
    return path
