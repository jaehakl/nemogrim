from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import Depends, Form
from initserver import server
#from models import WordData, ExampleData, TextData, ExampleFilterData, WordFilterData, UserData
from utils.get_db import get_db

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


@app.post("/images/create-image")
async def api_create_image(request: Request, create_image_data: List[KeywordData], db: Session = Depends(get_db)
    )->List[ImageData]:
    return exec_service(db, create_image, create_image_data)

@app.post("/images/filter")
async def api_filter_images(request: Request, search_images_data: ImageFilterData, db: Session = Depends(get_db)
    )->List[ImageData]:
    return exec_service(db, filter_images, search_images_data)
    #serach 데이터가 없으면 전체에서 무작위로 추출

@app.get("/images/get-detail/{image_id}")
async def api_get_image_detail(request: Request, image_id: int, db: Session = Depends(get_db)
    )->Dict[str, List[ImageData]]:
    return exec_service(db, get_image_detail, image_id)

@app.post("/images/delete-batch")
async def api_delete_images_batch(request: Request, image_ids: List[int], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, delete_images_batch, image_ids)



@app.get("/images/create-group-auto")
async def api_create_group_auto(request: Request, db: Session = Depends(get_db)
    )->str:
    return exec_service(db, create_group_auto)

@app.post("/images/set-group-batch")
async def api_set_image_group_batch(request: Request, group_id: int, image_ids: List[int], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, set_image_group_batch, group_id, image_ids)

@app.get("/images/get-group-preview-batch")
async def api_get_group_preview_batch(request: Request, db: Session = Depends(get_db)
    )->Dict[str, List[ImageData]]:
    return exec_service(db, get_group_preview_batch)

@app.post("/images/set-group-name")
async def api_set_group_name(request: Request, group_id: int, group_name: str, db: Session = Depends(get_db)
    )->str:
    return exec_service(db, set_group_name, group_id, group_name)

@app.post("/images/delete-group-batch")
async def api_delete_group_batch(request: Request, group_ids: List[int], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, delete_group_batch, group_ids)


@app.post("/images/gen-offsprings")
async def api_images_gen_offsprings(request: Request, gen_image_data: GenImageData, db: Session = Depends(get_db)
    )->List[ImageData]:
    return exec_service(db, images_gen_offsprings, gen_image_data)



def exec_service(db: Session, func, *args, **kwargs):    
    try:
        return func(*args, **kwargs, db=db)
    except Exception as e:
        print("Error: ", e)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

