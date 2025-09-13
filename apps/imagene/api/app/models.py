from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from settings import settings

#input + output
class ImageKeywordData(BaseModel):
    id: Optional[int] = None
    key: str
    value: str
    direction: float
    weight: Optional[float] = 1.0

class ImageGroupData(BaseModel):
    id: Optional[int] = None
    name: str
    position: Optional[float] = 0.0

#input
class CreateImageData(BaseModel):
    keywords: List[ImageKeywordData]
    groups: Optional[List[ImageGroupData]] = None
    model: Optional[str] = settings.sd_model_path
    steps: Optional[int] = 30
    cfg: Optional[float] = 9.0
    height: Optional[int] = 1024
    width: Optional[int] = 1024
    seed: Optional[int] = None


class ImageFilterData(BaseModel):
    group_ids: Optional[List[int]] = None
    keywords: Optional[List[ImageKeywordData]] = None    
    search_value: Optional[str] = None
    model: Optional[str] = None
    score_range: Optional[List[float]] = None
    steps_range: Optional[List[int]] = None
    cfg_range: Optional[List[float]] = None
    resolutions: Optional[List[List[int]]] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    sort_by: Optional[str] = "created_at"
    sort_order: Optional[str] = "desc"


#output
class KeywordData(BaseModel):
    id: int
    key: str
    value: str
    direction: float
    n_created: int
    n_deleted: int
    choice_rate: float

class ImageData(BaseModel):
    id: str
    title: Optional[str] = None
    positive_prompt: str
    negative_prompt: str
    model: str
    steps: int
    cfg: float
    height: int
    width: int
    seed: int    
    url: str
    keywords: List[ImageKeywordData]

class GroupPreviewData(BaseModel):
    id: int
    name: str
    n_images: int
    keywords: Dict[int, KeywordData]    
    thumbnail_images_urls: List[str]