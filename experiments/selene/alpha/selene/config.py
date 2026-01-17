"""
Configuration module for Selene Agent.
Loads environment variables and provides validated configuration.
"""
import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Application configuration with validation."""
    
    # API Configuration
    MISTRAL_API_KEY: str = os.getenv("MISTRAL_API_KEY", "")
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "mistral-small-latest")
    
    # Model Parameters
    TEMPERATURE: float = float(os.getenv("TEMPERATURE", "1.0"))
    TOP_P: float = float(os.getenv("TOP_P", "1.0"))
    MAX_RETRIES: int = int(os.getenv("MAX_RETRIES", "2"))
    TIMEOUT_SECONDS: int = int(os.getenv("TIMEOUT_SECONDS", "30"))
    EXTENDED_TIMEOUT_SECONDS: int = int(os.getenv("EXTENDED_TIMEOUT_SECONDS", "40"))
    
    # Processing Configuration
    PROMPT_DELAY_SECONDS: int = int(os.getenv("PROMPT_DELAY_SECONDS", "1"))
    
    # Output Configuration
    DEFAULT_OUTPUT_FILE: str = os.getenv("DEFAULT_OUTPUT_FILE", "responses.csv")
    
    @classmethod
    def validate(cls) -> bool:
        """Validate required configuration values."""
        if not cls.MISTRAL_API_KEY:
            raise ValueError("MISTRAL_API_KEY is required but not set")
        return True


# Validate configuration on import
Config.validate()