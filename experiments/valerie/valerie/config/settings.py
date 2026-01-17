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
    
    access_key_id: str = Field(
        ...,  # ... means REQUIRED, no default
        description="AWS Access Key ID",
        alias="AWS_ACCESS_KEY_ID"  # Maps to env var name
    )
    
    secret_access_key: str = Field(
        ...,
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


class DatabaseConfig(BaseSettings):
    """
    PostgreSQL Configuration
    
    Why split from main config?
    - Database is a separate infrastructure concern
    - Makes testing easier (can mock just DB config)
    - Clear ownership of connection parameters
    """
    
    host: str = Field(
        default="localhost",
        description="PostgreSQL host"
    )
    
    port: int = Field(
        default=5432,
        gt=0,
        lt=65536,
        description="PostgreSQL port"
    )
    
    database: str = Field(
        ...,
        description="Database name",
        alias="POSTGRES_DB"
    )
    
    user: str = Field(
        ...,
        description="Database user",
        alias="POSTGRES_USER"
    )
    
    password: str = Field(
        ...,
        description="Database password",
        alias="POSTGRES_PASSWORD"
    )
    
    pool_size: int = Field(
        default=5,
        gt=0,
        description="Connection pool size"
    )
    
    max_overflow: int = Field(
        default=10,
        gt=0,
        description="Max connections beyond pool_size"
    )
    
    @property
    def connection_url(self) -> str:
        """
        Construct SQLAlchemy connection URL
        
        Why a property?
        - Derived value, not stored config
        - Auto-updates if components change
        - Single source of truth for URL format
        """
        return (
            f"postgresql://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.database}"
        )
    
    @property
    def async_connection_url(self) -> str:
        """Async driver URL for asyncpg"""
        return (
            f"postgresql+asyncpg://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.database}"
        )


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
        env_nested_delimiter="__"
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
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    
    @field_validator('environment')
    @classmethod
    def validate_environment(cls, v: str) -> str:
        """Production safety check"""
        if v == "production":
            # In production, we might want additional checks
            print("WARNING: Running in PRODUCTION mode")
        return v
    
    def is_production(self) -> bool:
        """Helper method for environment checks"""
        return self.environment == "production"
    
    def is_development(self) -> bool:
        """Helper method for development features"""
        return self.environment == "development"


# Global Configuration Instance
# This is loaded ONCE at module import
try:
    settings = Settings()
    print(f"✓ Configuration loaded successfully for environment: {settings.environment}")
except ValidationError as e:
    print("=" * 80)
    print("FATAL CONFIGURATION ERROR")
    print("=" * 80)
    print("\nThe application cannot start due to invalid configuration:")
    print(e)
    print("\nPlease check your .env file and ensure all required variables are set.")
    print("=" * 80)
    sys.exit(1)
except Exception as e:
    print("=" * 80)
    print("UNEXPECTED CONFIGURATION ERROR")
    print("=" * 80)
    print(f"\n{type(e).__name__}: {e}")
    sys.exit(1)


# Export only what's needed
__all__ = ["settings", "Settings", "AWSConfig", "DatabaseConfig"]
