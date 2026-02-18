"""
Centralized Configuration for Video Memory AI
Environment validation and configuration management
"""

import os
import sys
import secrets
from dataclasses import dataclass, field
from typing import Optional, List
from pathlib import Path


@dataclass
class DatabaseConfig:
    """Database configuration"""
    url: str = field(default_factory=lambda: os.getenv(
        "DATABASE_URL", "sqlite:///./data/video_memory.db"
    ))


@dataclass
class AuthConfig:
    """Authentication configuration"""
    secret_key: str = field(default_factory=lambda: os.getenv(
        "JWT_SECRET_KEY", "CHANGE_ME_IN_PRODUCTION"
    ))
    algorithm: str = "HS256"
    access_token_expire_hours: int = 24

    def validate(self) -> List[str]:
        """Validate auth configuration, return list of warnings/errors"""
        warnings = []
        if self.secret_key == "CHANGE_ME_IN_PRODUCTION":
            warnings.append(
                "WARNING: Using default JWT_SECRET_KEY. "
                "Set JWT_SECRET_KEY environment variable in production!"
            )
        if len(self.secret_key) < 32:
            warnings.append(
                "WARNING: JWT_SECRET_KEY should be at least 32 characters for security."
            )
        return warnings


@dataclass
class StripeConfig:
    """Stripe billing configuration"""
    secret_key: Optional[str] = field(default_factory=lambda: os.getenv("STRIPE_SECRET_KEY"))
    webhook_secret: Optional[str] = field(default_factory=lambda: os.getenv("STRIPE_WEBHOOK_SECRET"))
    price_id_starter_monthly: Optional[str] = field(default_factory=lambda: os.getenv("STRIPE_PRICE_STARTER_MONTHLY"))
    price_id_starter_yearly: Optional[str] = field(default_factory=lambda: os.getenv("STRIPE_PRICE_STARTER_YEARLY"))
    price_id_pro_monthly: Optional[str] = field(default_factory=lambda: os.getenv("STRIPE_PRICE_PRO_MONTHLY"))
    price_id_pro_yearly: Optional[str] = field(default_factory=lambda: os.getenv("STRIPE_PRICE_PRO_YEARLY"))
    price_id_team_monthly: Optional[str] = field(default_factory=lambda: os.getenv("STRIPE_PRICE_TEAM_MONTHLY"))
    price_id_team_yearly: Optional[str] = field(default_factory=lambda: os.getenv("STRIPE_PRICE_TEAM_YEARLY"))
    price_id_education_monthly: Optional[str] = field(default_factory=lambda: os.getenv("STRIPE_PRICE_EDUCATION_MONTHLY"))
    price_id_education_yearly: Optional[str] = field(default_factory=lambda: os.getenv("STRIPE_PRICE_EDUCATION_YEARLY"))

    @property
    def is_configured(self) -> bool:
        """Check if Stripe is properly configured"""
        return bool(self.secret_key)

    def validate(self) -> List[str]:
        """Validate Stripe configuration, return list of warnings"""
        warnings = []
        if not self.secret_key:
            warnings.append(
                "INFO: STRIPE_SECRET_KEY not set. Billing features will be disabled."
            )
        elif not self.webhook_secret:
            warnings.append(
                "WARNING: STRIPE_WEBHOOK_SECRET not set. Webhook verification disabled."
            )
        return warnings


@dataclass
class OpenAIConfig:
    """OpenAI API configuration"""
    api_key: Optional[str] = field(default_factory=lambda: os.getenv("OPENAI_API_KEY"))

    @property
    def is_configured(self) -> bool:
        """Check if OpenAI is properly configured"""
        return bool(self.api_key)

    def validate(self) -> List[str]:
        """Validate OpenAI configuration, return list of warnings"""
        warnings = []
        if not self.api_key:
            warnings.append(
                "WARNING: OPENAI_API_KEY not set. OpenAI features will fail. "
                "Set OPENAI_API_KEY environment variable or use Ollama provider."
            )
        return warnings


@dataclass
class CORSConfig:
    """CORS configuration"""
    allowed_origins: List[str] = field(default_factory=lambda: [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://localhost:5173,https://recipe-memory-ai.vercel.app"
        ).split(",")
        if origin.strip()
    ])


