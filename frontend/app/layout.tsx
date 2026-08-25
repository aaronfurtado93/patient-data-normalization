import type { ReactNode } from "react";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

export const metadata = {
  title: "Centauri Clinical Snapshot",
  description: "Patient data normalization snapshot",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
