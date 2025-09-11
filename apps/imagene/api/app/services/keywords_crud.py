from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from models import KeywordData, KeywordFilterData
from db import Keyword


def create_keywords_batch(keywords_data: List[KeywordData], db: Session) -> List[KeywordData]:
    """키워드들을 일괄 생성"""
    created_keywords = []
    
    for keyword_data in keywords_data:
        keyword = Keyword(
            key=keyword_data.key,
            value=keyword_data.value,
            direction=keyword_data.direction
        )
        db.add(keyword)
        db.flush()  # ID를 얻기 위해 flush
        
        created_keyword = KeywordData(
            id=keyword.id,
            key=keyword.key,
            value=keyword.value,
            direction=keyword.direction,
            n_created=0,
            n_deleted=0,
            del_rate=0
        )
        created_keywords.append(created_keyword)
    
    db.commit()
    return created_keywords


def sort_keywords_by_key(db: Session) -> Dict[str, List[KeywordData]]:
    """키워드들을 키별로 정렬하여 반환"""
    keywords = db.query(Keyword).all()
    
    result = {}
    for keyword in keywords:
        key = keyword.key
        if key not in result:
            result[key] = []
        
        keyword_data = KeywordData(
            id=keyword.id,
            key=keyword.key,
            value=keyword.value,
            direction=keyword.direction,
            n_created=keyword.n_created,
            n_deleted=keyword.n_deleted,
            del_rate=keyword.n_deleted / keyword.n_created if keyword.n_created > 0 else 0
        )
        result[key].append(keyword_data)
    
    return result


def filter_keywords(keyword_filter_data: KeywordFilterData, db: Session) -> List[KeywordData]:
    """키워드 필터링"""
    query = db.query(Keyword)
    
    # 필터 조건 적용
    if keyword_filter_data.key:
        query = query.filter(Keyword.key == keyword_filter_data.key)
    
    if keyword_filter_data.value:
        query = query.filter(Keyword.value == keyword_filter_data.value)

    if keyword_filter_data.search_value:
        search_value = f"%{keyword_filter_data.search_value}%"
        query = query.filter(
            or_(
                Keyword.key.ilike(search_value),
                Keyword.value.ilike(search_value)
            )
        )
    
    if keyword_filter_data.direction_min is not None:
        query = query.filter(Keyword.direction >= keyword_filter_data.direction_min)
    
    if keyword_filter_data.direction_max is not None:
        query = query.filter(Keyword.direction <= keyword_filter_data.direction_max)
    
    if keyword_filter_data.n_created_min is not None:
        query = query.filter(Keyword.n_created >= keyword_filter_data.n_created_min)
    
    if keyword_filter_data.n_created_max is not None:
        query = query.filter(Keyword.n_created <= keyword_filter_data.n_created_max)
    
    if keyword_filter_data.n_deleted_min is not None:
        query = query.filter(Keyword.n_deleted >= keyword_filter_data.n_deleted_min)
    
    if keyword_filter_data.n_deleted_max is not None:
        query = query.filter(Keyword.n_deleted <= keyword_filter_data.n_deleted_max)
    
    # del_rate 필터링 (계산된 값)
    if keyword_filter_data.del_rate_min is not None or keyword_filter_data.del_rate_max is not None:
        # n_created가 0인 경우를 제외하고 del_rate 계산
        query = query.filter(Keyword.n_created > 0)
        
        if keyword_filter_data.del_rate_min is not None:
            query = query.filter(
                func.cast(Keyword.n_deleted, Float) / func.cast(Keyword.n_created, Float) >= keyword_filter_data.del_rate_min
            )
        
        if keyword_filter_data.del_rate_max is not None:
            query = query.filter(
                func.cast(Keyword.n_deleted, Float) / func.cast(Keyword.n_created, Float) <= keyword_filter_data.del_rate_max
            )
    
    # 정렬 (기본적으로 id 순)
    query = query.order_by(Keyword.id)
    
    # 페이징
    if keyword_filter_data.offset:
        query = query.offset(keyword_filter_data.offset)
    
    if keyword_filter_data.limit:
        query = query.limit(keyword_filter_data.limit)
    
    keywords = query.all()
    
    result = []
    for keyword in keywords:
        keyword_data = KeywordData(
            id=keyword.id,
            key=keyword.key,
            value=keyword.value,
            direction=keyword.direction,
            n_created=keyword.n_created,
            n_deleted=keyword.n_deleted,
            del_rate=keyword.n_deleted / keyword.n_created if keyword.n_created > 0 else 0
        )
        result.append(keyword_data)
    
    return result


def update_keyword(keyword_data: KeywordData, db: Session) -> KeywordData:
    """키워드 업데이트"""
    if not keyword_data.id:
        raise ValueError("키워드 ID가 필요합니다")
    
    keyword = db.query(Keyword).filter(Keyword.id == keyword_data.id).first()
    if not keyword:
        raise ValueError(f"ID {keyword_data.id}에 해당하는 키워드를 찾을 수 없습니다")
    
    # 업데이트
    keyword.key = keyword_data.key
    keyword.value = keyword_data.value
    keyword.direction = keyword_data.direction
    if keyword_data.n_created is not None:
        keyword.n_created = keyword_data.n_created
    if keyword_data.n_deleted is not None:
        keyword.n_deleted = keyword_data.n_deleted
    
    db.commit()
    
    return KeywordData(
        id=keyword.id,
        key=keyword.key,
        value=keyword.value,
        direction=keyword.direction,
        n_created=keyword.n_created,
        n_deleted=keyword.n_deleted,
        del_rate=keyword.n_deleted / keyword.n_created if keyword.n_created > 0 else 0
    )


def delete_keywords_batch(keyword_ids: List[int], db: Session) -> str:
    """키워드들을 일괄 삭제"""
    deleted_count = db.query(Keyword).filter(Keyword.id.in_(keyword_ids)).delete(synchronize_session=False)
    db.commit()
    
    return f"{deleted_count}개의 키워드가 삭제되었습니다"
