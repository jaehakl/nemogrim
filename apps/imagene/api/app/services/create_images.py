from typing import List, Dict, Any, Optional
import asyncio
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, asc
from models import CreateImageData, ImageData, ImageFilterData, KeywordData, ImageKeywordData, ImageRequestData
from db import ImageGroup, Keyword, ImageKeyword, Path, Image
import random
from utils.embedding import get_text_embedding
from utils.stable_diffusion import generate_images_batch_async, generate_images_multi_gpu_async, generate_images_from_image_multi_gpu_async
import json, uuid
import os, shutil
from settings import settings
from PIL import Image as PILImage


async def create_image_batch(image_request_data: ImageRequestData, db: Session) -> List[ImageData]:
    created_images = []
    embedding_list = []
    images_list_total = []
    seed_list_total = []

    image_file_list = []
    image_to_image_mode = False
    ir = image_request_data

    if ir:
        for positive_prompt in ir.positive_prompt_list:
            embedding_list.append(await asyncio.to_thread(get_text_embedding, positive_prompt))

        if ir.images and len(ir.images) == len(ir.positive_prompt_list):
            image_to_image_mode = True
            images = db.query(Image).filter(Image.id.in_(ir.images)).all()
            image_file_map = {}
            for image in images:
                image_file_map[image.id] = PILImage.open(image.url)
            for image_id in ir.images:
                if image_file_map[image_id] is None:
                    raise ValueError(f"Image file not found: {image_id}")
                image_file_list.append(image_file_map[image_id])

        if image_to_image_mode:
            # 멀티 GPU 지원으로 이미지 생성
            images_list, generators_chunk = await generate_images_from_image_multi_gpu_async(
                                            ckpt_path=ir.ckpt_path,
                                            positive_prompt_list=ir.positive_prompt_list, 
                                            negative_prompt_list=ir.negative_prompt_list,
                                            seed_list=ir.seed_list,
                                            image_list=image_file_list,
                                            strength=ir.strength,
                                            step=ir.steps, 
                                            cfg=ir.cfg, 
                                            height=ir.height, 
                                            width=ir.width,
                                            max_chunk_size=ir.max_chunk_size)
            images_list_total.extend(images_list)
            seed_list_total.extend(generators_chunk)

        else:
            images_list, generators_chunk = await generate_images_multi_gpu_async(
                                            ckpt_path=ir.ckpt_path, 
                                            positive_prompt_list=ir.positive_prompt_list, 
                                            negative_prompt_list=ir.negative_prompt_list,
                                            seed_list=ir.seed_list,
                                            step=ir.steps, 
                                            cfg=ir.cfg, 
                                            height=ir.height, 
                                            width=ir.width,
                                            max_chunk_size=ir.max_chunk_size)
            images_list_total.extend(images_list)
            seed_list_total.extend(generators_chunk)

        for i, image_file in enumerate(images_list_total):
            image_id = str(uuid.uuid4().hex)
            url = f"figures/{image_id}.jpg"
            await asyncio.to_thread(image_file.save, url, format="JPEG", quality=85)

            image = Image(
                id=image_id,
                positive_prompt=ir.positive_prompt_list[i],
                negative_prompt=ir.negative_prompt_list[i],
                model=ir.ckpt_path,
                steps=int(ir.steps),
                cfg=float(ir.cfg),
                height=int(ir.height),
                width=int(ir.width),
                seed=int(seed_list_total[i]),
                embedding=embedding_list[i],
                url=url,
            )
            db.add(image)
            db.flush()

            path = Path(
                image_id=image.id,
                path=ir.path + image.id,
            )
            db.add(path)
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
                keywords=[],
            ))

        db.commit()
    return created_images