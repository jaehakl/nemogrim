from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, asc
from models import ImageData, GroupPreviewData, KeywordData
from db import Image, ImageGroup, Group, Keyword, ImageKeyword


def set_image_group_batch(group_image_data:Dict[str, Any], db: Session) -> str:
    """
    여러 이미지를 특정 그룹에 설정합니다.
    """

    if "group_id" in group_image_data and group_image_data["group_id"] is not None:
        group_id = group_image_data["group_id"]
        group = db.query(Group).filter(Group.id == group_id).first()
        group_name = group.name
    elif "group_name" in group_image_data and group_image_data["group_name"] is not None:
        # 새로운 그룹 생성
        group = Group(
            name=group_image_data["group_name"]
        )
        db.add(group)
        db.flush()
        group_id = group.id
        group_name = group.name
    else:
        raise ValueError("group_id 또는 group_name이 필요합니다.")        

    image_ids = group_image_data["image_ids"]
    for image_id in image_ids:
        group_relation = ImageGroup(
            group_id=group_id,
            image_id=image_id,
        )
        db.add(group_relation)

    db.commit()    
    return f"{len(image_ids)}개의 이미지가 '{group_name}' 그룹에 설정되었습니다."


def delete_group_batch(group_ids: List[int], db: Session) -> str:
    deleted_count = db.query(Group).filter(Group.id.in_(group_ids)).delete(synchronize_session=False)
    db.commit()    
    return f"{deleted_count}개의 그룹이 삭제되었습니다."


def delete_image_group_batch(group_image_data:Dict[str, Any], db: Session) -> str:
    image_ids = group_image_data["image_ids"]
    group_ids = group_image_data["group_ids"]
    deleted_count = db.query(ImageGroup).filter(ImageGroup.image_id.in_(image_ids), ImageGroup.group_id.in_(group_ids)).delete(synchronize_session=False)
    db.commit()    
    return f"{deleted_count}개의 이미지가 '{group_ids}' 그룹에서 삭제되었습니다."


def get_group_preview_batch(db: Session) -> List[GroupPreviewData]:
    """
    모든 그룹의 미리보기 이미지들과 각 이미지들의 키워드들을 가져옵니다.
    """
    # 한 번의 쿼리로 모든 키워드-그룹 관계를 가져옵니다
    # ImageKeyword -> Image -> ImageGroup 조인으로 모든 관계를 한번에 조회
    keyword_group_relations = db.query(
        ImageKeyword.keyword_id,
        ImageKeyword.direction,
        ImageGroup.group_id,
        Keyword.key,
        Keyword.value,
        Keyword.n_created,
        Keyword.n_deleted,
        Keyword.choice_rate
    ).join(Image, ImageKeyword.image_id == Image.id)\
     .join(ImageGroup, ImageGroup.image_id == Image.id)\
     .join(Keyword, ImageKeyword.keyword_id == Keyword.id)\
     .all()
    
    # group_keywords 딕셔너리 초기화
    group_keywords = {}
    
    # 조회된 모든 관계를 처리
    for relation in keyword_group_relations:
        keyword_id = relation.keyword_id
        group_id = relation.group_id
        
        # group_keywords에 해당 group_id가 없으면 딕셔너리로 초기화
        if group_id not in group_keywords:
            group_keywords[group_id] = {}
        
        # 해당 그룹에 키워드가 없으면 추가
        if keyword_id not in group_keywords[group_id]:
            keyword_data = KeywordData(
                id=keyword_id,
                key=relation.key,
                value=relation.value,
                direction=relation.direction,
                n_created=relation.n_created,
                n_deleted=relation.n_deleted,
                choice_rate=relation.choice_rate
            )
            group_keywords[group_id][keyword_id] = keyword_data

    # 모든 그룹 정보를 가져와서 GroupPreviewData 생성
    groups = db.query(Group).all()
    result = []
    
    for group in groups:
        group_id = group.id
        
        # 해당 그룹의 키워드들 (이미 중복 제거됨)
        keywords_for_group = group_keywords.get(group_id, {})
        
        # 해당 그룹의 이미지 개수
        n_images = db.query(ImageGroup).filter(ImageGroup.group_id == group_id).count()
        
        # 썸네일 이미지 URL들 (최대 3개)
        thumbnail_images = db.query(Image).join(ImageGroup).filter(
            ImageGroup.group_id == group_id
        ).limit(3).all()
        
        thumbnail_urls = [img.url for img in thumbnail_images]
        
        # GroupPreviewData 생성
        group_preview = GroupPreviewData(
            id=group.id,
            name=group.name,
            n_images=n_images,
            keywords=keywords_for_group,
            thumbnail_images_urls=thumbnail_urls
        )        
        result.append(group_preview)
    return result


def edit_group_name(group_id: int, group_name: str, db: Session) -> str:
    group = db.query(Group).filter(Group.id == group_id).first()
    group.name = group_name
    db.commit()
    return f"{group_id}번 그룹의 이름이 '{group_name}'으로 변경되었습니다."
