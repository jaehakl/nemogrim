from db import AsyncSessionLocal, Tech, Actor, Component, Product
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

def tolist_safe(val):
    return val.tolist() if hasattr(val, "tolist") else val

async def get_tech_tree():
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Tech)
            .where(Tech.total_embedding.isnot(None))
        )
        techs = result.scalars().all()
        
        if not techs:
            return {"error": "No techs with purpose embeddings found"}
            
        # 기술 데이터 준비
        tech_data = [
            {
                "id": tech.id,
                "name": tech.name,
                "embedding": tech.total_embedding
            }
            for tech in techs
        ]

        tree = tree_from_embedding(tech_data)

        # purpose_embedding이 없는 기술들만 가져오기
        result_no_embedding = await session.execute(
            select(Tech)
            .where(Tech.total_embedding.is_(None))
        )
        techs_no_embedding = result_no_embedding.scalars().all()
        tech_data_no_embedding = [
            {
                "name": tech.name,
                "label": tech.name,
                "value": tech.id
            }
            for tech in techs_no_embedding
        ]

        tree.extend(tech_data_no_embedding)

        return tree

async def get_tech_list():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Tech))
        techs = result.scalars().all()
        return [{"id": t.id, "name": t.name} for t in techs]

async def add_tech(data: dict):
    name = data.get("name")
    async with AsyncSessionLocal() as session:
        if "name" not in data:
            return {"error": "Name is required"}
        name = data["name"]
        actor_id = data["actor_id"] if "actor_id" in data else None
        new_tech = Tech(
            name=name,
            actor_id=actor_id
        )
        session.add(new_tech)
        await session.commit()
        await session.refresh(new_tech)
        return {"id": new_tech.id, "name": new_tech.name}

async def get_tech(tech_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Tech)
            .where(Tech.id == tech_id)
            .options(selectinload(Tech.components),
                     selectinload(Tech.products).options(selectinload(Product.actor),
                                                                    selectinload(Product.tech), 
                                                                    selectinload(Product.component).options(selectinload(Component.tech)),
                                                                    selectinload(Product.jtbd))
            )
        )
        tech = result.scalar_one_or_none()
        if not tech:
            return {"error": "Tech not found"}
        actor = None
        if tech.actor_id:
            actor_result = await session.execute(select(Actor).where(Actor.id == tech.actor_id))
            actor_obj = actor_result.scalar_one_or_none()
            if actor_obj:
                actor = {
                    "id": actor_obj.id,
                    "name": actor_obj.name,
                    "description": actor_obj.description
                }
        components = [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "spec_requirements": c.spec_requirements,
                "unit_demand": c.unit_demand,
                "tech_name": tech.name
            }
            for c in tech.components
        ]
        products = [
            {
                "id": p.id,
                "name": p.name,
                "actor_name": p.actor.name if p.actor else None,
                "tech_name": p.tech.name if p.tech else None,
                "jtbd_name": p.jtbd.name if p.jtbd else None,
                "component_name": p.component.name if p.component else None,
                "component_tech_name": p.component.tech.name if p.component and p.component.tech else None,
            }
            for p in tech.products
        ]

        related_techs = []
        if tech.principle_embedding is not None:
            sql = text("""
            SELECT t2.id, t2.name, t2.purpose, t2.principle, t2.spec,
                (t2.principle_embedding <=> t1.principle_embedding) AS cosine_distance
            FROM tech t1
            JOIN tech t2 ON t2.id != t1.id
            WHERE t1.id = :tech_id
                AND t1.principle_embedding IS NOT NULL
                AND t2.principle_embedding IS NOT NULL
            ORDER BY cosine_distance ASC
            LIMIT 10                       
            """)

            result = await session.execute(sql, {"tech_id": tech_id})
            rows = result.fetchall()
            related_techs = [
                {
                    "id": row[0],
                    "name": row[1],
                    "purpose": row[2],
                    "principle": row[3],    
                    "spec": row[4], 
                    "similarity": float(row[5])
                }
                for row in rows
            ]

        related_jtbds = []
        if tech.purpose_embedding is not None:
            sql = text("""
            SELECT jtbd.id, jtbd.name, jtbd.description,
                (description_embedding <=> tech.purpose_embedding) AS cosine_distance
            FROM jtbd
            JOIN tech ON tech.id = :tech_id
            WHERE description_embedding IS NOT NULL
            ORDER BY cosine_distance ASC
            LIMIT 10
            """)

            result = await session.execute(sql, {"tech_id": tech_id})
            rows = result.fetchall()
            related_jtbds = [
                {
                    "id": row[0],
                    "name": row[1],
                    "description": row[2],
                    "similarity": float(row[3])
                }
                for row in rows
            ]       

        related_components = []
        if tech.purpose_embedding is not None:
            sql = text("""
            SELECT component.id, component.name, component.description, component.spec_requirements,
                (description_embedding <=> tech.purpose_embedding) AS cosine_distance,
                t.id, t.name             
            FROM component
            JOIN tech ON tech.id = :tech_id
            LEFT JOIN tech t ON component.tech_id = t.id
            WHERE description_embedding IS NOT NULL
                AND (component.tech_id IS NULL OR component.tech_id != :tech_id)
            ORDER BY cosine_distance ASC
            LIMIT 10
            """)

            result = await session.execute(sql, {"tech_id": tech_id})
            rows = result.fetchall()
            related_components = [
                {
                    "id": row[0],
                    "name": row[1],
                    "description": row[2],
                    "spec_requirements": row[3],
                    "similarity": float(row[4]),
                    "tech_id": row[5],
                    "tech_name": row[6]
                }
                for row in rows
            ]            

        comments = []
        if tech.total_embedding is not None:
            sql = text("""
            SELECT d2.id, d2.comment, d2.updated_at,
                (d2.target_embedding <=> d1.total_embedding) AS cosine_distance
            FROM tech d1, discussion d2
            WHERE d1.id = :tech_id
                AND d1.total_embedding IS NOT NULL
                AND d2.target_embedding IS NOT NULL
            ORDER BY cosine_distance ASC
            LIMIT 5
            """)

            result = await session.execute(sql, {"tech_id": tech_id})
            rows = result.fetchall()
            comments = [
                {
                    "id": row[0],
                    "comment": row[1],
                    "updated_at": row[2].strftime("%Y-%m-%d") if row[2] else None,
                    "similarity": float(row[3])
                }
                for row in rows
            ]


        rv = {
            "id": tech.id,
            "name": tech.name,
            "released_date": tech.released_date.isoformat() if tech.released_date else None,
            "actor": actor,
            "actor_id": tech.actor_id,
            "evidence_class": tech.evidence_class,
            "purpose": tech.purpose,
            "purpose_keyword": tech.purpose_keyword,
            "principle": tech.principle,
            "principle_keyword": tech.principle_keyword,
            "spec": tech.spec,
            "components": components,
            "products": products,
            "total_embedding": tolist_safe(tech.total_embedding),
            "related_techs": related_techs,
            "related_jtbds": related_jtbds,
            "related_components": related_components,
            "comments": comments
        }
        return rv

