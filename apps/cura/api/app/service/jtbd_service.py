from db import AsyncSessionLocal, JTBD, Tech, Product, Component, Discussion
from sqlalchemy.future import select
import numpy as np
from sqlalchemy.orm import selectinload
from analysis.embedding import get_text_embedding
from sqlalchemy import func, text

async def add_jtbd(data: dict):
    parent_id = data.get("parent_id")
    name = data.get("name")
    async with AsyncSessionLocal() as session:
        new_jtbd = JTBD(name=name, parent_id=parent_id)
        session.add(new_jtbd)
        await session.commit()
        await session.refresh(new_jtbd)
        return {"id": new_jtbd.id}

async def update_jtbd(data: dict):
    jtbd_id = data.get("id")
    name = data.get("name")
    description = data.get("description")

    hierarchy = await get_jtbd_hierarchy(jtbd_id)
    ancestors = hierarchy["ancestors"]
    descendants = hierarchy["descendants"]
    total_text = ""
    for ancestor in ancestors:
        total_text += ancestor["name"] if ancestor["name"] is not None else ""
        total_text += "\n"
        total_text += ancestor["description"] if ancestor["description"] is not None else ""
        total_text += "\n"
    total_text += name if name is not None else ""
    total_text += "\n"
    total_text += description if description is not None else ""
    total_text += "\n"
    for descendant in descendants:
        total_text += descendant["name"] if descendant["name"] is not None else ""
        total_text += "\n"
        total_text += descendant["description"] if descendant["description"] is not None else ""
        total_text += "\n"
    description_embedding = get_text_embedding(total_text)

    demand = data.get("demand")
    parent_id = data.get("parent_id")
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(JTBD).where(JTBD.id == jtbd_id))
        jtbd = result.scalar_one_or_none()
        if not jtbd:
            return {"error": "JTBD not found"}
        if name is not None:
            jtbd.name = name
        if description is not None:
            jtbd.description = description
            jtbd.description_embedding = description_embedding
        if demand is not None:
            jtbd.demand = demand
        jtbd.parent_id = parent_id
        await session.commit()
        return {"status": "success"}

async def delete_jtbd(jtbd_id: int):
    async with AsyncSessionLocal() as session:
        async def delete_with_children(jtbd_id):
            result = await session.execute(select(JTBD).where(JTBD.parent_id == jtbd_id))
            children = result.scalars().all()
            for child in children:
                await delete_with_children(child.id)
            result = await session.execute(select(JTBD).where(JTBD.id == jtbd_id))
            jtbd = result.scalar_one_or_none()
            if jtbd:
                await session.delete(jtbd)
        await delete_with_children(jtbd_id)
        await session.commit()
        return {"status": "success"}

def build_jtbd_tree(jtbds, parent_id=None):
    tree = []
    for jtbd in [j for j in jtbds if j.parent_id == parent_id]:
        children = build_jtbd_tree(jtbds, jtbd.id)
        label = jtbd.name + (" (" + ",".join([c["name"] for c in children]) + ")" if len(children)>0 else "")
        if len(label) > 10:
            label = label[:10] + "..."
        node = {
            "name": jtbd.name,
            "label": label,
            "value": jtbd.id,
            "children": children
        }
        tree.append(node)
    return tree

async def get_jtbd_tree():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(JTBD))
        jtbds = result.scalars().all()
        tree = build_jtbd_tree(jtbds)
        return tree

async def get_jtbd_list():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(JTBD))
        jtbds = result.scalars().all()
        jtbd_list = [{
                "id": jtbd.id,
                "name": jtbd.name
            } for jtbd in jtbds]
        return jtbd_list

