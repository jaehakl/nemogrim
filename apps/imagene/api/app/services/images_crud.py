from typing import List, Dict, Any, Optional
import asyncio
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, asc
from models import ImageData, ImageFilterData, KeywordData
from db import Image, ImageGroup, Keyword
import random
from utils.embedding import get_text_embedding
from utils.stable_diffusion import generate_images_batch
import json, uuid
import os, shutil
from settings import settings


async def create_image_batch(keywords_data_list: List[List[KeywordData]], db: Session) -> List[ImageData]:
    """
    키워드 데이터를 기반으로 이미지를 생성합니다.
    """
    images = []
    
    # 키워드 데이터에서 key, value 쌍 추출
    keyword_pairs = []
    for keywords_data in keywords_data_list:
        for keyword_data in keywords_data:
            keyword_pairs.append((keyword_data.key, keyword_data.value))
    
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
    for keywords_data in keywords_data_list:
        for keyword_data in keywords_data:
            key, value = keyword_data.key, keyword_data.value
            
            if (key, value) in keyword_map:
                # 기존 키워드의 n_created 증가
                keyword_map[(key, value)].n_created += 1
            else:
                # 새로운 키워드 생성
                new_keyword = Keyword(
                    key=key,
                    value=value,
                    direction=keyword_data.direction,
                    n_created=1,
                    n_deleted=0
                )
                db.add(new_keyword)
                keyword_map[(key, value)] = new_keyword


    dna_list = []
    embedding_list = []
    positive_prompt_list = []
    negative_prompt_list = []
    steps_list = []
    cfg_list = []
    height_list = []
    width_list = []
    for keywords_data in keywords_data_list:
        dna = []
        positive_prompt = ""
        negative_prompt = ""
        for keyword_data in keywords_data:
            dna.append({
                "key": keyword_data.key,
                "value": keyword_data.value,
                "direction": keyword_data.direction
            })
            if keyword_data.key == "steps":
                steps_list.append(int(keyword_data.value))
            if keyword_data.key == "cfg":
                cfg_list.append(float(keyword_data.value))
            if keyword_data.key == "height":
                height_list.append(int(keyword_data.value))
            if keyword_data.key == "width":
                width_list.append(int(keyword_data.value))
            if keyword_data.direction > 0:
                positive_prompt += f"{keyword_data.value},"
            else:
                negative_prompt += f"{keyword_data.value},"
        dna_list.append(json.dumps(dna))
        embedding_list.append(await asyncio.to_thread(get_text_embedding, positive_prompt))
        positive_prompt_list.append(positive_prompt.rstrip(","))
        negative_prompt_list.append(negative_prompt.rstrip(","))

    if len(steps_list) == len(cfg_list) == len(height_list) == len(width_list) == len(positive_prompt_list) == len(negative_prompt_list) > 0:
        pass
    else:
        print("Error: 필수 키워드가 빠진 것이 있습니다.")
        return []
    
    def check_batch_mode_available(list, batch_mode = True):
        batch_mode = True
        value = list[0]
        for value in list:
            if value == value:
                pass
            else:
                batch_mode = False
        return batch_mode

    batch_mode = True
    for list in [steps_list, cfg_list, height_list, width_list]:
        batch_mode = check_batch_mode_available(list, batch_mode)

    if batch_mode:
        print("Batch mode is available.")
        step = steps_list[0]
        cfg = cfg_list[0]
        height = height_list[0]
        width = width_list[0]
        images_list = await asyncio.to_thread(generate_images_batch, 
                                        ckpt_path=settings.sd_model_path, 
                                        positive_prompt_list=positive_prompt_list, 
                                        negative_prompt_list=negative_prompt_list, 
                                        step=step, 
                                        cfg=cfg, 
                                        height=height, 
                                        width=width,
                                        max_chunk_size=16)
    else:
        images_list = []
        print("Batch mode is not available.")
        for i in range(len(keywords_data_list)):
            images_list.extend(await asyncio.to_thread(generate_images_batch, 
                                        ckpt_path=settings.sd_model_path, 
                                        positive_prompt_list=[positive_prompt_list[i]], 
                                        negative_prompt_list=[negative_prompt_list[i]], 
                                        step=steps_list[i], 
                                        cfg=cfg_list[i], 
                                        height=height_list[i], 
                                        width=width_list[i]))

    print("images_list", images_list)
    for i, image_file in enumerate(images_list):
        image_id = str(uuid.uuid4().hex)
        url = f"figures/{image_id}.jpg"
        print("saving image to", url)
        await asyncio.to_thread(image_file.save, url, format="JPEG", quality=85)
        print("image saved to", url)

        image = Image(
            dna=dna_list[i],
            url=url,
            embedding=embedding_list[i]
        )
        db.add(image)
        db.flush()  # ID를 얻기 위해 flush
        images.append(ImageData(
            id=image.id,
            url=image.url,
            dna=image.dna
        ))

    # 키워드 업데이트와 이미지 생성을 한 번에 커밋
    db.commit()
    print(len(images), "images created")
    return images


