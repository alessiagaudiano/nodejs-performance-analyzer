import asyncio

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.config import db_settings

engine: AsyncEngine | None = None
SessionLocal: async_sessionmaker[AsyncSession] | None = None
_engine_loop: asyncio.AbstractEventLoop | None = None


def _get_running_loop() -> asyncio.AbstractEventLoop | None:
    try:
        return asyncio.get_running_loop()
    except RuntimeError:
        return None


def init_engine():
    """Initialize global async engine/sessionmaker for Postgres."""
    global engine, SessionLocal, _engine_loop
    current_loop = _get_running_loop()
    if engine is not None and current_loop is not None:
        if _engine_loop is None:
            _engine_loop = current_loop
        elif _engine_loop is not current_loop:
            # Avoid cross-loop asyncpg usage (common in pytest when loops change).
            engine = None
            SessionLocal = None
            _engine_loop = None
    if engine is None:
        connect_args = {}
        if getattr(db_settings, "POSTGRES_REQUIRE_SSL", False):
            try:
                import ssl
                connect_args["ssl"] = ssl.create_default_context()
            except Exception:
                # Fallback to boolean; asyncpg treats True similar to 'require'
                connect_args["ssl"] = True

        engine = create_async_engine(
            db_settings.POSTGRES_ASYNC_URL,
            echo=False,
            connect_args=connect_args,
        )
        SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
        _engine_loop = current_loop


async def get_session() -> AsyncSession:
    """FastAPI dependency that yields an AsyncSession."""
    if SessionLocal is None:
        init_engine()
    assert SessionLocal is not None
    async with SessionLocal() as session:
        yield session
