from __future__ import annotations

import csv
import os
import threading
from pathlib import Path

from ..db import MODEL_DIR


CLIP_MODEL_NAME = "OpenAI CLIP ViT-L/14"
WD14_MODEL_REPO = "SmilingWolf/wd-eva02-large-tagger-v3"
_MODEL_LOCK = threading.Lock()
_clip_bundle = None
_wd14_bundle = None


def extract_clip_embedding(image_path: Path) -> bytes:
    model, preprocess, device, torch, image_type = _load_clip()
    image = preprocess(image_type.open(image_path).convert("RGB")).unsqueeze(0).to(device)
    with torch.inference_mode():
        embedding = model.encode_image(image).float()
        embedding /= embedding.norm(dim=-1, keepdim=True).clamp_min(1e-12)
    array = embedding[0].cpu().numpy().astype("<f4", copy=False)
    return array.tobytes()


def extract_clip_text_embedding(text: str) -> bytes:
    model, _preprocess, device, torch, _image_type = _load_clip()
    import clip

    tokens = clip.tokenize([text], truncate=True).to(device)
    with torch.inference_mode():
        embedding = model.encode_text(tokens).float()
        embedding /= embedding.norm(dim=-1, keepdim=True).clamp_min(1e-12)
    array = embedding[0].cpu().numpy().astype("<f4", copy=False)
    return array.tobytes()


def extract_wd14_tags(image_path: Path) -> tuple[str, list[str]]:
    model, transform, labels, device, torch, image_type = _load_wd14()
    image = transform(image_type.open(image_path).convert("RGB")).unsqueeze(0).to(device)
    with torch.inference_mode():
        output = model(image)
        if isinstance(output, (tuple, list)):
            output = output[0]
        probabilities = torch.sigmoid(output)[0].float().cpu().tolist()

    selected = []
    for label, probability in zip(labels, probabilities, strict=True):
        category = label[1]
        threshold = 0.35 if category == 0 else 0.85
        if category in {0, 4} and probability > threshold:
            selected.append((label[0], probability))
    selected.sort(key=lambda item: item[1], reverse=True)
    keywords = [name for name, _probability in selected]
    return ", ".join(keywords), keywords


def _load_clip():
    global _clip_bundle
    with _MODEL_LOCK:
        if _clip_bundle is None:
            import clip
            import torch
            from PIL import Image

            device = "cuda" if torch.cuda.is_available() else "cpu"
            model, preprocess = clip.load(
                "ViT-L/14",
                device=device,
                download_root=str(MODEL_DIR / "clip"),
                jit=False,
            )
            model.eval()
            _clip_bundle = (model, preprocess, device, torch, Image)
    return _clip_bundle


def _load_wd14():
    global _wd14_bundle
    with _MODEL_LOCK:
        if _wd14_bundle is None:
            os.environ.setdefault("HF_HOME", str(MODEL_DIR / "huggingface"))
            import timm
            import torch
            from huggingface_hub import hf_hub_download
            from PIL import Image
            from timm.data import create_transform, resolve_model_data_config

            device = "cuda" if torch.cuda.is_available() else "cpu"
            model = timm.create_model(f"hf_hub:{WD14_MODEL_REPO}", pretrained=True)
            model = model.eval().to(device)
            transform = create_transform(**resolve_model_data_config(model), is_training=False)
            csv_path = hf_hub_download(
                repo_id=WD14_MODEL_REPO,
                filename="selected_tags.csv",
                cache_dir=str(MODEL_DIR / "huggingface"),
            )
            with open(csv_path, encoding="utf-8") as file:
                labels = [
                    (row["name"], int(row["category"]))
                    for row in csv.DictReader(file)
                ]
            _wd14_bundle = (model, transform, labels, device, torch, Image)
    return _wd14_bundle
