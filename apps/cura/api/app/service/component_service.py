from db import AsyncSessionLocal, Component, Product
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from analysis.embedding import get_text_embedding
from sqlalchemy import func, text

async def get_component(component_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Component)
            .options(
                selectinload(Component.products).options(selectinload(Product.actor),
                                                            selectinload(Product.tech), 
                                                            selectinload(Product.jtbd),
                                                            selectinload(Product.component).options(selectinload(Component.tech))),                
                selectinload(Component.tech))
            .where(Component.id == component_id)
        )

        component = result.scalar_one_or_none()
        if not component:
            return {"error": "Component not found"}


        related_techs = []        
        if component.description_embedding is not None:
            sql = text("""
            SELECT tech.id, tech.name, tech.purpose, tech.principle, tech.spec,
                (purpose_embedding <=> component.description_embedding) AS cosine_distance
            FROM tech
            JOIN component ON component.id = :component_id
            WHERE purpose_embedding IS NOT NULL
            ORDER BY cosine_distance ASC
            LIMIT 10
            """)

            result = await session.execute(sql, {"component_id": component_id})
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

        products = [
            {
                "id": p.id,
                "name": p.name,
                "tech_name": p.tech.name if p.tech else None,
                "actor_name": p.actor.name if p.actor else None,
                "component_name": p.component.name if p.component else None,
                "component_tech_name": p.component.tech.name if p.component and p.component.tech else None,
                "jtbd_name": p.jtbd.name if p.jtbd else None
            }
            for p in component.products
        ]

        comments = []
        if component.total_embedding is not None:
            sql = text("""
            SELECT d2.id, d2.comment, d2.updated_at,
                (d2.target_embedding <=> d1.total_embedding) AS cosine_distance
            FROM component d1, discussion d2
            WHERE d1.id = :component_id
                AND d1.total_embedding IS NOT NULL
                AND d2.target_embedding IS NOT NULL
            ORDER BY cosine_distance ASC
            LIMIT 5
            """)

            result = await session.execute(sql, {"component_id": component_id})
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
            "id": component.id,
            "name": component.name,
            "description": component.description,
            "spec_requirements": component.spec_requirements,
            "total_embedding": component.total_embedding.tolist() if hasattr(component.total_embedding, "tolist") else component.total_embedding,
            "unit_demand": component.unit_demand,
            "tech_id": component.tech_id,
            "tech_name": component.tech.name if component.tech else None,
            "related_techs": related_techs,
            "products": products,
            "comments": comments
        }
        return rv

async def get_component_list(tech_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Component).where(Component.tech_id == tech_id))
        components = result.scalars().all()
        return [{"id": c.id, "name": c.name} for c in components]

async def add_component(data: dict):
    tech_id = data.get("tech_id")
    name = data.get("name")
    async with AsyncSessionLocal() as session:
        new_component = Component(
            tech_id=tech_id,
            name=name,
        )
        session.add(new_component)
        await session.commit()
        await session.refresh(new_component)
        return {
            "id": new_component.id,
            "name": new_component.name,
            "description": new_component.description,
            "spec_requirements": new_component.spec_requirements,
            "total_embedding": new_component.total_embedding.tolist() if hasattr(new_component.total_embedding, "tolist") else new_component.total_embedding,
            "unit_demand": new_component.unit_demand            
        }

async def update_component(data: dict):
    component_id = data.get("id")
    name = data.get("name")
    description = data.get("description")    
    spec_requirements = data.get("spec_requirements")
    unit_demand = data.get("unit_demand")
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Component).where(Component.id == component_id)
                                       .options(selectinload(Component.tech)))
        component = result.scalar_one_or_none()
        
        total_text = ""
        total_text += f"{component.name} " if component.name else ""
        total_text += f"{component.description} " if component.description else ""
        total_text += f"{component.spec_requirements} " if component.spec_requirements else ""
        total_text += "\n" + "이 컴포넌트를 사용하는 기술은 다음과 같습니다." + "\n"
        total_text += f"{component.tech.name} " if component.tech else ""
        total_text += f"{component.tech.purpose} " if component.tech.purpose else ""
        total_text += f"{component.tech.principle} " if component.tech.principle else ""
        total_text += f"{component.tech.spec} " if component.tech.spec else ""                
        total_embedding = get_text_embedding(total_text)

        if not component:
            return {"error": "Component not found"}
        if name is not None:
            component.name = name
        if description is not None:
            component.description = description
            component.description_embedding = get_text_embedding(description)        
        if spec_requirements is not None:
            component.spec_requirements = spec_requirements
        if unit_demand is not None:
            component.unit_demand = unit_demand
        component.total_embedding = total_embedding
        await session.commit()
        return {"status": "success"}

async def delete_component(component_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Component).where(Component.id == component_id))
        component = result.scalar_one_or_none()
        if not component:
            return {"error": "Component not found"}
        await session.delete(component)
        await session.commit()
        return {"status": "success"}
    
