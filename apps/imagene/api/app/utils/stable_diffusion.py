import random, gc, torch
from io import BytesIO
import asyncio
from typing import Optional, List, Any
from diffusers import StableDiffusionXLPipeline

_generation_lock = asyncio.Semaphore(1)

def generate_images_batch(
    ckpt_path: str,
    positive_prompt_list: List[str],
    negative_prompt_list: List[str],
    step : int,
    cfg : float,
    height : int,
    width : int,
    max_chunk_size: int = 4,
):
    print(ckpt_path)
    if not hasattr(generate_images_batch, "pipe"):
        generate_images_batch.pipe = StableDiffusionXLPipeline.from_single_file(
            ckpt_path,
            torch_dtype=torch.float16,  # 메모리 여유 없으면 fp16 권장
            use_safetensors=True,
            # device_map="auto",
        )
        generate_images_batch.pipe.to("cuda")
        generate_images_batch.pipe.enable_attention_slicing()
        generate_images_batch.pipe.enable_vae_slicing()
        # generate_images_batch.pipe.enable_sequential_cpu_offload()

    images: List[Any] = []
    i = 0
    while i < len(positive_prompt_list):
        chunk_size = min(max_chunk_size, len(positive_prompt_list) - i)
        positive_prompt_chunk = positive_prompt_list[i:i+chunk_size]
        negative_prompt_chunk = negative_prompt_list[i:i+chunk_size]
        generators_chunk = [torch.Generator(device="cuda").manual_seed(random.randint(0, 1_000_000)) for _ in range(chunk_size)]
        torch.cuda.empty_cache()
        gc.collect()
        images.extend(generate_images_batch.pipe(
            prompt=positive_prompt_chunk,
            negative_prompt=negative_prompt_chunk,
            num_inference_steps=step,
            guidance_scale=cfg,
            height=height,
            width=width,
            generator=generators_chunk,
        ).images)
        i += chunk_size
    
    return images