async def update_tech(data: dict):
    tech_id = data.get("id")
    name = data.get("name")
    actor_id = data.get("actor_id")
    purpose_keyword = data.get("purpose_keyword")
    principle_keyword = data.get("principle_keyword")
    released_date = data.get("released_date")
    evidence_class = data.get("evidence_class")
    purpose = data.get("purpose")
    spec = data.get("spec")
    principle = data.get("principle")
    async with AsyncSessionLocal() as session:
        result_obj = await session.execute(select(Tech).where(Tech.id == tech_id))
        tech = result_obj.scalar_one_or_none()
        if not tech:
            return {"error": "Tech not found"}
        if name is not None:
            tech.name = name
        if actor_id is not None:
            tech.actor_id = actor_id
        if purpose_keyword is not None:
            tech.purpose_keyword = purpose_keyword
        if principle_keyword is not None:
            tech.principle_keyword = principle_keyword
        if released_date is not None:
            try:
                tech.released_date = datetime.fromisoformat(released_date)
            except Exception:
                pass
        if evidence_class is not None:
            tech.evidence_class = evidence_class
        if purpose is not None:
            tech.purpose = purpose
            tech.purpose_embedding = get_text_embedding(purpose)
        if spec is not None:
            tech.spec = spec
            tech.spec_embedding = get_text_embedding(spec)
        if principle is not None:
            tech.principle = principle
            tech.principle_embedding = get_text_embedding(principle)

        #get components from db
        components = await session.execute(select(Component).where(Component.tech_id == tech_id))
        components = components.scalars().all()

        total_text = ""
        total_text += tech.name if tech.name is not None else ""
        total_text += "\n"
        total_text += tech.purpose if tech.purpose is not None else ""
        total_text += "\n"
        total_text += tech.principle if tech.principle is not None else ""
        total_text += "\n"
        total_text += tech.spec if tech.spec is not None else ""
        total_text += "\n"
        for component in components:
            total_text += component.name if component.name is not None else ""
            total_text += "\n"
            total_text += component.description if component.description is not None else ""
            total_text += "\n"
            total_text += component.spec_requirements if component.spec_requirements is not None else ""
            total_text += "\n"

        tech.total_embedding = get_text_embedding(total_text)

        await session.commit()
        return {"status": "success"}

async def delete_tech(tech_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Tech).where(Tech.id == tech_id))
        tech = result.scalar_one_or_none()
        if not tech:
            return {"error": "Tech not found"}
        await session.delete(tech)
        await session.commit()
        return {"status": "success"}

async def get_tech_list_by_actor(actor_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Tech).where(Tech.actor_id == actor_id))
        techs = result.scalars().all()
        return [
            {"id": t.id, "name": t.name}
            for t in techs
        ]