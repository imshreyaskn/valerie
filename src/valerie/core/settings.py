"""
Configuration Management for Valerie
=====================================

Design Principles Applied:
1. Fail-Fast: Invalid config crashes at import, not at runtime
2. Type Safety: Pydantic validates all types immediately
3. Single Source of Truth: All config flows through this module
4. Environment Isolation: Easy dev/staging/prod separation

Architecture Notes:
- BaseSettings automatically reads from environment variables
- Field(...) marks required fields (no defaults)
- validator decorators enforce business rules
- Nested models provide logical grouping
"""

from pydantic import Field, field_validator, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal
import sys
import logging

logger = logging.getLogger("core.settings")


class AWSConfig(BaseSettings):
    """
    AWS Bedrock Configuration
    
    Why separate class?
    - Separation of Concerns: AWS config is a distinct domain
    - Reusability: Can be imported independently
    - Clarity: Clear namespace (aws_config.region vs config.aws_region)
    """
    
    region: str = Field(
        default="us-east-1",
        description="AWS region for Bedrock API calls"
    )
    
    access_key_id: str | None = Field(
        default=None,
        description="AWS Access Key ID",
        alias="AWS_ACCESS_KEY_ID"  # Maps to env var name
    )
    
    secret_access_key: str | None = Field(
        default=None,
        description="AWS Secret Access Key",
        alias="AWS_SECRET_ACCESS_KEY"
    )
    
    # Model Configuration
    attacker_model_id: str = Field(
        default="anthropic.claude-3-5-sonnet-20241022-v2:0",
        description="Bedrock model ID for Attacker agent"
    )
    
    judge_model_id: str = Field(
        default="anthropic.claude-3-5-sonnet-20241022-v2:0",
        description="Bedrock model ID for Judge agent"
    )
    
    max_tokens: int = Field(
        default=4096,
        gt=0,  # Greater than 0
        le=8192,  # Less than or equal to 8192
        description="Maximum tokens per model call"
    )
    
    temperature: float = Field(
        default=0.7,
        ge=0.0,  # Greater than or equal
        le=1.0,
        description="Model temperature for creativity"
    )
    
    @field_validator('region')
    @classmethod
    def validate_region(cls, v: str) -> str:
        """Fail-fast: Ensure region format is valid"""
        valid_regions = [
            'us-east-1', 'us-west-2', 'eu-west-1', 
            'eu-central-1', 'ap-southeast-1', 'ap-northeast-1'
        ]
        if v not in valid_regions:
            raise ValueError(
                f"Invalid AWS region: {v}. Must be one of {valid_regions}"
            )
        return v


class MistralConfig(BaseSettings):
    """
    Mistral AI Configuration
    """
    api_key: str | None = Field(
        default=None,
        description="Mistral API Key",
        alias="MISTRAL_API_KEY"
    )
    
    default_model: str = Field(
        default="mistral-small-latest",
        description="Default Mistral model ID",
        alias="DEFAULT_MODEL"
    )
    
    temperature: float = Field(default=1.0)
    top_p: float = Field(default=1.0)
    max_retries: int = Field(default=2)
    timeout: int = Field(default=30)
    extended_timeout: int = Field(default=40)
    prompt_delay: int = Field(default=1)


class DatabaseConfig(BaseSettings):
    """
    MongoDB Configuration
    """
    uri: str | None = Field(default=None, alias="MONGO_URI")
    host: str = Field(default="localhost", alias="MONGO_HOST")
    port: int = Field(default=27017, alias="MONGO_PORT")
    username: str | None = Field(default="valerie", alias="MONGO_USER")
    password: str | None = Field(default="localdev", alias="MONGO_PASSWORD")
    database: str = Field(default="valerie_db", alias="MONGO_DB")
    
    @property
    def connection_url(self) -> str:
        if self.uri:
            return self.uri
        if self.username and self.password:
            return f"mongodb://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}?authSource=admin"
        return f"mongodb://{self.host}:{self.port}/{self.database}"


class RedisConfig(BaseSettings):
    """
    Redis Configuration for Event Bus (Streams) and Pub/Sub
    """
    uri: str | None = Field(default=None, alias="REDIS_URI")
    host: str = Field(default="localhost", alias="REDIS_HOST")
    port: int = Field(default=6379, alias="REDIS_PORT")
    password: str | None = Field(default=None, alias="REDIS_PASSWORD")
    db: int = Field(default=0, alias="REDIS_DB")
    
    @property
    def url(self) -> str:
        if self.uri:
            return self.uri
        if self.password:
            return f"redis://:{self.password}@{self.host}:{self.port}/{self.db}"
        return f"redis://{self.host}:{self.port}/{self.db}"

