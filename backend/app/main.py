"""Phase 01 scaffolding: minimal runnable FastAPI app.

No normalization/reconciliation logic yet — that lands in Phase 02. This just proves the service
boots, is reachable, and the frontend can talk to it.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Centauri Clinical Snapshot API")

# Wide open for local dev scaffolding — no auth/multi-origin concerns per Assumptions.md scope.
# Revisit if this ever leaves localhost.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
