import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Shree Beauty · Work Tracker", template: "%s · Shree Beauty Work Tracker" },
  description: "Daily, weekly and monthly task and work tracking for the Shree Beauty team.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
