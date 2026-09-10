"""
Configuration settings for NAVEX Trading AI.
Supports environment variable overrides, multi-provider LLM settings,
risk parameters, and paper trading constants.
"""

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATABASE_PATH = BASE_DIR / "navex_memory.db"

# Load environment variables if .env exists
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(env_path)


class Settings(BaseModel):
    # Application
    APP_NAME: str = "NAVEX Trading AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))

    # LLM Settings (Configurable: gemini | openai | anthropic | demo)
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-flash-latest")
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.2"))
    LLM_TIMEOUT_SECONDS: int = int(os.getenv("LLM_TIMEOUT_SECONDS", "30"))

    # Public market/news providers. Keys stay server-side and are never sent to the browser.
    MARKET_DATA_PROVIDER: str = os.getenv("MARKET_DATA_PROVIDER", "binance")
    NEWS_PROVIDER: str = os.getenv("NEWS_PROVIDER", "auto")
    CRYPTOPANIC_API_KEY: Optional[str] = os.getenv("CRYPTOPANIC_API_KEY")
    NEWSAPI_KEY: Optional[str] = os.getenv("NEWSAPI_KEY")
    FINNHUB_API_KEY: Optional[str] = os.getenv("FINNHUB_API_KEY")
    ALPHAVANTAGE_API_KEY: Optional[str] = os.getenv("ALPHAVANTAGE_API_KEY")
    TWELVEDATA_API_KEY: Optional[str] = os.getenv("TWELVEDATA_API_KEY")
    MARKET_DATA_TIMEOUT_SECONDS: int = int(os.getenv("MARKET_DATA_TIMEOUT_SECONDS", "4"))

    # Risk Engine Guardrails
    INITIAL_CAPITAL: float = float(os.getenv("INITIAL_CAPITAL", "100000.0"))
    MAX_RISK_PER_TRADE_PCT: float = float(os.getenv("MAX_RISK_PER_TRADE_PCT", "0.01"))  # 1% max account risk
    MIN_RISK_REWARD_RATIO: float = float(os.getenv("MIN_RISK_REWARD_RATIO", "1.5"))     # Minimum 1.5:1 R:R
    MAX_LEVERAGE: float = float(os.getenv("MAX_LEVERAGE", "2.0"))                       # Maximum 2x account equity in notional exposure
    MIN_STOP_DISTANCE_PCT: float = float(os.getenv("MIN_STOP_DISTANCE_PCT", "0.003"))  # 0.3% minimum distance from entry
    MAX_STOP_DISTANCE_PCT: float = float(os.getenv("MAX_STOP_DISTANCE_PCT", "0.08"))   # 8% maximum distance from entry

    # Execution Simulation Parameters
    TAKER_FEE_RATE: float = float(os.getenv("TAKER_FEE_RATE", "0.0005"))        # 0.05% taker fee
    DEFAULT_SLIPPAGE_RATE: float = float(os.getenv("DEFAULT_SLIPPAGE_RATE", "0.0002")) # 0.02% base slippage
    DEFAULT_ASSET: str = os.getenv("DEFAULT_ASSET", "BTC/USDT")

    # Database
    DATABASE_PATH: str = str(DATABASE_PATH)


settings = Settings()
