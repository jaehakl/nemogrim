from typing import List, Dict, Any, Optional
import asyncio
from sqlalchemy.orm import Session, selectinload, load_only, defer
from sqlalchemy import and_, or_, func, desc, asc
from models import ImageData
from db import Image,Path
import random
from utils.embedding import get_text_embedding
from utils.stable_diffusion import generate_images_batch
import json, uuid
import os, shutil
from settings import settings

def search_from_prompt(prompt: str, db: Session) -> Dict[str, Any]:
    """
    특정 프롬프트와 임베딩이 가까운 이미지를 검색합니다.
    """
    embedding = get_text_embedding(prompt)

    # embedding이 가까운 이미지들 가져오기 (최대 30개)
    similar_images = []
    if embedding is not None:  # image[3] = embedding
        # pgvector를 사용한 코사인 유사도 검색 (embedding 필드 제외)
        similar_images_query = db.query(Image).filter(
            and_(
                Image.embedding.isnot(None)  # embedding이 있는 이미지만
            )
        ).order_by(
            Image.embedding.cosine_distance(embedding)  # image[3] = embedding
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
        "similar_images": similar_images
    }       
    return result_dict
