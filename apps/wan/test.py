from pathlib import Path
from wan_lightning.wan_api import prepare_dual_noise_ckpt_dir, run_i2v

#from transformers import logging
#logging.set_verbosity_error()

# Civitai에서 받은 safetensors (예: high_noise_fp16, low_noise_fp16)
HIGH = Path(r"~/ai/wan/high_noise_model/wanVideo22_i2vHighNoise14BFp8Sd.safetensors")
LOW  = Path(r"~/ai/wan/low_noise_model/wanVideo22_i2vLowNoise14BFp16.safetensors")

# 듀얼 노이즈 ckpt_dir 준비
CKPT = prepare_dual_noise_ckpt_dir(
    model_root=Path(r"~/ai/wan"),
    high_noise_safetensors=HIGH,
    low_noise_safetensors=LOW,
    use_symlink=False,  # Windows는 보통 False 권장
)

# I2V 실행
run_i2v(
    ckpt_dir=CKPT,
    image_path=Path(r"./sample.jpg"),
    prompt="2D anime style, clean lineart, fixed camera, same background, full body, walking forward slowly, natural motion",
    save_dir=Path(r"./"),
    size="1280*720",
    frame_num=81,      # 81프레임이면 12fps 기준 약 6.7초, 16fps 기준 약 5.0초
    seed=1234,
    offload_model=True,
    sample_steps=26,
    guide_scale=5.5,
)