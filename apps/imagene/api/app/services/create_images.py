from typing import List, Dict, Any, Optional
import asyncio
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, asc
from models import CreateImageData, ImageData, ImageFilterData, KeywordData, ImageKeywordData
from db import Image, ImageGroup, Keyword, ImageKeyword
import random
from utils.embedding import get_text_embedding
from utils.stable_diffusion import generate_images_batch_async
import json, uuid
import os, shutil
from settings import settings


async def create_image_batch(create_image_data_list: List[CreateImageData], db: Session) -> List[ImageData]:
    created_images = []
    
    # 키워드 데이터에서 key, value 쌍 추출
    keyword_pairs = []
    for cid in create_image_data_list:
        for ikd in cid.keywords:
            keyword_pairs.append((ikd.key, ikd.value))
    
    # 한 번에 모든 매칭되는 키워드들을 가져오기
    keywords = db.query(Keyword).filter(
        and_(
            Keyword.key.in_([pair[0] for pair in keyword_pairs]),
            Keyword.value.in_([pair[1] for pair in keyword_pairs])
        )
    ).all()
    
    # 키워드 매핑 생성 (key, value) -> Keyword 객체
    keyword_map = {(kw.key, kw.value): kw for kw in keywords}

    # 매칭되는 키워드들의 n_created 증가 및 없는 키워드 새로 생성
    for cid in create_image_data_list:
        for ikd in cid.keywords:            
            if (ikd.key, ikd.value) not in keyword_map:
                # 새로운 키워드 생성
                new_keyword = Keyword(key=ikd.key, value=ikd.value, n_created=1)
                db.add(new_keyword)
                keyword_map[(ikd.key, ikd.value)] = new_keyword
                db.flush()
            else:
                kw = keyword_map[(ikd.key, ikd.value)]
                kw.n_created += 1
                kw.choice_rate = 1.0 - (kw.n_deleted / kw.n_created)
                db.flush()
    db.commit()

    batch_mode = True
    positive_prompt_list = []
    negative_prompt_list = []
    embedding_list = []
    seed_list = []
    model_list = []
    step_list = []
    cfg_list = []
    height_list = []
    width_list = []
    for i,cid in enumerate(create_image_data_list):
        positive_prompt = ""
        negative_prompt = ""
        # weight 높은 순으로 정렬
        cid.keywords.sort(key=lambda x: x.weight, reverse=True)
        for ikd in cid.keywords:
            if ikd.direction > 0:
                positive_prompt += f"{ikd.value},"
            elif ikd.direction < 0:
                negative_prompt += f"{ikd.value},"
            else:
                continue

        positive_prompt_list.append(positive_prompt.rstrip(","))
        negative_prompt_list.append(negative_prompt.rstrip(","))
        embedding_list.append(await asyncio.to_thread(get_text_embedding, positive_prompt))

        seed_list.append(cid.seed)

        model_list.append(cid.model)
        step_list.append(cid.steps)
        cfg_list.append(cid.cfg)
        height_list.append(cid.height)
        width_list.append(cid.width)
        if i > 0:
            if cid.model != model_list[i-1]:
                batch_mode = False
            if cid.steps != step_list[i-1]:
                batch_mode = False
            if cid.cfg != cfg_list[i-1]:
                batch_mode = False
            if cid.height != height_list[i-1]:
                batch_mode = False
            if cid.width != width_list[i-1]:
                batch_mode = False               

    images_list_total = []
    seed_list_total = []
    if batch_mode:
        images_list, generators_chunk = await generate_images_batch_async(
                                        ckpt_path=model_list[0], 
                                        positive_prompt_list=positive_prompt_list, 
                                        negative_prompt_list=negative_prompt_list,
                                        seed_list=seed_list,
                                        step=step_list[0], 
                                        cfg=cfg_list[0], 
                                        height=height_list[0], 
                                        width=width_list[0],
                                        max_chunk_size=settings.sd_max_chunk_size)
        images_list_total.extend(images_list)
        seed_list_total.extend(generators_chunk)
    else:
        for i in range(len(create_image_data_list)):
            images_list, generators_chunk = await generate_images_batch_async( 
                                        ckpt_path=model_list[i], 
                                        positive_prompt_list=[positive_prompt_list[i]], 
                                        negative_prompt_list=[negative_prompt_list[i]], 
                                        seed_list=[seed_list[i]],
                                        step=step_list[i], 
                                        cfg=cfg_list[i], 
                                        height=height_list[i], 
                                        width=width_list[i],
                                        max_chunk_size=settings.sd_max_chunk_size)
            images_list_total.extend(images_list)
            seed_list_total.extend(generators_chunk)


    for i, image_file in enumerate(images_list_total):
        image_id = str(uuid.uuid4().hex)
        url = f"figures/{image_id}.jpg"
        await asyncio.to_thread(image_file.save, url, format="JPEG", quality=85)

        image = Image(
            id=image_id,
            positive_prompt=positive_prompt_list[i],
            negative_prompt=negative_prompt_list[i],
            model=model_list[i],
            steps=step_list[i],
            cfg=float(cfg_list[i]),
            height=int(height_list[i]),
            width=int(width_list[i]),
            seed=int(seed_list_total[i]),
            embedding=embedding_list[i],
            url=url,
        )
        db.add(image)

        create_image_data = create_image_data_list[i]
        for ikd in create_image_data.keywords:
            keyword = keyword_map[(ikd.key, ikd.value)]
            if keyword:
                image_keyword = ImageKeyword(
                    image_id=image_id,
                    keyword_id=keyword.id,
                    direction=ikd.direction,
                    weight=ikd.weight
                )
                db.add(image_keyword)

        if create_image_data.groups:
            for image_group in create_image_data.groups:
                image_group = ImageGroup(
                    image_id=image_id,
                    group_id=image_group.id,
                    position=image_group.position
                )
                db.add(image_group)
        db.flush()

        created_images.append(ImageData(
            id=image.id,
            positive_prompt=image.positive_prompt,
            negative_prompt=image.negative_prompt,
            model=image.model,
            steps=image.steps,
            cfg=image.cfg,
            height=image.height,
            width=image.width,
            seed=image.seed,
            url=image.url,
            keywords=[
                ImageKeywordData(
                    key=ik.keyword.key,
                    value=ik.keyword.value,
                    direction=ik.direction,
                    weight=ik.weight,
                )
                for ik in image.keywords
            ],
        ))

    # 키워드 업데이트와 이미지 생성을 한 번에 커밋
    db.commit()
    return created_images
