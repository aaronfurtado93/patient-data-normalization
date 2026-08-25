import ProcessingWidget from "@/components/dashboard/ProcessingWidget";

// Default landing page (`/`) per Iteration 01.
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-slate-600">Centauri Clinical Snapshot — reconciliation tooling overview.</p>

      <div className="mt-6">
        <ProcessingWidget />
      </div>
    </div>
  );
}
