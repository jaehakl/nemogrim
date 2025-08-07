from db import AsyncSessionLocal, Product, Component, JTBD, Actor, Tech
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from analysis.embedding import get_text_embedding
from sqlalchemy import text
from analysis.tree_from_embedding import tree_from_embedding

async def get_product_tree():
    async with AsyncSessionLocal() as session:
        # purpose_embedding이 있는 기술들만 가져오기
        result = await session.execute(
            select(Product)
            .where(Product.total_embedding.isnot(None))
        )
        products = result.scalars().all()
        
        if not products:
            return {"error": "No products with total embeddings found"}
            
        # 기술 데이터 준비
        product_data = [
            {
                "id": product.id,
                "name": product.name,
                "embedding": product.total_embedding
            }
            for product in products
        ]

        tree = tree_from_embedding(product_data)

        # purpose_embedding이 없는 기술들만 가져오기
        result_no_embedding = await session.execute(
            select(Product)
            .where(Product.total_embedding.is_(None))
        )
        products_no_embedding = result_no_embedding.scalars().all()
        product_data_no_embedding = [
            {
                "name": product.name,
                "label": product.name,
                "value": product.id
            }
            for product in products_no_embedding
        ]
        tree.extend(product_data_no_embedding)
        return tree

async def get_product_list():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Product))
        products = result.scalars().all()
        return [{"id": p.id, "name": p.name, "type": "product"} for p in products]

async def get_product(product_id: int):
    async with AsyncSessionLocal() as session:

        result = await session.execute(
            select(Product)
            .where(Product.id == product_id)
            .options(
                selectinload(Product.actor),
                selectinload(Product.jtbd),
                selectinload(Product.tech), 
                selectinload(Product.component).options(selectinload(Component.tech)),
            )
        )
        p = result.scalar_one_or_none()
        if not p:
            return {"error": "Product not found"}
                        
        data = {c.name: getattr(p, c.name) if c.name != "total_embedding" else None for c in p.__table__.columns}
        data["component_tech_id"] = p.component.tech.id if p.component and p.component.tech else None
        data["total_embedding"] = p.total_embedding.tolist() if hasattr(p.total_embedding, "tolist") else p.total_embedding

        comments = []
        if p.total_embedding is not None:
            sql = text("""
            SELECT d2.id, d2.comment, d2.updated_at,
                (d2.target_embedding <=> d1.total_embedding) AS cosine_distance
            FROM product d1, discussion d2
            WHERE d1.id = :product_id
                AND d1.total_embedding IS NOT NULL
                AND d2.target_embedding IS NOT NULL
            ORDER BY cosine_distance ASC
            LIMIT 5
            """)

            result = await session.execute(sql, {"product_id": product_id})
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
        data["comments"] = comments

        return data

async def add_product(data: dict):
    async with AsyncSessionLocal() as session:
        if "name" not in data:
            return {"error": "Name is required"}
        name = data["name"]
        jtbd_id = data["jtbd_id"] if "jtbd_id" in data else None
        component_id = data["component_id"] if "component_id" in data else None
        tech_id = data["tech_id"] if "tech_id" in data else None
        actor_id = data["actor_id"] if "actor_id" in data else None

        p = Product(
            name=name,
            jtbd_id=jtbd_id,
            component_id=component_id,
            tech_id=tech_id,
            actor_id=actor_id
        )
        session.add(p)
        await session.commit()        
        await session.refresh(p)

        result = await session.execute(select(Product).where(Product.id == p.id)
                                       .options(selectinload(Product.actor), 
                                                selectinload(Product.tech), 
                                                selectinload(Product.jtbd),
                                                selectinload(Product.component).options(selectinload(Component.tech))))
        product = result.scalar_one_or_none()

        total_text = ""
        total_text += f"{product.name} " if product.name else ""
        total_text += "\n"
        total_text += "이 제품을 개발한 기업은 다음과 같습니다."
        total_text += f"{product.actor.name} " if product.actor else ""
        total_text += f"{product.actor.description} " if product.actor else ""
        total_text += "\n"
        total_text += "이 제품의 주 사용처는 다음과 같습니다."
        total_text += f"{product.jtbd.name} " if product.jtbd else ""
        total_text += f"{product.jtbd.description} " if product.jtbd else ""
        total_text += f"{product.component.name} " if product.component else ""
        total_text += f"{product.component.description} " if product.component else ""
        total_text += f"{product.component.spec_requirements} " if product.component else ""
        total_text += "\n"
        total_text += "이 제품에 사용된 기술은 다음과 같습니다."
        total_text += f"{product.tech.name} " if product.tech else ""
        total_text += f"{product.tech.purpose} " if product.tech else ""
        total_text += f"{product.tech.principle} " if product.tech else ""
        total_text += f"{product.tech.spec} " if product.tech else ""

        total_embedding = get_text_embedding(total_text)
        product.total_embedding = total_embedding

        await session.commit()

        return {"id": p.id}

async def update_product(data: dict):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Product).where(Product.id == data["id"])
                                       .options(selectinload(Product.actor), 
                                                selectinload(Product.tech), 
                                                selectinload(Product.jtbd),
                                                selectinload(Product.component).options(selectinload(Component.tech))))
        product = result.scalar_one_or_none()

        if "name" in data:
            product.name = data["name"]
        if "actor_id" in data:
            product.actor_id = data["actor_id"]
        if "jtbd_id" in data:
            product.jtbd_id = data["jtbd_id"]
        if "component_id" in data:
            product.component_id = data["component_id"]
        if "tech_id" in data:
            product.tech_id = data["tech_id"]

        total_text = ""
        total_text += f"{product.name} " if product.name else ""
        total_text += "\n"
        total_text += "이 제품을 개발한 기업은 다음과 같습니다."
        total_text += f"{product.actor.name} " if product.actor else ""
        total_text += f"{product.actor.description} " if product.actor else ""
        total_text += "\n"
        total_text += "이 제품의 주 사용처는 다음과 같습니다."
        total_text += f"{product.jtbd.name} " if product.jtbd else ""
        total_text += f"{product.jtbd.description} " if product.jtbd else ""
        total_text += f"{product.component.name} " if product.component else ""
        total_text += f"{product.component.description} " if product.component else ""
        total_text += f"{product.component.spec_requirements} " if product.component else ""
        total_text += "\n"
        total_text += "이 제품에 사용된 기술은 다음과 같습니다."
        total_text += f"{product.tech.name} " if product.tech else ""
        total_text += f"{product.tech.purpose} " if product.tech else ""
        total_text += f"{product.tech.principle} " if product.tech else ""
        total_text += f"{product.tech.spec} " if product.tech else ""

        total_embedding = get_text_embedding(total_text)
        product.total_embedding = total_embedding

        await session.commit()

        return {"status": "success"}

async def delete_product(product_id: int):
    async with AsyncSessionLocal() as session:
        p = await session.get(Product, product_id)
        if not p:
            return {"error": "Product not found"}
        await session.delete(p)
        await session.commit()
        return {"status": "success"} 
    

