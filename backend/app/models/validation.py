"""Response shape for the /validate endpoint. Structural validation only this iteration — see
Iteration-03.md for scope."""

from __future__ import annotations

from pydantic import BaseModel


class ValidationIssue(BaseModel):
    entry_index: int
    resource_type: str | None
    resource_id: str | None
    message: str


class ValidationReport(BaseModel):
    valid: bool
    resource_counts: dict[str, int]
    errors: list[ValidationIssue]
