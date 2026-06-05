from fastapi import APIRouter, Depends
from valerie.llm.validator import validate_endpoint, ValidationResult
from valerie.api.auth import require_api_key
from pydantic import BaseModel

router = APIRouter(prefix="/validate", tags=["Validation"])

class ValidateRequest(BaseModel):
    model: str
    api_key: str | None = None
    api_base: str | None = None


@router.post("/endpoint", response_model=ValidationResult)
async def validate_model_endpoint(request: ValidateRequest, user = Depends(require_api_key)):
    return await validate_endpoint(
        model=request.model,
        api_key=request.api_key,
        api_base=request.api_base
    )
