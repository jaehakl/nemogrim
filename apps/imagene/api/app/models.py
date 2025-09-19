from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from settings import settings


#input
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


#output
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
    keywords: Optional[List[str]] = None

class SubDirectoryData(BaseModel):
    path: str
    n_images: int
    thumbnail_images_urls: List[str]

class DirectoryData(BaseModel):
    path: str
    sub_dirs: List[SubDirectoryData]
    images: List[ImageData]
