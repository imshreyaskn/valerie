from fastapi import APIRouter, Depends
from valerie.api.auth import require_api_key
import pandas as pd
from valerie.graph.nodes import DOMAIN_FILES

router = APIRouter(prefix="/domains", tags=["Domains"])

@router.get("/")
async def get_domains(user = Depends(require_api_key)):
    domains = []
    for domain_id, filename in DOMAIN_FILES.items():
        try:
            df = pd.read_csv(f"resources/{filename}")
            harm_types = df.groupby("harm_type").size().reset_index(name="prompt_count")
            domains.append({
                "id": domain_id,
                "label": domain_id.capitalize(),
                "harm_types": harm_types.to_dict("records")
            })
        except Exception:
            continue
    return {"domains": domains}
