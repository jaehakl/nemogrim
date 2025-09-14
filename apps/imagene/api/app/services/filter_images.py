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


def filter_images(search_images_data: ImageFilterData, db: Session) -> List[ImageData]:
    print("start filter_images")
    # 기본 쿼리 (엔티티 쿼리 사용)
    query = db.query(Image)

    # 그룹 필터링
    if search_images_data.group_ids is None or len(search_images_data.group_ids) == 0:
        # 어떤 그룹에도 속하지 않은 이미지들만
        subquery = db.query(ImageGroup.image_id)
        query = query.filter(~Image.id.in_(subquery))
    elif len(search_images_data.group_ids) > 0:
        # 특정 그룹들에 속한 이미지들만
        subquery = db.query(ImageGroup.image_id).filter(ImageGroup.group_id.in_(search_images_data.group_ids))
        query = query.filter(Image.id.in_(subquery))
    else:
        # 빈 리스트([])면 그룹 필터를 적용하지 않음 (모든 이미지 대상)
        pass

    if search_images_data.keywords:
        # key별로 그룹화
        keyword_groups = {}
        for keyword in search_images_data.keywords:
            if keyword.key not in keyword_groups:
                keyword_groups[keyword.key] = []
            keyword_groups[keyword.key].append(keyword)
        
        # 각 key 그룹에 대해 OR 조건을 만들고, 그룹들 간에는 AND 조건 적용
        for key, keywords in keyword_groups.items():
            or_conditions = []
            for keyword in keywords:
                or_conditions.append(
                    and_(
                        ImageKeyword.keyword.has(Keyword.key == keyword.key),
                        ImageKeyword.keyword.has(Keyword.value == keyword.value)
                    )
                )
            if or_conditions:
                query = query.filter(Image.keywords.any(or_(*or_conditions)))

    
    # 검색어로 필터링 (title, positive_prompt)
    if search_images_data.search_value:
        search_values = search_images_data.search_value.split(",")
        for sv in search_values:
            value = sv.strip()
            if value:
                query = query.filter(
                    or_(
                        Image.title.like(f"%{value}%"),
                        Image.positive_prompt.like(f"%{value}%")
                    )
                )
    
    if search_images_data.model:
        query = query.filter(Image.model.like(f"%{search_images_data.model}%"))
    
    if search_images_data.score_range:
        query = query.filter(Image.score.between(search_images_data.score_range[0], search_images_data.score_range[1]))

    if search_images_data.steps_range:
        query = query.filter(Image.steps.between(search_images_data.steps_range[0], search_images_data.steps_range[1]))
    
    if search_images_data.cfg_range:
        query = query.filter(Image.cfg.between(search_images_data.cfg_range[0], search_images_data.cfg_range[1]))
    
    if search_images_data.resolutions:
        or_conditions = []
        for resolution in search_images_data.resolutions:
            or_conditions.append(
                and_(Image.height == resolution[0], Image.width == resolution[1])
            )
        if or_conditions:
            query = query.filter(or_(*or_conditions))

    if search_images_data.sort_by == "created_at":
        query = query.order_by(desc(Image.created_at)) if search_images_data.sort_order == "desc" else query.order_by(asc(Image.created_at))
    elif search_images_data.sort_by == "score":
        query = query.order_by(desc(Image.score)) if search_images_data.sort_order == "desc" else query.order_by(asc(Image.score))
    elif search_images_data.sort_by == "steps":
        query = query.order_by(desc(Image.steps)) if search_images_data.sort_order == "desc" else query.order_by(asc(Image.steps))
    elif search_images_data.sort_by == "cfg":
        query = query.order_by(desc(Image.cfg)) if search_images_data.sort_order == "desc" else query.order_by(asc(Image.cfg))
    elif search_images_data.sort_by == "height":
        query = query.order_by(desc(Image.height)) if search_images_data.sort_order == "desc" else query.order_by(asc(Image.height))
    elif search_images_data.sort_by == "width":
        query = query.order_by(desc(Image.width)) if search_images_data.sort_order == "desc" else query.order_by(asc(Image.width))
    elif search_images_data.sort_by == "random":
        query = query.order_by(func.random())
        
    if search_images_data.limit is not None:
        query = query.limit(search_images_data.limit)
    
    if search_images_data.offset is not None:
        query = query.offset(search_images_data.offset)
    print("start query")

    images: List[Image] = query.options(
        load_only(
            Image.id,
            Image.title,
            #Image.positive_prompt,
            #Image.negative_prompt,
            Image.model,
            Image.steps,
            Image.cfg,
            Image.height,
            Image.width,
            Image.seed,
            Image.url,
        ),
        defer(Image.embedding),
        selectinload(Image.keywords).load_only(
            ImageKeyword.id,
            ImageKeyword.direction,
            ImageKeyword.weight,
        ),
        selectinload(Image.keywords).selectinload(ImageKeyword.keyword).load_only(
            Keyword.key,
            Keyword.value,
        ),
    ).all()
    print("end query")
    result = [
        ImageData(
            id=image.id,
            title=image.title,
            #positive_prompt=image.positive_prompt,
            #negative_prompt=image.negative_prompt,
            model=image.model,
            steps=image.steps,
            cfg=image.cfg,
            height=image.height,
            width=image.width,
            seed=image.seed,
            url=image.url,
            keywords=[
                ImageKeywordData(
                    id=ik.keyword.id,
                    key=ik.keyword.key,
                    value=ik.keyword.value,
                    direction=ik.direction,
                    weight=ik.weight,
                )
                for ik in image.keywords
            ],
        )
        for image in images
    ]
    print("end filter_images")
    return result