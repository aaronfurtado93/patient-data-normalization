import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Centauri Clinical Snapshot",
  description: "Patient data normalization snapshot",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
