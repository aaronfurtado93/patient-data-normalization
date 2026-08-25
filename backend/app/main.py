"""Phase 01 scaffolding + Phase 02 Iteration 02: minimal runnable FastAPI app.

No normalization/reconciliation pipeline yet — that lands in a later Phase 02 iteration. This
iteration adds just enough to serve the raw sample bundle so the frontend's Download/Load Sample
File actions have something real to call.
"""

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="Centauri Clinical Snapshot API")

# Wide open for local dev scaffolding — no auth/multi-origin concerns per Assumptions.md scope.
# Revisit if this ever leaves localhost.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# backend/app/main.py -> parent.parent is the container's /app WORKDIR, where docker-compose
# bind-mounts the repo's inputdata/ read-only (see docker-compose.yml). Only valid when run via
# Docker Compose, per Assumptions.md's "docker compose is the run method" decision.
SAMPLE_BUNDLE_PATH = Path(__file__).resolve().parent.parent / "inputdata" / "scenario1_fhir_bundle[78].json"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/sample-bundle")
def get_sample_bundle() -> JSONResponse:
    """Returns the static sample FHIR bundle as-is — no parsing/normalization applied.

    Backs both the frontend's "Download Sample File" (saved as a file client-side) and
    "Load Sample File" (kept in frontend state) actions from a single source of truth.
    """
    if not SAMPLE_BUNDLE_PATH.exists():
        raise HTTPException(status_code=404, detail="Sample bundle not found on the server.")

    with SAMPLE_BUNDLE_PATH.open("r", encoding="utf-8") as f:
        bundle = json.load(f)

    return JSONResponse(content=bundle)
