from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from models import KeywordData
from db import Keyword



def delete_keywords_batch(keyword_ids: List[int], db: Session) -> str:
    """키워드들을 일괄 삭제"""
    deleted_count = db.query(Keyword).filter(Keyword.id.in_(keyword_ids)).delete(synchronize_session=False)
    db.commit()    
    return f"{deleted_count}개의 키워드가 삭제되었습니다"
