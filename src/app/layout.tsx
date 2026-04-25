import type { Metadata } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/app/theme-toggle";

export const metadata: Metadata = {
  title: "OmniSuite — All-in-one business platform",
  description: "CRM, Sales, Invoicing, Projects, Helpdesk, Forms, Campaigns. One workspace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
