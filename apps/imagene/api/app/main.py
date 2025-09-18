from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import Depends, Form
from initserver import server
from models import CreateImageData, ImageData, ImageFilterData, GroupPreviewData, ImageKeywordData, ImageGroupData, GroupData, DirectoryData, SubDirectoryData, ImageRequestData
from utils.get_db import get_db
from services.keywords_crud import delete_keywords_batch
from services.create_images import create_image_batch
from services.filter_images import filter_images
from services.images_crud import delete_images_batch
from services.image_detail import get_image_detail
from services.search_from_prompt import search_from_prompt
from services.group_crud import (
    get_group,
    create_group,
    set_image_group_batch,
    delete_group_batch,
    delete_image_group_batch,
    get_group_preview_batch,
    edit_group_name,
)
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

@app.post("/directory/set-image-batch")
async def api_set_image_directory_batch(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, set_image_directory_batch, data["dir_path"], data["image_ids"])

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

@app.post("/directory/edit-path")
async def api_edit_path(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, edit_dir_path, data["prev_path"], data["new_path"])


@app.post("/images/get-detail")
async def api_get_image_detail(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->Dict[str, Any]:
    return exec_service(db, get_image_detail, data["id"])

@app.post("/images/search-from-prompt")
async def api_search_from_prompt(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->Dict[str, Any]:
    return exec_service(db, search_from_prompt, data["prompt"])

@app.post("/group/get")
async def api_get_group(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->GroupData:
    return exec_service(db, get_group, data["id"], data["name"])

@app.post("/group/create-group")
async def api_create_group(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->int:
    return exec_service(db, create_group, data["name"])

@app.post("/group/edit-name")
async def api_edit_group_name(request: Request, data: Dict[str, Any], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, edit_group_name, data["id"], data["name"])


@app.post("/keywords/delete-batch")
async def api_delete_keywords_batch(request: Request, keyword_ids: List[int], db: Session = Depends(get_db)
    )->str:
    return exec_service(db, delete_keywords_batch, keyword_ids)

@app.post("/images/create-batch")
async def api_create_images_batch(request: Request, image_request_data: ImageRequestData, db: Session = Depends(get_db)
    )->List[ImageData]:
    return await exec_service_async(db, create_image_batch, image_request_data)

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


@app.get("/images/get-group-preview-batch")
async def api_get_group_preview_batch(request: Request, db: Session = Depends(get_db)
    )->List[GroupPreviewData]:
    return exec_service(db, get_group_preview_batch)

@app.get("/system/gpu-status")
async def api_get_gpu_status(request: Request) -> Dict[str, Any]:
    """GPU 상태 정보를 반환합니다."""
    try:
        available_devices = get_available_cuda_devices()
        gpu_info = get_gpu_memory_info()
        
        return {
            "cuda_available": len(available_devices) > 0,
            "available_devices": available_devices,
            "device_count": len(available_devices),
            "gpu_info": gpu_info
        }
    except Exception as e:
        return {
            "cuda_available": False,
            "available_devices": [],
            "device_count": 0,
            "gpu_info": [],
            "error": str(e)
        }



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
