import Link from "next/link";

export default function ProcessingWidget() {
  return (
    <Link
      href="/patient-record-processing"
      className="block max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <h2 className="text-base font-semibold text-slate-900">Patient Record Processing</h2>
      <p className="mt-1 text-sm text-slate-600">
        Load and reconcile a FHIR patient bundle into a clinician-scannable snapshot.
      </p>
      <span className="mt-3 inline-block text-sm font-medium text-blue-600">Open &rarr;</span>
    </Link>
  );
}
