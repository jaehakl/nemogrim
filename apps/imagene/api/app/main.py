from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import Depends, Form
from initserver import server
from models import KeywordData, KeywordFilterData, ImageData, ImageFilterData, GenImageData
from utils.get_db import get_db
from services.keywords_crud import (
    create_keywords_batch,
    sort_keywords_by_key,
    filter_keywords,
    update_keyword,
    delete_keywords_batch
)
from services.images_crud import (
    create_image_batch,
    filter_images,
    get_image_detail,
    delete_images_batch
)
from services.group_crud import (
    set_image_group_batch,
    get_group_preview_batch,
    delete_group_batch
)

app = server()


@app.post("/keywords/create-batch")
async def api_create_keywords_batch(request: Request, keywords_data: List[KeywordData], db: Session = Depends(get_db)
    )->List[KeywordData]:
    return exec_service(db, create_keywords_batch, keywords_data)

@app.get("/keywords/sort-by-key")
async def api_sort_keywords_by_key(request: Request, db: Session = Depends(get_db)
    )->Dict[str, List[KeywordData]]:
    return exec_service(db, sort_keywords_by_key)

@app.post("/keywords/filter")
async def api_filter_keywords(request: Request, keyword_filter_data: KeywordFilterData, db: Session = Depends(get_db)
    )->List[KeywordData]:
    return exec_service(db, filter_keywords, keyword_filter_data)

@app.post("/keywords/update")
async def api_update_keyword(request: Request, keyword_data: KeywordData, db: Session = Depends(get_db)
    )->KeywordData:
    return exec_service(db, update_keyword, keyword_data)

@app.post("/keywords/delete-batch")
async def api_delete_keywords_batch(request: Request, keyword_ids: List[int], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, delete_keywords_batch, keyword_ids)


@app.post("/images/create-batch")
async def api_create_images_batch(request: Request, create_image_data: List[List[KeywordData]], db: Session = Depends(get_db)
    )->List[ImageData]:
    return await exec_service_async(db, create_image_batch, create_image_data)

@app.post("/images/filter")
async def api_filter_images(request: Request, search_images_data: ImageFilterData, db: Session = Depends(get_db)
    )->Dict[str, List[ImageData]]:
    result = exec_service(db, filter_images, search_images_data)
    return result

@app.get("/images/get-detail/{image_id}")
async def api_get_image_detail(request: Request, image_id: int, db: Session = Depends(get_db)
    )->Dict[str, List[ImageData]]:
    return exec_service(db, get_image_detail, image_id)

@app.post("/images/delete-batch")
async def api_delete_images_batch(request: Request, image_ids: List[int], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, delete_images_batch, image_ids)

@app.post("/images/set-group-batch")
async def api_set_image_group_batch(request: Request, group_image_data: Dict[str, Any], db: Session = Depends(get_db)
    )->str:
    print(group_image_data)
    return exec_service(db, set_image_group_batch, group_image_data["group_name"], group_image_data["image_ids"])

@app.get("/images/get-group-preview-batch")
async def api_get_group_preview_batch(request: Request, db: Session = Depends(get_db)
    )->Dict[str, List[ImageData]]:
    return exec_service(db, get_group_preview_batch)

@app.post("/images/delete-group-batch")
async def api_delete_group_batch(request: Request, group_names: List[str], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, delete_group_batch, group_names)


#@app.get("/images/create-group-auto")
#async def api_create_group_auto(request: Request, db: Session = Depends(get_db)
#    )->str:
#    return exec_service(db, create_group_auto)
#
#@app.post("/images/gen-offsprings")
#async def api_images_gen_offsprings(request: Request, gen_image_data: GenImageData, db: Session = Depends(get_db)
#    )->List[ImageData]:
#    return exec_service(db, images_gen_offsprings, gen_image_data)


def exec_service(db: Session, func, *args, **kwargs):    
    try:
        return func(*args, **kwargs, db=db)
    except Exception as e:
        print("Error: ", e)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

async def exec_service_async(db: Session, func, *args, **kwargs):    
    try:
        return await func(*args, **kwargs, db=db)
    except Exception as e:
        print("Error: ", e)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
