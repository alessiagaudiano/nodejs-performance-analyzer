

from pydantic_settings import BaseSettings, SettingsConfigDict


_base_config = SettingsConfigDict(
    env_file="./.env.docker",  # Prefer docker env file; environment variables take precedence.
    env_ignore_empty=True,
    extra="ignore",
)


class DatabaseSettings(BaseSettings):
    POSTGRES_DB: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_SERVER: str
    POSTGRES_PORT: int
    # When true, enforce SSL for Postgres connections.
    # For asyncpg this becomes `?ssl=true`; for psycopg2 it becomes `?sslmode=require`.
    POSTGRES_REQUIRE_SSL: bool = False

    model_config = _base_config

    @property
    def POSTGRES_ASYNC_URL(self):
        base = (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
        return base

    @property
    def POSTGRES_SYNC_URL(self):
        base = (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
        if self.POSTGRES_REQUIRE_SSL:
            sep = "&" if "?" in base else "?"
            base = f"{base}{sep}sslmode=require"
        return base




db_settings = DatabaseSettings()
