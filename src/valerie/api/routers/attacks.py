from fastapi import APIRouter, Depends
from valerie.api.auth import require_api_key
from valerie.attacks.techniques import TECHNIQUES

router = APIRouter(prefix="/attacks", tags=["Attacks"])

@router.get("/techniques")
async def get_techniques(user = Depends(require_api_key)):
    return {
        "techniques": [t.dict() for t in TECHNIQUES.values()]
    }
