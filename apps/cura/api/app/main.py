from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse
from initserver import server
from typing import Optional

# Add this import for the actor service
from service import figure_service

app = server()

@app.post("/add-figure/")
async def add_figure(request: Request, file: Optional[UploadFile] = File(None)):
    form = await request.form()
    data = {k: v for k, v in form.items() if k != "file"}
    if file is not None:
        result = await figure_service.add_figure(data, file)
    else:
        return {"message": "No file uploaded"}
    return JSONResponse(content=result)

@app.post("/update-figure/")
async def update_figure(request: Request, file: Optional[UploadFile] = File(None)):
    form = await request.form()
    data = {k: v for k, v in form.items() if k != "file"}
    result = await figure_service.update_figure(data, file)
    return JSONResponse(content=result)

@app.get("/random-prompt/")
async def get_random_prompt():
    return await figure_service.get_random_prompt()

@app.post("/figures-from-prompt/")
async def get_figures_from_prompt(data: dict):
    prompt = data.get("prompt")
    return await figure_service.get_figures_from_prompt(prompt)

@app.get("/get-figure/{figure_id}")
async def get_figure(figure_id: int):
    return await figure_service.get_figure(figure_id)

@app.get("/delete-figure/{figure_id}")
async def delete_figure(figure_id: int):
    return await figure_service.delete_figure(figure_id)