"""GET /sample-bundle — serves the static sample FHIR bundle verbatim."""

import json
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.errors import NotFoundError

router = APIRouter(tags=["sample-bundle"])

# backend/app/routers/sample_bundle.py -> parents[2] is the container's /app WORKDIR, where
# docker-compose bind-mounts the repo's inputdata/ read-only (see docker-compose.yml). Only valid
# when run via Docker Compose, per Assumptions.md's "docker compose is the run method" decision.
SAMPLE_BUNDLE_PATH = Path(__file__).resolve().parents[2] / "inputdata" / "scenario1_fhir_bundle[78].json"


@router.get("/sample-bundle")
def get_sample_bundle() -> JSONResponse:
    """Returns the static sample FHIR bundle as-is — no parsing/normalization applied.

    Backs both the frontend's "Download Sample File" (saved as a file client-side) and
    "Load Sample File" (kept in frontend state) actions from a single source of truth.
    """
    if not SAMPLE_BUNDLE_PATH.exists():
        raise NotFoundError("Sample bundle not found on the server.")

    with SAMPLE_BUNDLE_PATH.open("r", encoding="utf-8") as f:
        bundle = json.load(f)

    return JSONResponse(content=bundle)
