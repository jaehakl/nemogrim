from db import AsyncSessionLocal, Actor, Product, Component
from fastapi import HTTPException
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from analysis.embedding import get_text_embedding
from sqlalchemy import text

from sklearn.cluster import KMeans
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from scipy.cluster.hierarchy import linkage, fcluster
from analysis.tree_from_embedding import tree_from_embedding

async def get_actor_tree():
    async with AsyncSessionLocal() as session:
        # purpose_embedding이 있는 기술들만 가져오기
        result = await session.execute(
            select(Actor)
            .where(Actor.total_embedding.isnot(None))
        )
        actors = result.scalars().all()
        
        if not actors:
            return {"error": "No actors with total embeddings found"}
            
        # 기술 데이터 준비
        actor_data = [
            {
                "id": actor.id,
                "name": actor.name,
                "description": actor.description,
                "embedding": actor.total_embedding
            }
            for actor in actors
        ]

        tree = tree_from_embedding(actor_data)

        # purpose_embedding이 없는 기술들만 가져오기
        result_no_embedding = await session.execute(
            select(Actor)
            .where(Actor.total_embedding.is_(None))
        )
        actors_no_embedding = result_no_embedding.scalars().all()
        actor_data_no_embedding = [
            {
                "name": actor.name,
                "label": actor.name,
                "value": actor.id
            }
            for actor in actors_no_embedding
        ]

        tree.extend(actor_data_no_embedding)

        return tree



async def get_actor_list():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Actor))
        actors = result.scalars().all()
        return [
            {
                "id": a.id,
                "name": a.name,
                "description": a.description
            }
            for a in actors
        ]

async def add_actor(data: dict):
    name = data.get("name")
    description = data.get("description")
    async with AsyncSessionLocal() as session:
        new_actor = Actor(name=name, description=description)
        session.add(new_actor)
        await session.commit()
        await session.refresh(new_actor)
        return {
            "id": new_actor.id,
            "name": new_actor.name,
            "description": new_actor.description,
        }

async def get_actor(actor_id: int):
    async with AsyncSessionLocal() as session:
        # selectinload를 사용하여 관계를 명시적으로 로드
        stmt = select(Actor).options(
            selectinload(Actor.techs),            
            selectinload(Actor.products).options(selectinload(Product.actor), 
                                                        selectinload(Product.tech), 
                                                        selectinload(Product.jtbd),
                                                        selectinload(Product.component).options(selectinload(Component.tech)))
        ).where(Actor.id == actor_id)
        
        result = await session.execute(stmt)
        actor = result.scalar_one_or_none()
        
        if not actor:
            raise HTTPException(status_code=404, detail="Actor not found")
        
        # 관련된 tech 정보 가져오기
        techs = [
            {
                "id": tech.id,
                "name": tech.name,
                "purpose_keyword": tech.purpose_keyword,
                "principle_keyword": tech.principle_keyword,
                "released_date": tech.released_date,
                "evidence_class": tech.evidence_class,
                "purpose": tech.purpose,
                "spec": tech.spec,
                "principle": tech.principle,
                "actor_name": tech.actor.name
            }
            for tech in actor.techs
        ]
        
        # 관련된 product 정보 가져오기
        products = [
            {
                "id": product.id,
                "name": product.name,
                "utility": product.utility,
                "cost": product.cost,
                "tech_name": product.tech.name if product.tech else None,
                "actor_name": product.actor.name if product.actor else None,
                "jtbd_name": product.jtbd.name if product.jtbd else None,
                "component_name": product.component.name if product.component else None,
                "component_tech_name": product.component.tech.name if product.component and product.component.tech else None
            }
            for product in actor.products
        ]

        comments = []
        if actor.total_embedding is not None:
            sql = text("""
            SELECT d2.id, d2.comment, d2.updated_at,
                (d2.target_embedding <=> d1.total_embedding) AS cosine_distance
            FROM actor d1, discussion d2
            WHERE d1.id = :actor_id
                AND d1.total_embedding IS NOT NULL
                AND d2.target_embedding IS NOT NULL
            ORDER BY cosine_distance ASC
            LIMIT 5
            """)

            result = await session.execute(sql, {"actor_id": actor_id})
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


        return {
            "id": actor.id,
            "name": actor.name,
            "description": actor.description,
            "total_embedding": actor.total_embedding.tolist() if hasattr(actor.total_embedding, "tolist") else actor.total_embedding,
            "techs": techs,
            "products": products,
            "comments": comments
        }

async def update_actor(data: dict):
    actor_id = data.get("id")
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Actor).where(Actor.id == actor_id)
            .options(selectinload(Actor.products).options(selectinload(Product.actor), 
                                                selectinload(Product.tech), 
                                                selectinload(Product.jtbd),
                                                selectinload(Product.component).options(selectinload(Component.tech)))))
        actor = result.scalar_one_or_none()

        total_text = ""
        total_text += f"{actor.name} " if actor.name else ""
        total_text += f"{actor.description} " if actor.description else ""
        total_text += "\n" + "이 기업이 개발한 제품은 다음과 같습니다." + "\n"
        for product in actor.products:
            total_text += f"{product.name} " if product.name else ""
            total_text += f"{product.jtbd.name} " if product.jtbd else ""
            total_text += f"{product.component.name} " if product.component else ""
            total_text += f"{product.tech.name} " if product.tech else ""
            total_text += "\n"
        total_embedding = get_text_embedding(total_text)        

        actor = await session.get(Actor, actor_id)
        if not actor:
            raise HTTPException(status_code=404, detail="Actor not found")
        if "name" in data:
            actor.name = data["name"]
        if "description" in data:
            actor.description = data["description"]
        actor.total_embedding = total_embedding
        await session.commit()
        return {"status": "success"}

async def delete_actor(actor_id: int):
    async with AsyncSessionLocal() as session:
        actor = await session.get(Actor, actor_id)
        if not actor:
            raise HTTPException(status_code=404, detail="Actor not found")
        await session.delete(actor)
        await session.commit()
        return {"status": "success"} 
    
