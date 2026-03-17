import math
import random
from typing import List, Optional, Sequence

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from db import Image
from models import ImageData
from utils.matching_dnn import match_embedding

OUTPUT_POOL_SIZE = 200
TOP_K_SAMPLING = 12
SAMPLING_TEMPERATURE = 0.8
SOURCE_MUTATION_COUNT = 2
OUTPUT_MUTATION_COUNT = 2
SOURCE_MUTATION_SCALE = 0.18
OUTPUT_MUTATION_SCALE = 0.15


def _to_image_data(image: Image) -> ImageData:
    return ImageData(
        id=image.id,
        title=image.title,
        positive_prompt=image.positive_prompt,
        negative_prompt=image.negative_prompt,
        model=image.model,
        steps=image.steps,
        cfg=image.cfg,
        height=image.height,
        width=image.width,
        seed=image.seed,
        url=image.url,
        keywords=[],
    )


def _normalize_embedding(values: Sequence[float]) -> List[float]:
    norm = math.sqrt(sum(float(value) * float(value) for value in values))
    if norm <= 0:
        raise ValueError("Embedding norm must be greater than 0")

    return [float(value) / norm for value in values]


def _mutate_embedding(
    embedding: Sequence[float],
    scale: float,
) -> List[float]:
    mutated_embedding = [
        float(value) + random.gauss(0.0, scale)
        for value in embedding
    ]
    return _normalize_embedding(mutated_embedding)


def _sample_top_k_by_rank(
    images: List[Image],
    used_ids: set[str],
    top_k: int = TOP_K_SAMPLING,
    temperature: float = SAMPLING_TEMPERATURE,
) -> Optional[Image]:
    available_images = [image for image in images if image.id not in used_ids]
    if not available_images:
        return None

    candidate_images = available_images[:max(1, top_k)]
    safe_temperature = max(temperature, 1e-6)

    # The query is already ordered by cosine distance, so lower rank means higher score.
    logits = [-(rank / safe_temperature) for rank in range(len(candidate_images))]
    max_logit = max(logits)
    weights = [math.exp(logit - max_logit) for logit in logits]

    return random.choices(candidate_images, weights=weights, k=1)[0]


def get_story_images(
    image_id: Optional[str] = None,
    db: Session = None,
    image_id_prev: Optional[str] = None,
) -> List[ImageData]:
    """
    Return the source image followed by story candidates selected from
    the projected nearest-neighbor pool using top-k temperature sampling.
    """
    source_image_query = db.query(Image)
    if image_id:
        source_image = source_image_query.filter(Image.id == image_id).first()
    else:
        source_image = source_image_query.order_by(func.random()).first()
    if not source_image:
        return []

    if source_image.embedding is None:
        return [_to_image_data(source_image)]

    if image_id_prev:
        previous_image = (
            db.query(Image)
            .filter(Image.id == image_id_prev)
            .first()
        )
        if previous_image and previous_image.embedding is not None:
            match_embedding(previous_image.embedding, source_image.embedding)

    result = [_to_image_data(source_image)]
    used_ids = {source_image.id}

    normalized_source_embedding = _normalize_embedding(source_image.embedding)
    for _ in range(SOURCE_MUTATION_COUNT):
        mutated_source_embedding = _mutate_embedding(
            normalized_source_embedding,
            SOURCE_MUTATION_SCALE,
        )
        output_embedding = match_embedding(mutated_source_embedding)

        for _ in range(OUTPUT_MUTATION_COUNT):
            mutated_output_embedding = _mutate_embedding(
                output_embedding,
                OUTPUT_MUTATION_SCALE,
            )
            output_pool_images = (
                db.query(Image)
                .filter(
                    and_(
                        Image.id != source_image.id,
                        Image.embedding.isnot(None),
                    )
                )
                .order_by(Image.embedding.cosine_distance(mutated_output_embedding))
                .limit(OUTPUT_POOL_SIZE)
                .all()
            )

            candidate_image = _sample_top_k_by_rank(output_pool_images, used_ids)
            if candidate_image is None:
                continue

            result.append(_to_image_data(candidate_image))
            used_ids.add(candidate_image.id)

    return result
