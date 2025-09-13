from typing import List, Dict, Any, Optional
import asyncio
from sqlalchemy.orm import Session, selectinload, load_only, defer
from sqlalchemy import and_, or_, func, desc, asc
from models import CreateImageData, ImageData, ImageFilterData, KeywordData, ImageKeywordData
from db import Image, ImageGroup, Keyword, ImageKeyword
import random
from utils.embedding import get_text_embedding
from utils.stable_diffusion import generate_images_batch
import json, uuid
import os, shutil
from settings import settings


def delete_images_batch(image_ids: List[str], db: Session) -> str:
    """
    여러 이미지를 일괄 삭제합니다.
    삭제된 이미지의 관련 키워드들의 n_deleted를 감소시킵니다.
    """
    existing_images = db.query(Image.id, Image.url).filter(Image.id.in_(image_ids)).all()
    existing_urls = {img[0]: img[1] for img in existing_images}
    existing_ids = [img[0] for img in existing_images]
    
    if not existing_ids:
        return "삭제할 이미지가 없습니다."
    
    image_keywords = db.query(ImageKeyword
        ).options(selectinload(ImageKeyword.keyword)
        ).filter(
            ImageKeyword.image_id.in_(existing_ids)
        ).all()

    for ik in image_keywords:
        ik.keyword.n_deleted += 1
        ik.keyword.choice_rate = ik.keyword.n_deleted / ik.keyword.n_created

    deleted_count = db.query(Image).filter(Image.id.in_(existing_ids)).delete(synchronize_session=False)
    for image_url in list(existing_urls.values()):
        try:
            if os.path.exists(image_url):
                os.remove(image_url)
        except Exception as e:
            print(f"이미지 파일 삭제 실패: {image_url}, 오류: {str(e)}")
    db.commit()
    
    return f"{deleted_count}개의 이미지가 삭제되었습니다."



#def get_image_detail(image_id: int, db: Session) -> Dict[str, List[ImageData]]:
#    """
#    특정 이미지의 상세 정보를 가져옵니다.
#    관련된 그룹의 이미지들(최대 10개)과 embedding이 가까운 이미지 30개를 포함합니다.
#    """
#    image = db.query(Image.id, Image.url, Image.dna, Image.embedding).filter(Image.id == image_id).first()
#    
#    if not image:
#        return {"images": [], "group_images": [], "similar_images": []}
#    
#    # 관련된 그룹 정보 가져오기
#    groups = db.query(ImageGroup).filter(ImageGroup.image_id == image_id).all()
#    group_names = [group.name for group in groups]
#    
#    # 관련된 그룹의 다른 이미지들 가져오기 (각 그룹당 최대 10개)
#    group_images_dict = {}
#    if group_names:
#        # 한 번에 모든 그룹의 이미지들을 가져오기 (embedding 필드 제외)
#        group_images_query = db.query(Image.id, Image.url, Image.dna, ImageGroup.name.label('group_name')).join(ImageGroup).filter(
#            and_(
#                ImageGroup.name.in_(group_names),
#                Image.id != image_id  # 자기 자신 제외
#            )
#        ).order_by(ImageGroup.name, Image.created_at.desc())
#        
#        # 그룹별로 이미지들을 정리
#        for img_id, img_url, img_dna, group_name in group_images_query.all():
#            if group_name not in group_images_dict:
#                group_images_dict[group_name] = []
#            
#            # 각 그룹당 최대 10개까지만
#            if len(group_images_dict[group_name]) < 10:
#                group_images_dict[group_name].append(ImageData(
#                    id=img_id,
#                    url=img_url,
#                    dna=img_dna
#                ))
#
#    # embedding이 가까운 이미지들 가져오기 (최대 30개)
#    similar_images = []
#    if image[3] is not None:  # image[3] = embedding
#        # pgvector를 사용한 코사인 유사도 검색 (embedding 필드 제외)
#        similar_images_query = db.query(Image.id, Image.url, Image.dna).filter(
#            and_(
#                Image.id != image_id,  # 자기 자신 제외
#                Image.embedding.isnot(None)  # embedding이 있는 이미지만
#            )
#        ).order_by(
#            Image.embedding.cosine_distance(image[3])  # image[3] = embedding
#        ).limit(30)
#        
#        similar_images = [
#            ImageData(
#                id=img[0],  # img[0] = id
#                url=img[1],  # img[1] = url
#                dna=img[2]   # img[2] = dna
#            )
#            for img in similar_images_query.all()
#        ]
#    
#    # 선택된 이미지의 상세 정보
#    image_data = ImageData(
#        id=image[0],  # image[0] = id
#        url=image[1],  # image[1] = url
#        dna=image[2]   # image[2] = dna
#    )
#    result_dict = {}
#    result_dict["_self_"] = [image_data]
#    for group_name, group_images in group_images_dict.items():
#        result_dict[group_name] = group_images
#    result_dict["_similar_"] = similar_images    
#    return result_dict
