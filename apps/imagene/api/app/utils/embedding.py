import numpy as np

def get_text_embedding(text: str):
    # get_text_embedding 함수가 처음 호출될 때만 SentenceTransformer 모듈과 모델을 동적으로 로드합니다.
    # (embedding.py가 import될 때는 아무런 리소스가 사용되지 않음)
    if not hasattr(get_text_embedding, "model"):
        print("Initializing Embedding Model")
        from sentence_transformers import SentenceTransformer
        get_text_embedding.model = SentenceTransformer("all-mpnet-base-v2")

    model = get_text_embedding.model

    embeddings = model.encode([text])
    v = embeddings[0]
    norm = np.linalg.norm(v)
    normalized_embedding = v / norm
    return normalized_embedding.tolist()

