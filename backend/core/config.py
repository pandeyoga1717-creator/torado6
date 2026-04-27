"""Centralized settings (loaded from env)."""
import os
from dataclasses import dataclass


@dataclass
class Settings:
    mongo_url: str = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name: str = os.environ.get("DB_NAME", "aurora_fnb")
    jwt_secret: str = os.environ.get("JWT_SECRET", "aurora-dev-secret-change-me")
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = int(os.environ.get("JWT_ACCESS_MINUTES", "1440"))
    refresh_token_days: int = int(os.environ.get("JWT_REFRESH_DAYS", "7"))
    bcrypt_cost: int = 12
    timezone: str = os.environ.get("TIMEZONE", "Asia/Jakarta")
    upload_dir: str = os.environ.get("UPLOAD_DIR", "/app/uploads")
    max_upload_mb: int = int(os.environ.get("MAX_UPLOAD_SIZE_MB", "10"))
    emergent_llm_key: str = os.environ.get("EMERGENT_LLM_KEY", "")
    feature_ai_enabled: bool = os.environ.get("FEATURE_AI_ENABLED", "true").lower() == "true"


settings = Settings()
