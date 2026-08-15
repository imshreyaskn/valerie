from fastapi import APIRouter, Depends
from valerie.llm.validator import validate_endpoint, ValidationResult
from valerie.api.auth import require_api_key
from pydantic import BaseModel, Field

router = APIRouter(prefix="/validate", tags=["Validation"])

class ValidateRequest(BaseModel):
    model: str = Field(..., min_length=1, max_length=128, description="Target model identifier")
    api_key: str | None = Field(default=None, max_length=512, description="API Key")
    api_base: str | None = Field(default=None, max_length=2048, description="Target API Base URL")


@router.post("/endpoint", response_model=ValidationResult)
async def validate_model_endpoint(request: ValidateRequest, user = Depends(require_api_key)):
    return await validate_endpoint(
        model=request.model,
        api_key=request.api_key,
        api_base=request.api_base
    )