@dataclass
class RateLimitConfig:
    """Rate limiting configuration"""
    auth_requests_per_minute: int = field(
        default_factory=lambda: int(os.getenv("RATE_LIMIT_AUTH_RPM", "100"))
    )
    unauth_requests_per_minute: int = field(
        default_factory=lambda: int(os.getenv("RATE_LIMIT_UNAUTH_RPM", "20"))
    )
    video_processing_per_hour: int = field(
        default_factory=lambda: int(os.getenv("RATE_LIMIT_VIDEO_PER_HOUR", "10"))
    )


@dataclass
class RedisConfig:
    """Redis configuration for job queue and caching"""
    url: str = field(default_factory=lambda: os.getenv(
        "REDIS_URL", "redis://localhost:6379/0"
    ))
    job_queue_name: str = field(default_factory=lambda: os.getenv(
        "REDIS_QUEUE_NAME", "video_processing"
    ))
    
    @property
    def is_configured(self) -> bool:
        """Check if Redis is configured"""
        return bool(self.url and self.url != "redis://localhost:6379/0")


@dataclass
class VectorConfig:
    """Vector database configuration"""
    use_pgvector: bool = field(default_factory=lambda: os.getenv(
        "USE_PGVECTOR", "false"
    ).lower() == "true")
    embedding_model: str = field(default_factory=lambda: os.getenv(
        "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
    ))


@dataclass
class AppConfig:
    """Main application configuration"""
    debug: bool = field(default_factory=lambda: os.getenv("DEBUG", "false").lower() == "true")
    environment: str = field(default_factory=lambda: os.getenv("ENVIRONMENT", "development"))
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("DATA_DIR", "./data")))
    api_base_url: str = field(default_factory=lambda: os.getenv("API_BASE_URL", "").rstrip("/"))

    # Sub-configurations
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    auth: AuthConfig = field(default_factory=AuthConfig)
    stripe: StripeConfig = field(default_factory=StripeConfig)
    openai: OpenAIConfig = field(default_factory=OpenAIConfig)
    cors: CORSConfig = field(default_factory=CORSConfig)
    rate_limit: RateLimitConfig = field(default_factory=RateLimitConfig)
    redis: RedisConfig = field(default_factory=RedisConfig)
    vector: VectorConfig = field(default_factory=VectorConfig)

    def validate(self, strict: bool = False) -> bool:
        """
        Validate all configuration.

        Args:
            strict: If True, raise exception on warnings. If False, just print.

        Returns:
            True if configuration is valid
        """
        all_warnings = []

        # Collect all warnings
        all_warnings.extend(self.auth.validate())
        all_warnings.extend(self.stripe.validate())
        all_warnings.extend(self.openai.validate())

        # Print warnings
        for warning in all_warnings:
            print(f"[Config] {warning}", file=sys.stderr)

        # Check for critical errors in production
        if self.environment == "production":
            critical_errors = [w for w in all_warnings if w.startswith("WARNING")]
            if critical_errors and strict:
                raise ValueError(
                    f"Critical configuration errors in production: {critical_errors}"
                )

        return True

    def ensure_directories(self):
        """Ensure all required directories exist"""
        directories = [
            self.data_dir,
            self.data_dir / "videos",
            self.data_dir / "extracts",
            self.data_dir / "scripts",
            self.data_dir / "spun",
            self.data_dir / "memory",
        ]
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)


# Global configuration instance
_config: Optional[AppConfig] = None


def get_config() -> AppConfig:
    """Get or create the global configuration instance"""
    global _config
    if _config is None:
        _config = AppConfig()
    return _config


def init_config(validate: bool = True, strict: bool = False) -> AppConfig:
    """
    Initialize configuration with optional validation.

    Args:
        validate: Whether to validate configuration
        strict: Whether to raise on validation warnings

    Returns:
        AppConfig instance
    """
    config = get_config()

    if validate:
        config.validate(strict=strict)

    config.ensure_directories()

    return config


def generate_secret_key() -> str:
    """Generate a secure random secret key"""
    return secrets.token_urlsafe(32)


if __name__ == "__main__":
    # When run directly, validate configuration and print status
    print("Video Memory AI Configuration Check")
    print("=" * 50)

    config = init_config(validate=True, strict=False)

    print(f"\nEnvironment: {config.environment}")
    print(f"Debug Mode: {config.debug}")
    print(f"Data Directory: {config.data_dir}")
    print(f"Database: {config.database.url}")
    print(f"OpenAI Configured: {config.openai.is_configured}")
    print(f"Stripe Configured: {config.stripe.is_configured}")
    print(f"CORS Origins: {config.cors.allowed_origins}")

    print("\n" + "=" * 50)
    print("To generate a new secret key, run:")
    print(f"  JWT_SECRET_KEY={generate_secret_key()}")
