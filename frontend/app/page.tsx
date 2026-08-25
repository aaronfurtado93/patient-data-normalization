"use client";

import { useEffect, useState } from "react";

// Phase 01 scaffolding: just prove the frontend can reach the backend. No snapshot UI yet —
// that's Phase 02, once the /patient-summary response shape exists.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export default function Home() {
  const [status, setStatus] = useState("checking backend...");

  useEffect(() => {
    fetch(`${BACKEND_URL}/health`)
      .then((res) => res.json())
      .then((data) => setStatus(`backend status: ${data.status}`))
      .catch(() => setStatus("backend unreachable"));
  }, []);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Centauri Clinical Snapshot</h1>
      <p>Scaffolding placeholder — the patient snapshot UI lands in Phase 02.</p>
      <p>{status}</p>
    </main>
  );
}
