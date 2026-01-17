"""
Configuration Package
=====================

Exports the global settings instance and config classes.

Usage:
    from valerie.config import settings
    
    # Access nested config
    print(settings.aws.region)
    print(settings.database.connection_url)
    
    # Check environment
    if settings.is_production():
        # Production-specific logic
        pass
"""

from .settings import settings, Settings, AWSConfig, DatabaseConfig

__all__ = ["settings", "Settings", "AWSConfig", "DatabaseConfig"]