import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    db_url: str = os.getenv("IMAGENE_DB_URL", "") if os.getenv("IMAGENE_DB_URL", "") else "sqlite:///./../../db.sqlite3"
    app_base_url: str = os.getenv("APP_BASE_URL", "http://localhost:5173")
    sd_model_path: str = os.getenv("STABLE_DIFFUSION_MODEL_PATH", "models/stable-diffusion-v1-5")
    sd_max_chunk_size: int = int(os.getenv("STABLE_DIFFUSION_MAX_CHUNK_SIZE", 4))
settings = Settings()

print("db_url: ", settings.db_url)
print("app_base_url: ", settings.app_base_url)
print("sd_model_path: ", settings.sd_model_path)
print("max_chunk_size: ", settings.sd_max_chunk_size)