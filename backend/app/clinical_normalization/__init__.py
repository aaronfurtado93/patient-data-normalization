"""Clinical normalization: turns validated FHIR resources into the patient-centric,
discrepancy-annotated PatientCard the frontend renders.

See project-plan/Assumptions.md for the data-handling rules this implements, and
implementation-logs/Knowledge.md for the specific data-quality catalog it detects. Module naming
follows Assumptions.md's decision: this package is the broader "clinical_normalization" work; the
narrower duplicate-Patient-merge logic inside it is named "patient_reconciliation".

Module layout:
- bundle_parser.py — turns raw bundle JSON into typed resources, bucketed by resourceType.
  Shared by /validate's structural report and this package's card-building — one place that
  walks bundle.entry and decides what parses.
- patient_reconciliation.py — canonical-patient selection + unresolved-duplicate flagging.
- status_filters.py — entered-in-error/inactive/resolved exclusion, per resource type.
- discrepancies.py — the rest of the data-quality catalog: missing display, dangling references,
  code/system mismatches, FHIR invariant violations, unconfirmed verification status.
- patient_card.py — assembles all of the above into one PatientCard.
"""
