from typing import List, Dict, Any, Optional
import asyncio
from sqlalchemy.orm import Session, selectinload, load_only, defer
from sqlalchemy import and_, or_, func, desc, asc
from models import ImageData
from db import Image, Path
import random
from utils.embedding import get_text_embedding
from utils.stable_diffusion import generate_images_batch
import json, uuid
import os, shutil
from settings import settings


def get_image_detail(image_id: int, db: Session) -> Dict[str, Any]:
    """
    특정 이미지의 상세 정보를 가져옵니다.
    이미지가 소속된 디렉토리들과 embedding이 가까운 이미지 30개를 포함합니다.
    """
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        return {"directories": [], "similar_images": []}

    directories = db.query(Path).filter(Path.image_id == image_id).all()
    directory_paths = ['/'.join(directory.path.split('/')[:-1])+'/' for directory in directories]

    # embedding이 가까운 이미지들 가져오기 (최대 30개)
    similar_images = []
    if image.embedding is not None:  # image[3] = embedding
        # pgvector를 사용한 코사인 유사도 검색 (embedding 필드 제외)
        similar_images_query = db.query(Image).filter(
            and_(
                Image.id != image_id,  # 자기 자신 제외
                Image.embedding.isnot(None)  # embedding이 있는 이미지만
            )
        ).order_by(
            Image.embedding.cosine_distance(image.embedding)  # image[3] = embedding
        ).limit(30)
        
        similar_images = [
            ImageData(
                id=img.id,
                title=img.title,
                positive_prompt=img.positive_prompt,
                negative_prompt=img.negative_prompt,
                model=img.model,
                steps=img.steps,
                cfg=img.cfg,
                height=img.height,
                width=img.width,
                seed=img.seed,
                url=img.url,
                keywords=[]
            )
            for img in similar_images_query.all()
        ]
    result_dict = {
        "directories": directory_paths,
        "similar_images": similar_images
    }       
    return result_dict
