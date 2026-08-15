from functools import lru_cache
from fastapi import APIRouter, Depends
from valerie.api.auth import require_api_key
import pandas as pd
import os
from valerie.graph.nodes import DOMAIN_FILES

router = APIRouter(prefix="/domains", tags=["Domains"])

@lru_cache(maxsize=1)
def _load_cached_domains() -> list[dict]:
    domains = []
    for domain_id, filename in DOMAIN_FILES.items():
        filepath = os.path.join("resources", filename)
        if not os.path.exists(filepath):
            continue
        try:
            df = pd.read_csv(filepath)
            if "harm_type" in df.columns:
                harm_types = df.groupby("harm_type").size().reset_index(name="prompt_count")
                records = harm_types.to_dict("records")
            else:
                records = []
            domains.append({
                "id": domain_id,
                "label": domain_id.capitalize(),
                "harm_types": records
            })
        except Exception:
            continue
    return domains

@router.get("/")
async def get_domains(user = Depends(require_api_key)):
    return {"domains": _load_cached_domains()}

