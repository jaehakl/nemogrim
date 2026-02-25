from __future__ import annotations

import os
import random
import shutil
import platform
from dataclasses import dataclass, asdict
import tempfile
from pathlib import Path
from typing import Optional, List, Tuple

# generate.py 안의 함수/상수들을 import
# generate.py 파일명이 다르면 아래 import를 맞춰주세요.
from .generate import generate as wan_generate
from .generate import _validate_args  # 내부 검증 재사용(편의)
from .wan.configs import SUPPORTED_SIZES


@dataclass
class WanArgs:
    # generate.py의 argparse 인자들과 동일한 필드들
    task: str = "i2v-A14B"
    size: str = "1280*720"
    frame_num: Optional[int] = None
    ckpt_dir: Optional[str] = None
    lora_dir: Optional[str] = None
    save_dir: str = "test_results"
    offload_model: Optional[bool] = None
    ulysses_size: int = 1
    t5_fsdp: bool = False
    t5_cpu: bool = False
    dit_fsdp: bool = False
    save_file: Optional[str] = None  # generate.py에서는 실제로 안 쓰지만 유지
    prompt: Optional[str] = None
    prompt_file: Optional[str] = None
    use_prompt_extend: bool = False
    prompt_extend_method: str = "local_qwen"
    prompt_extend_model: Optional[str] = None
    prompt_extend_target_lang: str = "zh"
    base_seed: int = -1
    image: Optional[str] = None
    image_path_file: Optional[str] = None
    sample_solver: str = "euler"
    sample_steps: Optional[int] = None
    sample_shift: Optional[float] = None
    sample_guide_scale: Optional[float] = None
    convert_model_dtype: bool = False
    low_noise_device_id: Optional[int] = None
    high_noise_device_id: Optional[int] = None


def prepare_dual_noise_ckpt_dir(
    model_root: Path,
    high_noise_safetensors: Path,
    low_noise_safetensors: Path,
    use_symlink: bool = False,
) -> Path:
    model_root = Path(model_root)
    high_noise_safetensors = Path(high_noise_safetensors)
    low_noise_safetensors = Path(low_noise_safetensors)

    if not model_root.is_dir():
        raise FileNotFoundError(f"model_root not found: {model_root}")
    if not high_noise_safetensors.is_file():
        raise FileNotFoundError(f"high safetensors not found: {high_noise_safetensors}")
    if not low_noise_safetensors.is_file():
        raise FileNotFoundError(f"low safetensors not found: {low_noise_safetensors}")

    # IMPORTANT: must match config.low_noise_checkpoint / config.high_noise_checkpoint
    LOW_SUBFOLDER = "low_noise_model"
    HIGH_SUBFOLDER = "high_noise_model"

    ckpt_dir = Path(tempfile.mkdtemp(prefix="wan_ckpt_"))

    def link_or_copy(src: Path, dst: Path):
        dst.parent.mkdir(parents=True, exist_ok=True)
        if use_symlink:
            try:
                if dst.exists():
                    dst.unlink()
                os.symlink(str(src), str(dst))
                return
            except OSError:
                pass
        shutil.copy2(src, dst)

    # ---- (A) shared files that image2video.py expects in ckpt_dir root ----
    # These filenames must match what your config uses (config.t5_checkpoint, config.vae_checkpoint, etc.)
    # Most Wan configs use these exact names:
    shared_files = [
        "models_t5_umt5-xxl-enc-bf16.pth",
        "Wan2.1_VAE.pth",
    ]
    for name in shared_files:
        src = model_root / name
        if not src.is_file():
            raise FileNotFoundError(f"Required file missing in model_root: {src}")
        link_or_copy(src, ckpt_dir / name)

    # Optional: if you keep tokenizer locally under model_root/google/umt5-xxl
    tok_dir = model_root / "google" / "umt5-xxl"
    if tok_dir.is_dir():
        # copytree is heavy; symlink recommended if possible
        dst_tok = ckpt_dir / "google" / "umt5-xxl"
        dst_tok.parent.mkdir(parents=True, exist_ok=True)
        if use_symlink:
            try:
                if dst_tok.exists():
                    # remove old link/dir if exists
                    if dst_tok.is_symlink() or dst_tok.is_file():
                        dst_tok.unlink()
                    else:
                        shutil.rmtree(dst_tok)
                os.symlink(str(tok_dir), str(dst_tok))
            except OSError:
                shutil.copytree(tok_dir, dst_tok, dirs_exist_ok=True)
        else:
            shutil.copytree(tok_dir, dst_tok, dirs_exist_ok=True)

    # ---- (B) model config.json into each subfolder ----
    src_config = model_root / "config.json"
    if not src_config.is_file():
        raise FileNotFoundError(f"config.json not found in model_root: {src_config}")

    link_or_copy(src_config, ckpt_dir / LOW_SUBFOLDER / "config.json")
    link_or_copy(src_config, ckpt_dir / HIGH_SUBFOLDER / "config.json")

    # ---- (C) weights with diffusers default filename in each subfolder ----
    link_or_copy(low_noise_safetensors,  ckpt_dir / LOW_SUBFOLDER / "diffusion_pytorch_model.safetensors")
    link_or_copy(high_noise_safetensors, ckpt_dir / HIGH_SUBFOLDER / "diffusion_pytorch_model.safetensors")

    return ckpt_dir

def run_i2v(
    *,
    ckpt_dir: Path,
    image_path: Path,
    prompt: str,
    save_dir: Path,
    size: str = "1280*704",
    frame_num: int = 81,          # 4n+1 규칙(예: 81, 101, 121...)
    seed: int = 1234,
    offload_model: Optional[bool] = True,
    sample_solver: str = "euler",
    sample_steps: Optional[int] = None,
    sample_shift: Optional[float] = None,
    guide_scale: Optional[float] = None,
    lora_dir: Optional[Path] = None,
    convert_model_dtype: bool = False,
    low_noise_device_id: Optional[int] = None,
    high_noise_device_id: Optional[int] = None,
) -> None:
    """
    subprocess 없이 generate(args) 직접 호출.
    결과 mp4는 generate.py의 save_video_to_file 로 save_dir에 저장됩니다.
    """

    # 기본적인 사이즈/태스크 체크
    task = "i2v-A14B"
    if task not in SUPPORTED_SIZES:
        raise ValueError(f"Unknown task: {task}")
    if size not in SUPPORTED_SIZES[task]:
        raise ValueError(f"Unsupported size {size} for {task}. Supported: {SUPPORTED_SIZES[task]}")

    args = WanArgs(
        task=task,
        size=size,
        frame_num=frame_num,
        ckpt_dir=str(ckpt_dir),
        lora_dir=str(lora_dir) if lora_dir else None,
        save_dir=str(save_dir),
        offload_model=offload_model,
        prompt=prompt,
        image=str(image_path),
        base_seed=seed,
        sample_solver=sample_solver,
        sample_steps=sample_steps,
        sample_shift=sample_shift,
        sample_guide_scale=guide_scale,
        convert_model_dtype=convert_model_dtype,
        low_noise_device_id=low_noise_device_id,
        high_noise_device_id=high_noise_device_id,
    )

    # generate.py의 검증/기본값 채우기 로직 재사용
    _validate_args(args)

    # 단일 프로세스 실행을 강제(혹시 외부에서 env가 들어와도 안전하게)
    os.environ.setdefault("RANK", "0")
    os.environ.setdefault("WORLD_SIZE", "1")
    os.environ.setdefault("LOCAL_RANK", "0")

    wan_generate(args)