def filter_images(search_images_data: ImageFilterData, db: Session) -> Dict[str, List[ImageData]]:
    """
    이미지를 필터링하여 검색합니다.
    그룹별로 딕셔너리 형태로 결과를 반환합니다.
    하나의 이미지가 여러 그룹에 속할 수 있으므로 모든 그룹에 포함됩니다.
    """
    # 먼저 이미지들을 필터링
    image_query = db.query(Image.id, Image.url, Image.dna)
    
    # 검색어로 필터링 (DNA에서 검색)
    if search_images_data.search_value:
        search_key_values = search_images_data.search_value.split(",")
        for key_value in search_key_values:
            search_key, search_value = key_value.split(":")
            image_query = image_query.filter(
                and_(
                    Image.dna.like(f"%{search_key.strip()}%"),
                    Image.dna.like(f"%{search_value.strip()}%")
                )
            )
    
    # 정렬 (최신순)
    image_query = image_query.order_by(desc(Image.created_at))
    
    # 페이지네이션
    if search_images_data.offset:
        image_query = image_query.offset(search_images_data.offset)
    
    if search_images_data.limit:
        image_query = image_query.limit(search_images_data.limit)
    
    images = image_query.all()
    
    if not images:
        return {}
    
    # 이미지 ID들 추출
    image_ids = [img[0] for img in images]
    
    # 그룹 이름으로 필터링이 있는 경우
    if search_images_data.group_names:
        # 특정 그룹에 속한 이미지들만 가져오기
        group_query = db.query(Image.id, Image.url, Image.dna, ImageGroup.name.label('group_name')).join(ImageGroup).filter(
            and_(
                Image.id.in_(image_ids),
                ImageGroup.name.in_(search_images_data.group_names)
            )
        )
        group_images = group_query.all()
    else:
        # 모든 그룹 정보 가져오기
        group_query = db.query(Image.id, Image.url, Image.dna, ImageGroup.name.label('group_name')).outerjoin(ImageGroup).filter(
            Image.id.in_(image_ids)
        )
        group_images = group_query.all()
    
    # 그룹별로 이미지들을 정리
    result_dict = {}
    grouped_image_ids = set()  # 그룹에 속한 이미지 ID들 추적
    
    for image in group_images:
        group_name = image[3]  # group_name
        if group_name:  # 그룹이 있는 경우만
            if group_name not in result_dict:
                result_dict[group_name] = []
            
            result_dict[group_name].append(ImageData(
                id=image[0],  # image[0] = id
                url=image[1],  # image[1] = url
                dna=image[2]   # image[2] = dna
            ))
            grouped_image_ids.add(image[0])
    
    # 그룹에 속하지 않은 이미지들을 _ungrouped_에 추가
    if not search_images_data.group_names:
        ungrouped_images = []
        for image in images:
            if image[0] not in grouped_image_ids:  # image[0] = id
                ungrouped_images.append(ImageData(
                    id=image[0],  # image[0] = id
                    url=image[1],  # image[1] = url
                    dna=image[2]   # image[2] = dna
                ))
        
        if ungrouped_images:
            result_dict["_ungrouped_"] = ungrouped_images
    
    return result_dict


