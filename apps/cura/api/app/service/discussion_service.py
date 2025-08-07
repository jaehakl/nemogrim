from db import AsyncSessionLocal, Discussion
from sqlalchemy.future import select
from analysis.embedding import get_text_embedding
from sqlalchemy import text, func
from random import shuffle
from datetime import datetime

from analysis.tree_from_embedding import tree_from_embedding


async def get_discussion_tree():
    async with AsyncSessionLocal() as session:
        # purpose_embedding이 있는 기술들만 가져오기
        result = await session.execute(
            select(Discussion)
            .where(Discussion.target_embedding.isnot(None))
        )
        discussions = result.scalars().all()
        
        # 기술 데이터 준비
        discussion_data = [
            {
                "id": discussion.id,
                "name": discussion.comment,
                "embedding": discussion.target_embedding
            }
            for discussion in discussions
        ]

        tree = tree_from_embedding(discussion_data)

        # purpose_embedding이 없는 기술들만 가져오기
        result_no_embedding = await session.execute(
            select(Discussion)
            .where(Discussion.target_embedding.is_(None))
        )
        discussions_no_embedding = result_no_embedding.scalars().all()
        discussion_data_no_embedding = [
            {
                "name": discussion.comment,
                "label": discussion.comment,
                "value": discussion.id
            }
            for discussion in discussions_no_embedding
        ]

        tree.extend(discussion_data_no_embedding)
        return tree



async def get_discussion_list():
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Discussion)
            .order_by(func.random())
            .limit(10)
        )
        discussions = result.scalars().all()
        return [{"id": d.id, "comment": d.comment, "updated_at": d.updated_at} for d in discussions]

async def add_discussion(data: dict):
    comment = data.get("comment")
    async with AsyncSessionLocal() as session:
        if "comment" not in data:
            return {"error": "Comment is required"}
        comment = data["comment"]
        comment_embedding = get_text_embedding(comment)

        if "target_embedding" in data:
            target_embedding = data["target_embedding"]
        else:
            target = data["target"]
            target_embedding = get_text_embedding(target)
        new_discussion = Discussion(
            comment=comment,
            updated_at=datetime.now(),
            comment_embedding=comment_embedding,
            target_embedding=target_embedding
        )
        session.add(new_discussion)
        await session.commit()
        await session.refresh(new_discussion)
        return {"id": new_discussion.id, "comment": new_discussion.comment}

async def get_discussion(discussion_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Discussion)
            .where(Discussion.id == discussion_id)
        )
        discussion = result.scalar_one_or_none()
        if not discussion:
            return {"error": "Discussion not found"}

        candidate_comments = []
        if discussion.comment_embedding is not None:
            sql = text("""
            SELECT d2.id, d2.comment, d2.updated_at,
                (d2.target_embedding <=> d1.comment_embedding) AS cosine_distance
            FROM discussion d1
            JOIN discussion d2 ON d2.id != d1.id
            WHERE d1.id = :discussion_id
                AND d1.comment_embedding IS NOT NULL
                AND d2.comment_embedding IS NOT NULL
            ORDER BY cosine_distance ASC
            LIMIT 5
            """)

            result = await session.execute(sql, {"discussion_id": discussion_id})
            rows = result.fetchall()
            candidate_comments = [
                {
                    "id": row[0],
                    "comment": row[1],
                    "updated_at": row[2].strftime("%Y-%m-%d") if row[2] else None,
                    "similarity": float(row[3])
                }
                for row in rows
            ]
        
        candidate_targets = []
        if discussion.target_embedding is not None:
            sql = text("""
            SELECT d2.id, d2.comment, d2.updated_at,
                (d2.comment_embedding <=> d1.target_embedding) AS cosine_distance
            FROM discussion d1
            JOIN discussion d2 ON d2.id != d1.id
            WHERE d1.id = :discussion_id
                AND d1.target_embedding IS NOT NULL
                AND d2.target_embedding IS NOT NULL
            ORDER BY cosine_distance ASC
            LIMIT 5
            """)

            result = await session.execute(sql, {"discussion_id": discussion_id})
            rows = result.fetchall()
            rows.reverse()
            
            candidate_targets = [
                {
                    "id": row[0],
                    "comment": row[1],
                    "updated_at": row[2].strftime("%Y-%m-%d") if row[2] else None,
                    "similarity": float(row[3])
                }
                for row in rows
            ]            
        
        other_comments = []
        if discussion.comment_embedding is not None:
            sql = text("""
            SELECT d2.id, d2.comment, d2.updated_at,
                (d2.target_embedding <=> d1.target_embedding) AS cosine_distance
            FROM discussion d1
            JOIN discussion d2 ON d2.id != d1.id
            WHERE d1.id = :discussion_id
                AND d1.comment_embedding IS NOT NULL
                AND d2.comment_embedding IS NOT NULL
            ORDER BY cosine_distance ASC
            LIMIT 5
            """)

            result = await session.execute(sql, {"discussion_id": discussion_id})
            rows = result.fetchall()
            other_comments = [
                {
                    "id": row[0],
                    "comment": row[1],
                    "updated_at": row[2].strftime("%Y-%m-%d") if row[2] else None,
                    "similarity": float(row[3])
                }
                for row in rows
            ]

        similar_comments = []
        if discussion.comment_embedding is not None:
            sql = text("""
            SELECT d2.id, d2.comment, d2.updated_at,
                (d2.comment_embedding <=> d1.comment_embedding) AS cosine_distance
            FROM discussion d1
            JOIN discussion d2 ON d2.id != d1.id
            WHERE d1.id = :discussion_id
                AND d1.comment_embedding IS NOT NULL
                AND d2.comment_embedding IS NOT NULL
            ORDER BY cosine_distance ASC
            LIMIT 5
            """)

            result = await session.execute(sql, {"discussion_id": discussion_id})
            rows = result.fetchall()
            similar_comments = [
                {
                    "id": row[0],
                    "comment": row[1],  
                    "updated_at": row[2].strftime("%Y-%m-%d") if row[2] else None,
                    "similarity": float(row[3])
                }
                for row in rows
            ]       
            
        rv = {
            "id": discussion.id,
            "comment": discussion.comment,
            "candidate_comments": candidate_comments,
            "candidate_targets": candidate_targets,
            "other_comments": other_comments,
            "similar_comments": similar_comments
        }
        return rv

async def update_discussion(data: dict):
    discussion_id = data["id"]
    comment = data["comment"]
    print(comment)
    async with AsyncSessionLocal() as session:
        result_obj = await session.execute(select(Discussion).where(Discussion.id == int(discussion_id)))
        print(result_obj)
        discussion = result_obj.scalar_one_or_none()
        if not discussion:
            return {"error": "Discussion not found"}
        if comment is not None:
            discussion.comment = comment
            discussion.comment_embedding = get_text_embedding(comment)
            discussion.updated_at = datetime.now()
            await session.commit()
            return {"status": "success"}

async def delete_discussion(discussion_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Discussion).where(Discussion.id == discussion_id))
        discussion = result.scalar_one_or_none()
        if not discussion:
            return {"error": "Discussion not found"}
        await session.delete(discussion)
        await session.commit()
        return {"status": "success"}