async def get_jtbd(jtbd_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(JTBD).where(JTBD.id == jtbd_id)
                                       .options(
                                           selectinload(JTBD.parent),
                                           selectinload(JTBD.products).options(selectinload(Product.actor), 
                                                                                    selectinload(Product.tech),
                                                                                    selectinload(Product.jtbd),
                                                                                    selectinload(Product.component).options(selectinload(Component.tech)))))

        jtbd = result.scalar_one_or_none()
        if not jtbd:
            return {"error": "JTBD not found"}

        demand = jtbd.demand
        if demand is not None and not isinstance(demand, dict):
            try:
                demand = dict(demand)
            except Exception:
                demand = None
        products = [
            {
                "id": p.id,
                "name": p.name,
                "jtbd_name": jtbd.name,
                "actor_name": p.actor.name if p.actor else None,
                "tech_name": p.tech.name if p.tech else None,
                "component_name": p.component.name if p.component else None,
                "component_tech_name": p.component.tech.name if p.component and p.component.tech else None,
            }
            for p in jtbd.products
        ]

        related_techs = []
        if jtbd.description_embedding is not None:
            sql = text("""
            SELECT tech.id, tech.name, tech.purpose, tech.principle, tech.spec, 
                (purpose_embedding <=> jtbd.description_embedding) AS cosine_distance
            FROM tech
            JOIN jtbd ON jtbd.id = :jtbd_id
            WHERE purpose_embedding IS NOT NULL
            ORDER BY cosine_distance ASC
            LIMIT 10
            """)

            result = await session.execute(sql, {"jtbd_id": jtbd_id})
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

        hierarchy = await get_jtbd_hierarchy(jtbd_id)


        comments = []
        if jtbd.description_embedding is not None:
            sql = text("""
            SELECT d2.id, d2.comment, d2.updated_at,
                (d2.target_embedding <=> d1.description_embedding) AS cosine_distance
            FROM jtbd d1, discussion d2
            WHERE d1.id = :jtbd_id
                AND d1.description_embedding IS NOT NULL
                AND d2.target_embedding IS NOT NULL
            ORDER BY cosine_distance ASC
            LIMIT 5
            """)

            result = await session.execute(sql, {"jtbd_id": jtbd_id})
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
            "id": jtbd.id,
            "name": jtbd.name,
            "description": jtbd.description,
            "description_embedding": jtbd.description_embedding.tolist() if hasattr(jtbd.description_embedding, "tolist") else jtbd.description_embedding,
            "parent_id": jtbd.parent_id,
            "parent_name": jtbd.parent.name if jtbd.parent else None,
            "demand": demand,
            "products": products,
            "related_techs": related_techs,
            "ancestors": hierarchy["ancestors"],
            "descendants": hierarchy["descendants"],
            "comments": comments
        }

async def get_jtbd_hierarchy(jtbd_id: int):
    async with AsyncSessionLocal() as session:
        # 현재 JTBD와 모든 조상 정보를 가져오는 쿼리
        ancestors_query = text("""
        WITH RECURSIVE ancestor_tree AS (
            -- 기본 케이스: 현재 JTBD
            SELECT id, parent_id, name, description
            FROM jtbd
            WHERE id = :jtbd_id
            
            UNION ALL
            
            -- 재귀 케이스: 부모 JTBD
            SELECT j.id, j.parent_id, j.name, j.description
            FROM jtbd j
            INNER JOIN ancestor_tree a ON j.id = a.parent_id
        )
        SELECT id, name, description
        FROM ancestor_tree
        WHERE id != :jtbd_id
        ORDER BY id;    
        """)
        
        # 모든 후손 정보를 가져오는 쿼리
        descendants_query = text("""
        WITH RECURSIVE descendant_tree AS (
            -- 기본 케이스: 현재 JTBD의 직계 자식
            SELECT id, parent_id, name, description
            FROM jtbd
            WHERE parent_id = :jtbd_id
            
            UNION ALL
            
            -- 재귀 케이스: 자식의 자식들
            SELECT j.id, j.parent_id, j.name, j.description
            FROM jtbd j
            INNER JOIN descendant_tree d ON j.parent_id = d.id
        )
        SELECT id, name, description
        FROM descendant_tree
        ORDER BY id;
        """)
        
        # 현재 JTBD 정보 가져오기
        current_result = await session.execute(
            select(JTBD).where(JTBD.id == jtbd_id)
        )
        current_jtbd = current_result.scalar_one_or_none()
        
        if not current_jtbd:
            return {"error": "JTBD not found"}
        
        # 조상 정보 가져오기
        ancestors_result = await session.execute(ancestors_query, {"jtbd_id": jtbd_id})
        ancestors = [
            {
                "id": row[0],
                "name": row[1],
                "description": row[2]
            }
            for row in ancestors_result.fetchall()
        ]
        
        # 후손 정보 가져오기
        descendants_result = await session.execute(descendants_query, {"jtbd_id": jtbd_id})
        descendants = [
            {
                "id": row[0],
                "name": row[1],
                "description": row[2]
            }
            for row in descendants_result.fetchall()
        ]
        
        return {
            "current": {
                "id": current_jtbd.id,
                "name": current_jtbd.name,
                "description": current_jtbd.description
            },
            "ancestors": ancestors,
            "descendants": descendants
        }
    