def get_image_detail(image_id: int, db: Session) -> Dict[str, List[ImageData]]:
    """
    특정 이미지의 상세 정보를 가져옵니다.
    관련된 그룹의 이미지들(최대 10개)과 embedding이 가까운 이미지 30개를 포함합니다.
    """
    image = db.query(Image.id, Image.url, Image.dna, Image.embedding).filter(Image.id == image_id).first()
    
    if not image:
        return {"images": [], "group_images": [], "similar_images": []}
    
    # 관련된 그룹 정보 가져오기
    groups = db.query(ImageGroup).filter(ImageGroup.image_id == image_id).all()
    group_names = [group.name for group in groups]
    
    # 관련된 그룹의 다른 이미지들 가져오기 (각 그룹당 최대 10개)
    group_images_dict = {}
    if group_names:
        # 한 번에 모든 그룹의 이미지들을 가져오기 (embedding 필드 제외)
        group_images_query = db.query(Image.id, Image.url, Image.dna, ImageGroup.name.label('group_name')).join(ImageGroup).filter(
            and_(
                ImageGroup.name.in_(group_names),
                Image.id != image_id  # 자기 자신 제외
            )
        ).order_by(ImageGroup.name, Image.created_at.desc())
        
        # 그룹별로 이미지들을 정리
        for img_id, img_url, img_dna, group_name in group_images_query.all():
            if group_name not in group_images_dict:
                group_images_dict[group_name] = []
            
            # 각 그룹당 최대 10개까지만
            if len(group_images_dict[group_name]) < 10:
                group_images_dict[group_name].append(ImageData(
                    id=img_id,
                    url=img_url,
                    dna=img_dna
                ))

    # embedding이 가까운 이미지들 가져오기 (최대 30개)
    similar_images = []
    if image[3] is not None:  # image[3] = embedding
        # pgvector를 사용한 코사인 유사도 검색 (embedding 필드 제외)
        similar_images_query = db.query(Image.id, Image.url, Image.dna).filter(
            and_(
                Image.id != image_id,  # 자기 자신 제외
                Image.embedding.isnot(None)  # embedding이 있는 이미지만
            )
        ).order_by(
            Image.embedding.cosine_distance(image[3])  # image[3] = embedding
        ).limit(30)
        
        similar_images = [
            ImageData(
                id=img[0],  # img[0] = id
                url=img[1],  # img[1] = url
                dna=img[2]   # img[2] = dna
            )
            for img in similar_images_query.all()
        ]
    
    # 선택된 이미지의 상세 정보
    image_data = ImageData(
        id=image[0],  # image[0] = id
        url=image[1],  # image[1] = url
        dna=image[2]   # image[2] = dna
    )
    result_dict = {}
    result_dict["_self_"] = [image_data]
    for group_name, group_images in group_images_dict.items():
        result_dict[group_name] = group_images
    result_dict["_similar_"] = similar_images    
    return result_dict


def delete_images_batch(image_ids: List[int], db: Session) -> str:
    """
    여러 이미지를 일괄 삭제합니다.
    삭제된 이미지의 DNA를 파싱하여 관련 키워드들의 n_deleted를 감소시킵니다.
    """
    # 이미지 존재 여부 확인 및 DNA 정보 수집 (id와 dna만 가져오기)
    existing_images = db.query(Image.id, Image.dna, Image.url).filter(Image.id.in_(image_ids)).all()
    existing_urls = {img[0]: img[2] for img in existing_images}  # img[2] = url
    existing_ids = [img[0] for img in existing_images]  # img[0] = id
    
    if not existing_ids:
        return "삭제할 이미지가 없습니다."
    
    # 삭제될 이미지들의 DNA에서 키워드 정보 추출
    keyword_pairs = []
    for img in existing_images:
        if img[1]:  # img[1] = dna
            try:
                dna_data = json.loads(img[1])  # img[1] = dna
                for keyword_info in dna_data:
                    if isinstance(keyword_info, dict) and 'key' in keyword_info and 'value' in keyword_info:
                        keyword_pairs.append((keyword_info['key'], keyword_info['value']))
            except (json.JSONDecodeError, TypeError):
                # DNA 파싱 실패 시 무시
                continue
    
    # 키워드 데이터가 있으면 n_deleted 감소
    if keyword_pairs:
        # 한 번에 모든 매칭되는 키워드들을 가져오기
        keywords = db.query(Keyword).filter(
            and_(
                Keyword.key.in_([pair[0] for pair in keyword_pairs]),
                Keyword.value.in_([pair[1] for pair in keyword_pairs])
            )
        ).all()
        
        # 키워드 매핑 생성 (key, value) -> Keyword 객체
        keyword_map = {(kw.key, kw.value): kw for kw in keywords}
        
        # 매칭되는 키워드들의 n_deleted 감소
        for key, value in keyword_pairs:
            if (key, value) in keyword_map:
                keyword_map[(key, value)].n_deleted += 1
    
    # 이미지 삭제 (CASCADE로 그룹도 자동 삭제됨)
    deleted_count = db.query(Image).filter(Image.id.in_(list(existing_urls.keys()))).delete(synchronize_session=False)
    for image_url in list(existing_urls.values()):
        try:
            if os.path.exists(image_url):
                os.remove(image_url)
        except Exception as e:
            print(f"이미지 파일 삭제 실패: {image_url}, 오류: {str(e)}")
    
    db.commit()
    
    return f"{deleted_count}개의 이미지가 삭제되었습니다."
