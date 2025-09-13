from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import Depends, Form
from initserver import server
from models import CreateImageData, ImageData, ImageFilterData, GroupPreviewData, ImageKeywordData, ImageGroupData
from utils.get_db import get_db
from services.keywords_crud import delete_keywords_batch
from services.create_images import create_image_batch
from services.filter_images import filter_images
from services.images_crud import delete_images_batch
from services.group_crud import (
    set_image_group_batch,
    delete_group_batch,
    delete_image_group_batch,
    get_group_preview_batch,
    edit_group_name,
)

app = server()

@app.post("/keywords/delete-batch")
async def api_delete_keywords_batch(request: Request, keyword_ids: List[int], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, delete_keywords_batch, keyword_ids)

@app.post("/images/create-batch")
async def api_create_images_batch(request: Request, create_image_data: List[CreateImageData], db: Session = Depends(get_db)
    )->List[ImageData]:
    return await exec_service_async(db, create_image_batch, create_image_data)

@app.post("/images/filter")
async def api_filter_images(request: Request, search_images_data: ImageFilterData, db: Session = Depends(get_db)
    )->List[ImageData]:
    result = exec_service(db, filter_images, search_images_data)
    return result

@app.post("/images/delete-batch")
async def api_delete_images_batch(request: Request, image_ids: List[str], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, delete_images_batch, image_ids)

@app.post("/images/set-group-batch")
async def api_set_image_group_batch(request: Request, group_image_data: Dict[str, Any], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, set_image_group_batch, group_image_data)

@app.post("/images/unset-group-batch")
async def api_delete_image_group_batch(request: Request, group_image_data: Dict[str, Any], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, delete_image_group_batch, group_image_data)

@app.post("/images/delete-group-batch")
async def api_delete_group_batch(request: Request, group_ids: List[int], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, delete_group_batch, group_ids)

@app.post("/group/edit-name")
async def api_edit_group_name(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, edit_group_name, data["id"], data["name"])

@app.get("/images/get-group-preview-batch")
async def api_get_group_preview_batch(request: Request, db: Session = Depends(get_db)
    )->List[GroupPreviewData]:
    return exec_service(db, get_group_preview_batch)



# to do later
#@app.get("/images/get-detail/{image_id}")
#async def api_get_image_detail(request: Request, image_id: int, db: Session = Depends(get_db)
#    )->Dict[str, List[ImageData]]:
#    return exec_service(db, get_image_detail, image_id)


def exec_service(db: Session, func, *args, **kwargs):    
    try:
        return func(*args, **kwargs, db=db)
    except Exception as e:
        import traceback
        error_detail = f"Function: {func.__name__}\nError: {str(e)}\nTraceback: {traceback.format_exc()}"
        print("Error: ", error_detail)
        db.rollback()
        raise HTTPException(status_code=500, detail=error_detail)
    finally:
        db.close()

async def exec_service_async(db: Session, func, *args, **kwargs):    
    try:
        return await func(*args, **kwargs, db=db)
    except Exception as e:
        import traceback
        error_detail = f"Function: {func.__name__}\nError: {str(e)}\nTraceback: {traceback.format_exc()}"
        print("Error: ", error_detail)
        db.rollback()
        raise HTTPException(status_code=500, detail=error_detail)
    finally:
        db.close()
