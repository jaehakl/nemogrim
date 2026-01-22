import random, gc, torch
from io import BytesIO
import asyncio
from typing import Optional, List, Any, Tuple, Dict
from diffusers import StableDiffusionXLPipeline
import multiprocessing as mp
from concurrent.futures import ThreadPoolExecutor
import os

import torch
import gc
import random
from typing import List, Tuple, Any

# Flux 및 SDXL 파이프라인
from diffusers import StableDiffusionXLPipeline, AutoencoderKL
from diffusers import EulerAncestralDiscreteScheduler

_generation_lock = asyncio.Semaphore(1)

def get_available_cuda_devices() -> List[int]:
    """사용 가능한 CUDA 디바이스 목록을 반환합니다."""
    if not torch.cuda.is_available():
        return []
    
    available_devices = []
    for i in range(torch.cuda.device_count()):
        try:
            # 디바이스가 사용 가능한지 확인
            torch.cuda.set_device(i)
            torch.cuda.empty_cache()
            available_devices.append(i)
        except Exception as e:
            print(f"CUDA 디바이스 {i}를 사용할 수 없습니다: {e}")
            continue
    
    return available_devices

def get_optimal_chunk_size(total_items: int, num_devices: int) -> int:
    """디바이스 수에 따라 최적의 청크 크기를 계산합니다."""
    if num_devices <= 1:
        return min(4, total_items)
    
    # 각 디바이스당 최소 1개, 최대 8개씩 처리
    base_chunk = max(1, total_items // num_devices)
    return min(8, max(1, base_chunk))

def get_gpu_memory_info() -> List[Dict[str, Any]]:
    """사용 가능한 GPU들의 메모리 정보를 반환합니다."""
    if not torch.cuda.is_available():
        return []
    
    gpu_info = []
    for i in range(torch.cuda.device_count()):
        try:
            torch.cuda.set_device(i)
            total_memory = torch.cuda.get_device_properties(i).total_memory
            allocated_memory = torch.cuda.memory_allocated(i)
            cached_memory = torch.cuda.memory_reserved(i)
            free_memory = total_memory - allocated_memory
            
            gpu_info.append({
                'device_id': i,
                'name': torch.cuda.get_device_name(i),
                'total_memory_gb': total_memory / (1024**3),
                'allocated_memory_gb': allocated_memory / (1024**3),
                'cached_memory_gb': cached_memory / (1024**3),
                'free_memory_gb': free_memory / (1024**3),
                'memory_usage_percent': (allocated_memory / total_memory) * 100
            })
        except Exception as e:
            print(f"GPU {i} 정보를 가져올 수 없습니다: {e}")
            continue
    
    return gpu_info

def print_gpu_status():
    """현재 GPU 상태를 출력합니다."""
    gpu_info = get_gpu_memory_info()
    if not gpu_info:
        print("사용 가능한 CUDA 디바이스가 없습니다.")
        return
    
    print("=== GPU 상태 ===")
    for gpu in gpu_info:
        print(f"GPU {gpu['device_id']}: {gpu['name']}")
        print(f"  총 메모리: {gpu['total_memory_gb']:.2f} GB")
        print(f"  사용 중: {gpu['allocated_memory_gb']:.2f} GB ({gpu['memory_usage_percent']:.1f}%)")
        print(f"  여유 메모리: {gpu['free_memory_gb']:.2f} GB")
        print()


def generate_images_pony(
    ckpt_path: str,
    positive_prompt_list: List[str],
    negative_prompt_list: List[str],
    seed_list: List[int],
    step: int = 25,       # [설명서 권장] 25 스텝
    cfg: float = 7.0,
    height: int = 1024,   # [설명서 권장] 1024px (절대 512 금지!)
    width: int = 1024,
    device_id: int = 0,
    max_chunk_size: int = 1,
) -> Tuple[List[Any], List[int]]:
    
    torch.cuda.set_device(device_id)
    device = f"cuda:{device_id}"
    cache_key = f"pipe_{device_id}"
    if not hasattr(generate_images_pony, cache_key):
        #vae_path = ckpt_path.split("/")[:-1] + "/pony_vae.safetensors"
        #vae = AutoencoderKL.from_pretrained(vae_path, torch_dtype=torch.float16)
        vae = AutoencoderKL.from_pretrained(
            "madebyollin/sdxl-vae-fp16-fix", 
            torch_dtype=torch.float16
        )
        pipe = StableDiffusionXLPipeline.from_single_file(
            ckpt_path,
            vae=vae,                # 위에서 설정한 VAE 주입
            torch_dtype=torch.float16,
            use_safetensors=True,
            add_watermarker=False,
            variant="fp16"
        )        
        pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)        
        pipe.to(device)
        pipe.enable_attention_slicing()
        pipe.enable_vae_slicing()
        setattr(generate_images_pony, cache_key, pipe)

    pipe = getattr(generate_images_pony, cache_key)
    
    images: List[Any] = []
    all_seeds: List[int] = []
    i = 0
    
    while i < len(positive_prompt_list):
        chunk_size = min(max_chunk_size, len(positive_prompt_list) - i)        
        p_prompts = positive_prompt_list[i:i+chunk_size]
        n_prompts = negative_prompt_list[i:i+chunk_size]        
        generators = []
        current_seeds = []
        common_positive_prompt = "score_9, score_8_up, score_7_up, source_anime, rating_safe, masterpiece, best quality, very aesthetic, newest,"        
        for p_prompt in p_prompts:
            p_prompt = common_positive_prompt + p_prompt
        common_negative_prompt = (
            "score_4, score_5, score_6, source_pony, source_furry,"
            "nsfw, sex, romance, woman, portrait, duplicate, "
            "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry,"
            "poor contrast, poor colors"
            )
        for n_prompt in n_prompts:
            n_prompt = common_negative_prompt
        
        for j in range(chunk_size):
            s = seed_list[i+j]
            if s is None: s = random.randint(0, 2**32 - 1)
            current_seeds.append(s)
            generators.append(torch.Generator(device=device).manual_seed(s))

        # 메모리 정리
        torch.cuda.empty_cache()
        gc.collect()


        with torch.inference_mode():
            generated_images = pipe(
                prompt=p_prompts,
                negative_prompt=n_prompts,
                num_inference_steps=step,
                guidance_scale=cfg,
                height=height,
                width=width,
                generator=generators,
                # Clip Skip 2는 diffusers SDXL 파이프라인 기본값이므로 설정 불필요
            ).images
            
        images.extend(generated_images)
        all_seeds.extend(current_seeds)
        i += chunk_size
        
    return images, all_seeds



