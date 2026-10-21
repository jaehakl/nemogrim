from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class DeviceInfo:
    device: str
    name: str
    note: str | None = None


def resolve_device(requested: str) -> DeviceInfo:
    """요청한 장치를 실제 torch 장치로 결정한다. CUDA가 없으면 CPU로 폴백한다."""
    import torch

    if requested != "cpu" and torch.cuda.is_available():
        return DeviceInfo("cuda:0", torch.cuda.get_device_name(0))
    note = "CUDA를 사용할 수 없어 CPU로 실행합니다" if requested == "cuda" else None
    return DeviceInfo("cpu", "CPU", note)


def configure_hub_environment(offline: bool) -> None:
    """Hugging Face Hub가 import되기 전에 호출해야 적용된다."""
    # Windows 일반 계정은 심볼릭 링크를 만들 수 없어 매번 경고가 출력된다. 캐시는 정상 동작한다.
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    if offline:
        os.environ["HF_HUB_OFFLINE"] = "1"