class Settings(BaseSettings):
    """
    Master Configuration Object
    
    This is the ONLY config object the application imports.
    
    Design Pattern: Facade
    - Provides single interface to all config subsystems
    - Hides complexity of nested configs
    - Makes dependency injection trivial
    """
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        # Nested models read from prefixed env vars
        # e.g., AWS_REGION, DATABASE_HOST
        env_nested_delimiter="__",
        extra="ignore",
        populate_by_name=True
    )
    
    # Application Metadata
    app_name: str = Field(
        default="Valerie",
        description="Application name"
    )
    
    environment: Literal["development", "staging", "production"] = Field(
        default="development",
        description="Deployment environment"
    )
    
    debug: bool = Field(
        default=False,
        description="Debug mode flag"
    )
    
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO",
        description="Logging verbosity"
    )
    
    # API Configuration
    api_host: str = Field(
        default="0.0.0.0",
        description="API server host"
    )
    
    api_port: int = Field(
        default=8000,
        gt=0,
        lt=65536,
        description="API server port"
    )

    master_key: str = Field(
        ...,
        alias="VALERIE_MASTER_KEY",
        description="Master API key for administrative access. REQUIRED in production."
    )

    jwt_secret_key: str = Field(
        ...,
        alias="JWT_SECRET_KEY",
        description="Secret key for signing JWT tokens. REQUIRED in production."
    )

    worker_secret: str = Field(
        ...,
        alias="WORKER_SECRET",
        description="Shared secret for API to Worker communication. REQUIRED in production."
    )

    allowed_origins: list[str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
        alias="ALLOWED_ORIGINS",
        description="Allowed CORS origins"
    )
    
    # Timeout Configuration (Critical for LLM calls)
    llm_timeout_seconds: int = Field(
        default=300,  # 5 minutes
        gt=0,
        description="Maximum time for LLM API calls"
    )
    
    attack_max_iterations: int = Field(
        default=5,
        gt=0,
        le=20,
        description="Maximum attack refinement iterations"
    )
    
    # Nested Configurations
    aws: AWSConfig = Field(default_factory=AWSConfig)
    mistral: MistralConfig = Field(default_factory=MistralConfig)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    redis: RedisConfig = Field(default_factory=RedisConfig)
    
    @field_validator('master_key', 'jwt_secret_key', 'worker_secret')
    @classmethod
    def validate_secrets_not_default(cls, v: str, info) -> str:
        """Fail-fast: Reject default/dev secrets in any environment"""
        default_secrets = [
            "valerie_dev_master_key_change_in_prod",
            "valerie_dev_worker_secret",
        ]
        if v in default_secrets:
            raise ValueError(
                f"Default secret detected for {info.field_name}. "
                "You MUST set explicit secrets via environment variables. "
                "Never use default values in any deployment."
            )
        if len(v) < 32:
            raise ValueError(
                f"Secret {info.field_name} is too short (min 32 chars). "
                "Use a cryptographically secure random value."
            )
        return v

    @field_validator('environment')
    @classmethod
    def validate_environment(cls, v: str) -> str:
        """Production safety check"""
        if v == "production":
            logger.warning("WARNING: Running in PRODUCTION mode - ensure all secrets are configured")
        return v
    
    def is_production(self) -> bool:
        """Helper method for environment checks"""
        return self.environment == "production"
    
    def is_development(self) -> bool:
        """Helper method for development features"""
        return self.environment == "development"


class ConfigurationError(ValueError):
    """Raised when configuration validation fails."""
    pass


# Global Configuration Instance with fail-safe initialization
try:
    settings = Settings()
except ValidationError as e:
    # In test environments or when explicitly caught, do not hard exit the entire process
    logger_msg = f"Valerie configuration validation error: {e}"
    raise ConfigurationError(logger_msg) from e
except Exception as e:
    raise ConfigurationError(f"Unexpected configuration error: {e}") from e


# Export only what's needed
__all__ = ["settings", "Settings", "AWSConfig", "DatabaseConfig", "RedisConfig", "MistralConfig", "ConfigurationError"]
