from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, asc
from models import ImageData
from db import Image, ImageGroup


def set_image_group_batch(group_name: str, image_ids: List[int], db: Session) -> str:
    """
    여러 이미지를 특정 그룹에 설정합니다.
    """
    if not image_ids:
        return "이미지 ID가 제공되지 않았습니다."
    
    # 이미지 존재 여부 확인 (id만 가져오기)
    existing_ids = db.query(Image.id).filter(Image.id.in_(image_ids)).all()
    existing_ids = [img.id for img in existing_ids]
    
    if not existing_ids:
        return "존재하지 않는 이미지입니다."
    
    # 기존 그룹 관계 삭제 (같은 이미지의 다른 그룹들)
    db.query(ImageGroup).filter(ImageGroup.image_id.in_(existing_ids)).delete()
    
    # 새로운 그룹 관계 생성
    group_relations = []
    for image_id in existing_ids:
        group_relation = ImageGroup(
            name=group_name,
            image_id=image_id
        )
        group_relations.append(group_relation)
    
    db.add_all(group_relations)
    db.commit()
    
    return f"{len(existing_ids)}개의 이미지가 '{group_name}' 그룹에 설정되었습니다."


def get_group_preview_batch(db: Session) -> Dict[str, List[ImageData]]:
    """
    모든 그룹의 미리보기 이미지들을 가져옵니다.
    각 그룹당 최대 5개의 이미지를 반환합니다.
    """
    # 그룹별로 이미지들을 가져오기
    group_images_query = db.query(
        ImageGroup.name.label('group_name'),
        Image.id,
        Image.url,
        Image.dna
    ).join(Image).order_by(
        ImageGroup.name,
        Image.created_at.desc()
    )
    
    group_images_dict = {}
    
    for row in group_images_query.all():
        group_name = row[0]  # row[0] = group_name
        
        if group_name not in group_images_dict:
            group_images_dict[group_name] = []
        
        # 각 그룹당 최대 5개까지만
        if len(group_images_dict[group_name]) < 5:
            group_images_dict[group_name].append(ImageData(
                id=row[1],  # row[1] = id
                url=row[2],  # row[2] = url
                dna=row[3]   # row[3] = dna
            ))
    
    return group_images_dict


def delete_group_batch(group_names: List[str], db: Session) -> str:
    """
    여러 그룹을 일괄 삭제합니다.
    """
    if not group_names:
        return "삭제할 그룹이 지정되지 않았습니다."
    
    # 그룹 존재 여부 확인
    existing_groups = db.query(ImageGroup.name).filter(
        ImageGroup.name.in_(group_names)
    ).distinct().all()
    
    existing_group_names = [group.name for group in existing_groups]
    
    if not existing_group_names:
        return "삭제할 그룹이 없습니다."
    
    # 그룹 삭제
    deleted_count = db.query(ImageGroup).filter(
        ImageGroup.name.in_(existing_group_names)
    ).delete(synchronize_session=False)
    
    db.commit()
    
    return f"{len(existing_group_names)}개의 그룹이 삭제되었습니다. (총 {deleted_count}개의 그룹 관계 삭제)"
