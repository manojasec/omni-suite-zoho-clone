import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-8 py-4">
        <div className="text-lg font-semibold tracking-tight">OmniSuite</div>
        <nav className="flex items-center gap-3">
          <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link href="/signup"><Button size="sm">Get started</Button></Link>
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          One workspace for your customers, sales, money, and work.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          CRM, sales pipeline, invoicing, projects, helpdesk, forms, and email campaigns —
          built into a single, fast, multi-tenant platform.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/signup"><Button size="lg">Start free</Button></Link>
          <Link href="/login"><Button size="lg" variant="outline">Sign in</Button></Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Demo login after seeding: <code>owner@demo.test / Password123!</code>
        </p>
      </section>

      <footer className="border-t px-8 py-4 text-xs text-muted-foreground">
        © {new Date().getFullYear()} OmniSuite — MVP build
      </footer>
    </main>
  );
}
