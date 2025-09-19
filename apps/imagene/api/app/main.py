from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import Depends, Form
from initserver import server
from models import ImageData, DirectoryData, ImageRequestData
from utils.get_db import get_db

from services.create_images import create_image_batch
from services.image_detail import get_image_detail
from services.search_from_prompt import search_from_prompt
from services.directories import (
    get_directory,
    set_image_directory_batch,
    delete_path_batch,
    move_path_batch,
    edit_dir_path,
    delete_directory,
)

from utils.stable_diffusion import get_gpu_memory_info, get_available_cuda_devices


app = server()

@app.post("/directory/get")
async def api_get_directory(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->DirectoryData:
    return exec_service(db, get_directory, data["dir_path"])

@app.post("/directory/delete-directory")
async def api_delete_directory(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, delete_directory, data["dir_path"])

@app.post("/directory/delete-path-batch")
async def api_delete_path_batch(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, delete_path_batch, data["path_list"])


@app.post("/directory/move-path-batch")
async def api_move_path_batch(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, move_path_batch, data["path_change_dict"])

@app.post("/directory/set-image-batch")
async def api_set_image_directory_batch(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, set_image_directory_batch, data["dir_path"], data["image_ids"])

@app.post("/directory/edit-path")
async def api_edit_path(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, edit_dir_path, data["prev_path"], data["new_path"])


@app.post("/images/create-batch")
async def api_create_images_batch(request: Request, image_request_data: ImageRequestData, db: Session = Depends(get_db)
    )->List[ImageData]:
    return await exec_service_async(db, create_image_batch, image_request_data)

@app.post("/images/get-detail")
async def api_get_image_detail(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->Dict[str, Any]:
    return exec_service(db, get_image_detail, data["id"])

@app.post("/images/search-from-prompt")
async def api_search_from_prompt(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->Dict[str, Any]:
    return exec_service(db, search_from_prompt, data["prompt"])




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
