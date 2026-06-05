import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://valerie:localdev@localhost:5432/valerie_db")

# Detect Supabase pooled connection (port 6543 = transaction mode via Supavisor)
# Transaction mode requires NullPool + disabled prepared statement cache
_is_supabase_pooled = ":6543/" in DATABASE_URL

if _is_supabase_pooled:
    # Supabase transaction mode: let Supavisor manage the pool
    engine = create_async_engine(
        DATABASE_URL,
        poolclass=NullPool,
        connect_args={
            "statement_cache_size": 0,          # prevent DuplicatePreparedStatementError
            "prepared_statement_cache_size": 0,
        },
    )
else:
    # Direct connection (local Postgres / Supabase port 5432 session mode)
    engine = create_async_engine(
        DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )

AsyncSession = async_sessionmaker(engine, expire_on_commit=False)
