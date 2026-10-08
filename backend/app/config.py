# -*- coding: utf-8 -*-
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"

    daily_budget_cny: float = 10.0
    rate_limit_per_ip_per_min: int = 20
    session_token_daily_cap: int = 50000
    llm_concurrency: int = 3
    llm_timeout_sec: int = 60

    db_path: str = "./data/cvbot.db"
    facts_path: str = "./facts/facts.yaml"

    feishu_webhook_url: str = ""
    frontend_origin: str = "http://localhost:5173"

    admin_token: str = "changeme"

settings = Settings()
