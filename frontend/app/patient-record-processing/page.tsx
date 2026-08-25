"use client";

import { useEffect, useState } from "react";
import Breadcrumb from "@/components/layout/Breadcrumb";

// Iteration 01: page exists and confirms backend connectivity. Actual bundle load/normalization/
// reconciliation UI is a later Phase 02 iteration, not this one.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export default function PatientRecordProcessingPage() {
  const [status, setStatus] = useState("checking backend...");

  useEffect(() => {
    fetch(`${BACKEND_URL}/health`)
      .then((res) => res.json())
      .then((data) => setStatus(`backend status: ${data.status}`))
      .catch(() => setStatus("backend unreachable"));
  }, []);

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Patient Record Processing" }]} />
      <h1 className="text-2xl font-bold text-slate-900">Patient Record Processing</h1>
      <p className="mt-1 text-slate-600">
        Bundle load, normalization, and reconciliation UI land in a later Phase 02 iteration.
      </p>
      <p className="mt-4 text-sm text-slate-500">{status}</p>
    </div>
  );
}