async def generate_images_multi_gpu_async(
    ckpt_path: str,
    positive_prompt_list: List[str],
    negative_prompt_list: List[str],
    seed_list: List[int],
    step: int = 30,
    cfg: float = 9.9,
    height: int = 768,
    width: int = 1280,
    max_chunk_size: int = 4,
) -> Tuple[List[Any], List[int]]:
    """여러 CUDA 디바이스를 사용하여 이미지를 병렬 생성합니다."""
    available_devices = get_available_cuda_devices()
    
    if not available_devices:
        # CUDA가 사용 불가능한 경우 CPU로 폴백
        print("CUDA 디바이스가 없습니다.")
        return
    
    if len(available_devices) == 1:
        # 단일 디바이스인 경우 기존 방식 사용
        return await asyncio.to_thread(
            generate_images_pony,
            ckpt_path, positive_prompt_list, negative_prompt_list,
            seed_list, step, cfg, height, width, available_devices[0], max_chunk_size
        )
    
    # 여러 디바이스로 분산 처리
    num_devices = len(available_devices)
    total_items = len(positive_prompt_list)
    optimal_chunk_size = get_optimal_chunk_size(total_items, num_devices)
    
    # 작업을 디바이스별로 분할
    tasks = []
    for i, device_id in enumerate(available_devices):
        start_idx = i * (total_items // num_devices)
        if i == num_devices - 1:
            # 마지막 디바이스는 남은 모든 작업 처리
            end_idx = total_items
        else:
            end_idx = (i + 1) * (total_items // num_devices)
        
        if start_idx >= end_idx:
            continue
            
        device_prompts = positive_prompt_list[start_idx:end_idx]
        device_negative_prompts = negative_prompt_list[start_idx:end_idx]
        device_seeds = seed_list[start_idx:end_idx]
        
        task = asyncio.to_thread(
            #generate_images_on_device,
            generate_images_pony,
            ckpt_path, device_prompts, device_negative_prompts,
            device_seeds, step, cfg, height, width, device_id, optimal_chunk_size
        )
        tasks.append(task)
    
    # 모든 디바이스에서 병렬 실행
    results = await asyncio.gather(*tasks)
    
    # 결과 합치기
    all_images = []
    all_seeds = []
    for images, seeds in results:
        all_images.extend(images)
        all_seeds.extend(seeds)
    
    return all_images, all_seeds


def clear_pipeline_cache() -> None:
    """캐시된 파이프라인을 제거하고 GPU 메모리를 정리합니다."""
    pipeline_funcs = [
        generate_images_pony
    ]
    for func in pipeline_funcs:
        for attr_name in list(getattr(func, "__dict__", {}).keys()):
            if attr_name.startswith("pipe_"):
                delattr(func, attr_name)

    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()