"""Bundle envelope + the registry tying resourceType strings to their model.

Two ways to use resource typing in this codebase, on purpose:
- `RESOURCE_MODELS` — a plain dict, used by the `/validate` endpoint to validate each entry
  individually (`RESOURCE_MODELS[resource_type].model_validate(...)`) so one malformed entry
  doesn't prevent reporting on the rest of the bundle.
- `Bundle` (with its discriminated-union `AnyResource` entries) — the canonical typed shape of a
  whole bundle, for anywhere that wants "just give me a validated Bundle or raise," where an
  all-or-nothing validation is the right behavior.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field

from app.models.allergy_intolerance import AllergyIntolerance
from app.models.condition import Condition
from app.models.encounter import Encounter
from app.models.medication_request import MedicationRequest
from app.models.observation import Observation
from app.models.patient import Patient

# Every resource type this project models, keyed by FHIR `resourceType`. Extend here (and add the
# corresponding module) when a new resource type needs support — this list matches the bundle's
# actual contents exactly, see implementation-logs/Knowledge.md.
RESOURCE_MODELS: dict[str, type[BaseModel]] = {
    "Patient": Patient,
    "Encounter": Encounter,
    "Condition": Condition,
    "Observation": Observation,
    "MedicationRequest": MedicationRequest,
    "AllergyIntolerance": AllergyIntolerance,
}

AnyResource = Annotated[
    Union[Patient, Encounter, Condition, Observation, MedicationRequest, AllergyIntolerance],
    Field(discriminator="resourceType"),
]


class BundleEntry(BaseModel):
    fullUrl: str | None = None
    resource: AnyResource


class Bundle(BaseModel):
    resourceType: Literal["Bundle"] = "Bundle"
    id: str | None = None
    type: str | None = None
    timestamp: str | None = None
    total: int | None = None
    entry: list[BundleEntry] = Field(default_factory=list)
