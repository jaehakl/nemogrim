from typing import Optional, List, Dict, Any
from pydantic import BaseModel

#input + output
class KeywordData(BaseModel):
    id: Optional[int] = None
    key: str
    value: str
    direction: float
    n_created: Optional[int] = None
    n_deleted: Optional[int] = None
    del_rate: Optional[float] = None

#input
class KeywordFilterData(BaseModel):
    key: Optional[str] = None
    value: Optional[str] = None
    seaarch_value: Optional[str] = None
    direction_min: Optional[float] = None
    direction_max: Optional[float] = None
    del_rate_min: Optional[float] = None
    del_rate_max: Optional[float] = None
    n_created_min: Optional[int] = None
    n_created_max: Optional[int] = None
    n_deleted_min: Optional[int] = None
    n_deleted_max: Optional[int] = None
    limit: Optional[int] = None
    offset: Optional[int] = None


class ImageFilterData(BaseModel):
    group_ids: Optional[List[int]] = None
    search_value: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = None


class GenImageData(BaseModel):
    group_id: int
    n_gen: int = 1
    dna: Optional[str] = None
    model_params: Optional[str] = None

#output
class ImageData(BaseModel):
    id: int
    url: str
    dna: Optional[str] = None
    model_params: Optional[str] = None