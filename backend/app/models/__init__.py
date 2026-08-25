"""Pydantic v2 models for the FHIR resources this project handles.

One module per resource type (`patient.py`, `condition.py`, ...), plus `common.py` for the shared
FHIR datatype building blocks (`Coding`, `CodeableConcept`, `Reference`, ...) and `bundle.py` for
the `Bundle` envelope + the discriminated union tying resource types together.

Modeling rules, per `project-plan/Assumptions.md`:
- Fields the FHIR R4 spec marks optional stay optional here — never defaulted to something
  invented. A missing `coding.display` stays `None`, not backfilled.
- Any `date`/`dateTime` field (`birthDate`, `onsetDateTime`, `effectiveDateTime`, `authoredOn`,
  `recordedDate`, ...) is typed `str`, not Pydantic's `date`/`datetime` — FHIR's date types allow
  partial precision (`"2019"`, `"2020"`) that Python's stdlib date types would reject outright.
  Keeping it a raw string preserves exactly the precision the source data has.
- Only the fields actually present/used in this project's bundle are modeled — see
  `project-plan/ResearchNotes.md` / `implementation-logs/Knowledge.md` for the full spec-vs-bundle
  comparison this is based on. Not a complete implementation of every FHIR R4 resource element.
"""
