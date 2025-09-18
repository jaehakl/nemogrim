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
    group_ids: Optional[List[int]] = None
    model: str
    steps: Optional[int] = 30
    cfg: Optional[float] = 9.0
    height: Optional[int] = 1024
    width: Optional[int] = 1024
    seed: Optional[int] = None
    max_chunk_size: Optional[int] = 4


class ImageRequestData(BaseModel):
    path: Optional[str] = "/"
    ckpt_path: str
    positive_prompt_list: List[str]
    negative_prompt_list: List[str]
    seed_list: List[int]
    images: Optional[List[str]] = None
    strength: Optional[float] = 0.85
    steps: Optional[int] = 30
    cfg: Optional[float] = 9.0
    width: Optional[int] = 1024
    height: Optional[int] = 1024
    max_chunk_size: Optional[int] = 4


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
    name: str
    n_images: int
    keywords: Dict[int, KeywordData]    
    thumbnail_images_urls: List[str]

class SubGroupData(BaseModel):
    id: int
    name: str
    n_images: int
    thumbnail_images_urls: List[str]

class GroupData(BaseModel):
    id: int
    name: str
    sub_groups: List[SubGroupData]
    images: List[ImageData]
    n_images: int


class SubDirectoryData(BaseModel):
    path: str
    n_images: int
    thumbnail_images_urls: List[str]

class DirectoryData(BaseModel):
    path: str
    sub_dirs: List[SubDirectoryData]
    images: List[ImageData]
