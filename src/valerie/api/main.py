from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from valerie.api.routers import validate, domains, attacks, runs, results

app = FastAPI(title="Valerie Red Team API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(validate.router)
app.include_router(domains.router)
app.include_router(attacks.router)
app.include_router(runs.router)
app.include_router(results.router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
