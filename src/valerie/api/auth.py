from fastapi import HTTPException, Security, Depends
from fastapi.security.api_key import APIKeyHeader
from passlib.context import CryptContext
from valerie.db.engine import AsyncSession
from valerie.db.models import ApiKey
from sqlmodel import select
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)

MASTER_KEY = os.getenv("VALERIE_MASTER_KEY", "default-dev-key")

async def require_api_key(x_api_key: str = Security(api_key_header)):
    if x_api_key == MASTER_KEY:
        return {"id": "master", "label": "Master Key"}
    
    async with AsyncSession() as session:
        statement = select(ApiKey)
        keys = await session.execute(statement)
        for key in keys.scalars().all():
            if pwd_context.verify(x_api_key, key.key_hash) and key.is_active:
                return key
    
    raise HTTPException(status_code=403, detail="Invalid API Key")
