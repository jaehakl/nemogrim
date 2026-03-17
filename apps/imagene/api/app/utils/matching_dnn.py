from __future__ import annotations

from collections import deque
from typing import Iterable, Sequence

import torch
import torch.nn as nn
import torch.nn.functional as F


EMBEDDING_DIM = 768
HIDDEN_DIM = 1024
REPLAY_BUFFER_SIZE = 2048
REPLAY_BATCH_SIZE = 32
LEARNING_RATE = 1e-3
DROPOUT = 0.1
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


class ResidualEmbeddingProjector(nn.Module):
    def __init__(self, input_dim: int = EMBEDDING_DIM, hidden_dim: int = HIDDEN_DIM, dropout: float = DROPOUT):
        super().__init__()
        self.input_norm = nn.LayerNorm(input_dim)
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, input_dim)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        x = self.input_norm(x)
        x = self.fc1(x)
        x = F.gelu(x)
        x = self.dropout(x)
        x = self.fc2(x)
        x = x + residual
        return F.normalize(x, p=2, dim=-1)


def _normalize_embedding(values: Sequence[float]) -> list[float]:
    if len(values) != EMBEDDING_DIM:
        raise ValueError(f"Embedding dimension must be {EMBEDDING_DIM}, got {len(values)}")

    tensor = torch.tensor(values, dtype=torch.float32)
    if not torch.isfinite(tensor).all():
        raise ValueError("Embedding contains non-finite values")

    norm = torch.linalg.norm(tensor)
    if norm <= 0:
        raise ValueError("Embedding norm must be greater than 0")

    return (tensor / norm).tolist()


def _get_runtime_state():
    if not hasattr(match_embedding, "model"):
        print("Initializing Matching DNN")
        match_embedding.model = ResidualEmbeddingProjector().to(DEVICE)
        match_embedding.optimizer = torch.optim.AdamW(match_embedding.model.parameters(), lr=LEARNING_RATE)
        match_embedding.loss_history = deque(maxlen=256)
        match_embedding.replay_buffer = deque(maxlen=REPLAY_BUFFER_SIZE)

    return (
        match_embedding.model,
        match_embedding.optimizer,
        match_embedding.loss_history,
        match_embedding.replay_buffer,
    )


def _sample_batch(
    current_input: list[float],
    current_target: list[float],
    replay_buffer: deque[tuple[list[float], list[float]]],
) -> tuple[torch.Tensor, torch.Tensor]:
    batch_pairs = [(current_input, current_target)]

    if replay_buffer:
        sample_size = min(REPLAY_BATCH_SIZE - 1, len(replay_buffer))
        if sample_size > 0:
            indices = torch.randperm(len(replay_buffer))[:sample_size].tolist()
            batch_pairs.extend(replay_buffer[index] for index in indices)

    inputs = torch.tensor([src for src, _ in batch_pairs], dtype=torch.float32, device=DEVICE)
    targets = torch.tensor([dst for _, dst in batch_pairs], dtype=torch.float32, device=DEVICE)
    return inputs, targets


def train_matching_dnn(input_embedding: Sequence[float], target_embedding: Sequence[float]) -> dict[str, float | int]:
    normalized_input = _normalize_embedding(input_embedding)
    normalized_target = _normalize_embedding(target_embedding)
    model, optimizer, loss_history, replay_buffer = _get_runtime_state()

    batch_inputs, batch_targets = _sample_batch(normalized_input, normalized_target, replay_buffer)

    model.train()
    optimizer.zero_grad(set_to_none=True)
    predictions = model(batch_inputs)
    loss = 1.0 - F.cosine_similarity(predictions, batch_targets, dim=-1).mean()
    loss.backward()
    optimizer.step()

    loss_value = float(loss.detach().cpu().item())
    loss_history.append(loss_value)
    replay_buffer.append((normalized_input, normalized_target))

    return {
        "loss": loss_value,
        "avg_loss": float(sum(loss_history) / len(loss_history)),
        "buffer_size": len(replay_buffer),
        "batch_size": int(batch_inputs.shape[0]),
    }


def infer_matching_dnn(input_embedding: Sequence[float]) -> list[float]:
    normalized_input = _normalize_embedding(input_embedding)
    model, _, _, _ = _get_runtime_state()

    model.eval()
    with torch.inference_mode():
        input_tensor = torch.tensor([normalized_input], dtype=torch.float32, device=DEVICE)
        output = model(input_tensor)[0].detach().cpu().tolist()

    return output


def match_embedding(
    input_embedding: Sequence[float],
    target_embedding: Sequence[float] | None = None,
) -> list[float] | dict[str, float | int]:
    """
    Online train or infer a 768 -> 768 embedding projector.

    - If both `input_embedding` and `target_embedding` are given, runs one online
      training step and returns training stats.
    - If only `input_embedding` is given, runs inference and returns a normalized
      output embedding.
    """
    if target_embedding is None:
        return infer_matching_dnn(input_embedding)

    return train_matching_dnn(input_embedding, target_embedding)


def clear_matching_dnn() -> None:
    for attr_name in ("model", "optimizer", "loss_history", "replay_buffer"):
        if hasattr(match_embedding, attr_name):
            delattr(match_embedding, attr_name)
