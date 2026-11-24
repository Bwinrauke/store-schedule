import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Store Schedule",
  description: "Weekly employee schedules across every store.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
