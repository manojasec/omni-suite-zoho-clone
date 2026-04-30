import type { ReactNode } from "react";
import Link from "next/link";
import { loadPortal } from "@/modules/portal/load";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await loadPortal(token);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {ctx.workspace.name}
            </p>
            <h1 className="text-lg font-semibold">{ctx.customer.name}</h1>
          </div>
          <nav className="flex gap-1 text-sm">
            <Link
              href={`/portal/${token}`}
              className="rounded px-3 py-1 hover:bg-accent"
            >
              Overview
            </Link>
            <Link
              href={`/portal/${token}/invoices`}
              className="rounded px-3 py-1 hover:bg-accent"
            >
              Invoices
            </Link>
            <Link
              href={`/portal/${token}/quotes`}
              className="rounded px-3 py-1 hover:bg-accent"
            >
              Quotes
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-6">{children}</main>
      <footer className="mx-auto max-w-4xl px-6 py-6 text-center text-xs text-muted-foreground">
        This is a private link.{" "}
        {ctx.expiresAt
          ? `Expires ${ctx.expiresAt.toISOString().slice(0, 10)}.`
          : "No expiration."}
      </footer>
    </div>
  );
}
