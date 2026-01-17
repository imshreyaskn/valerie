"""
Configuration System Test
==========================

Run this to verify your configuration is working correctly.

Usage:
    python test_config.py
"""

from valerie.config import settings


def test_configuration():
    """Comprehensive configuration validation"""
    
    print("=" * 80)
    print("VALERIE CONFIGURATION TEST")
    print("=" * 80)
    
    # Application Settings
    print("\n[Application]")
    print(f"  Name:        {settings.app_name}")
    print(f"  Environment: {settings.environment}")
    print(f"  Debug Mode:  {settings.debug}")
    print(f"  Log Level:   {settings.log_level}")
    
    # API Settings
    print("\n[API Server]")
    print(f"  Host: {settings.api_host}")
    print(f"  Port: {settings.api_port}")
    print(f"  URL:  http://{settings.api_host}:{settings.api_port}")
    
    # AWS Bedrock
    print("\n[AWS Bedrock]")
    print(f"  Region:          {settings.aws.region}")
    print(f"  Access Key ID:   {settings.aws.access_key_id[:8]}********")
    print(f"  Attacker Model:  {settings.aws.attacker_model_id}")
    print(f"  Judge Model:     {settings.aws.judge_model_id}")
    print(f"  Max Tokens:      {settings.aws.max_tokens}")
    print(f"  Temperature:     {settings.aws.temperature}")
    
    # Database
    print("\n[PostgreSQL]")
    print(f"  Host:     {settings.database.host}")
    print(f"  Port:     {settings.database.port}")
    print(f"  Database: {settings.database.database}")
    print(f"  User:     {settings.database.user}")
    print(f"  Pool:     {settings.database.pool_size}")
    print(f"  Overflow: {settings.database.max_overflow}")
    print(f"  URL:      {settings.database.connection_url[:40]}...")
    
    # Timeouts
    print("\n[LLM Operations]")
    print(f"  Timeout (seconds):      {settings.llm_timeout_seconds}")
    print(f"  Max Attack Iterations:  {settings.attack_max_iterations}")
    
    # Environment Checks
    print("\n[Environment Checks]")
    print(f"  Is Production:  {settings.is_production()}")
    print(f"  Is Development: {settings.is_development()}")
    
    print("\n" + "=" * 80)
    print("✓ Configuration is valid and loaded successfully!")
    print("=" * 80)


if __name__ == "__main__":
    try:
        test_configuration()
    except Exception as e:
        print(f"\n✗ Configuration test failed: {e}")
        raise
