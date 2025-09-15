import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    db_url: str = os.getenv("IMAGENE_DB_URL", "") if os.getenv("IMAGENE_DB_URL", "") else "sqlite:///./../../db.sqlite3"
    app_base_url: str = os.getenv("APP_BASE_URL", "http://localhost:5173")
settings = Settings()

print("db_url: ", settings.db_url)
print("app_base_url: ", settings.app_base_url)
