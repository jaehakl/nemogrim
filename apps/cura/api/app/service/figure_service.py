import os

from db import AsyncSessionLocal, Figure
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from datetime import datetime
from analysis.embedding import get_text_embedding
from sqlalchemy import func, text
from sklearn.cluster import KMeans
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from scipy.cluster.hierarchy import linkage, fcluster
import uuid
import random
from analysis.tree_from_embedding import tree_from_embedding
from fastapi import FastAPI, UploadFile, File, HTTPException


FIGURE_DIR = "figures"



async def get_random_prompt():
    # Figure의 컬럼명 (embedding, file_path, id 제외)
    exclude_fields = {'embedding', 'file_path', 'id'}
    from db import Figure, AsyncSessionLocal  # 실제 경로에 맞게 import
    fields = [col.name for col in Figure.__table__.columns if col.name not in exclude_fields]

    select_exprs = [
        #f"(SELECT {field} FROM figure WHERE {field} IS NOT NULL ORDER BY RANDOM() LIMIT 1) AS {field}"
        f"(SELECT {field} FROM figure ORDER BY RANDOM() LIMIT 1) AS {field}"
        for field in fields
    ]
    sql = f"SELECT {', '.join(select_exprs)}"
    async with AsyncSessionLocal() as session:
        result = await session.execute(text(sql))
        row = result.first()
        if row:            
            return dict(row._mapping)
        else:
            return {}


def gen_prompt(data: dict):
    prompt = ""
    for field, value in data.items():
        prompt += f"{field}: {value}\n"
    return prompt


async def add_figure(data: dict, file: UploadFile = File(...)):
    all_fields = [col.name for col in Figure.__table__.columns]
    exclude_fields = ['embedding', 'file_path', 'id']
    figure_fields = [f for f in all_fields if f not in exclude_fields]
    figure_data = {field: data.get(field) for field in figure_fields if data.get(field) is not None}

    # 임베딩 생성 (KeyError 방지)
    prompt = gen_prompt(figure_data)
    embedding = get_text_embedding(prompt)
    figure_data["embedding"] = embedding

    # 파일 저장 (폴더 없으면 생성)
    os.makedirs(FIGURE_DIR, exist_ok=True)
    file_path = os.path.join(FIGURE_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    figure_data["file_path"] = file_path

    new_figure = Figure(**figure_data)
    async with AsyncSessionLocal() as session:
        session.add(new_figure)
        await session.commit()
        await session.refresh(new_figure)
        return {"id": new_figure.id}

async def update_figure(data: dict, file: UploadFile = File(...)):
    figure_id = int(data.get("id"))
    all_fields = [col.name for col in Figure.__table__.columns]
    exclude_fields = ['embedding', 'file_path', 'id']
    figure_fields = [f for f in all_fields if f not in exclude_fields]
    figure_data = {field: data.get(field) for field in figure_fields if data.get(field) is not None}

    # 임베딩 생성 (KeyError 방지)
    prompt = gen_prompt(figure_data)
    embedding = get_text_embedding(prompt)
    figure_data["embedding"] = embedding
    print(embedding[:5], prompt)

    if file:
        # 파일 저장 (폴더 없으면 생성)
        os.makedirs(FIGURE_DIR, exist_ok=True)
        file_path = os.path.join(FIGURE_DIR, file.filename)
        with open(file_path, "wb") as f:
            f.write(file.file.read())
        figure_data["file_path"] = file_path

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Figure).where(Figure.id == figure_id))
        figure = result.scalar_one_or_none()
        if not figure:
            return {"error": "Figure not found"}
        for key, value in figure_data.items():
            setattr(figure, key, value)
        await session.commit()
        return {"id": figure.id}

async def get_figures_from_prompt(prompt: str):
    async with AsyncSessionLocal() as session:
        embedding = get_text_embedding(prompt)

        sql = text("""
        SELECT figure.id, figure.file_path,
            (figure.embedding <=> :embedding) AS cosine_distance
        FROM figure
        WHERE figure.embedding IS NOT NULL
        ORDER BY cosine_distance ASC
        LIMIT 10                       
        """)

        result = await session.execute(sql, {"embedding": str(embedding)})
        rows = result.fetchall()

        return [{"id": row[0], "file_path": row[1]} for row in rows]


async def get_figure(figure_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Figure).where(Figure.id == figure_id))
        figure = result.scalar_one_or_none()
        if not figure:
            return {"error": "Figure not found"}        
        rv = {}
        for field in figure.__table__.columns:
            if field.name not in ['embedding']:
                rv[field.name] = getattr(figure, field.name)

        sql = text("""
        SELECT f2.id, f2.file_path,
            (f2.embedding <=> f1.embedding) AS cosine_distance
        FROM figure f1
        JOIN figure f2 ON f2.id != f1.id
        WHERE f1.id = :figure_id
            AND f2.embedding IS NOT NULL
        ORDER BY cosine_distance ASC
        LIMIT 10                       
        """)

        result = await session.execute(sql, {"figure_id": figure_id})
        rows = result.fetchall()
        related_figures = [
            {
                "id": row[0],
                "file_path": row[1],
                "similarity": float(row[2])
            }
            for row in rows
        ]
        rv["related_figures"] = related_figures

        return rv

async def delete_figure(figure_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Figure).where(Figure.id == figure_id))
        figure = result.scalar_one_or_none()
        if not figure:
            return {"error": "Figure not found"}
        # 파일 삭제 (보안 강화)
        if figure.file_path:
            abs_path = os.path.abspath(figure.file_path)
            abs_dir = os.path.abspath(FIGURE_DIR)
            try:
                if abs_path.startswith(abs_dir) and os.path.exists(abs_path) and not os.path.islink(abs_path):
                    os.remove(abs_path)
            except Exception as e:
                pass  # 필요시 로그 처리
        await session.delete(figure)
        await session.commit()
        return {"id": figure_id}