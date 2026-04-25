"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { MODULE_LABELS, type SearchHit } from "@/modules/search";

export function SearchTrigger() {
  const [open, setOpen] = useState(false);
  useGlobalShortcut(() => setOpen(true));
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent md:inline-flex"
        aria-label="Open global search"
      >
        <Search className="h-4 w-4" />
        <span>Search…</span>
        <kbd className="ml-2 rounded border bg-muted px-1 text-[10px]">Ctrl K</kbd>
      </button>
      {open ? <SearchModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function useGlobalShortcut(open: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isK = e.key === "k" || e.key === "K";
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);
}

function SearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ac.signal });
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { hits: SearchHit[] };
        setHits(data.hits);
        setActive(0);
      } catch (e) {
        if ((e as { name?: string }).name !== "AbortError") setHits([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      go(hits[active].href);
    }
  }

  // Group hits by module preserving order from the API
  const groups = new Map<SearchHit["module"], SearchHit[]>();
  for (const h of hits) {
    if (!groups.has(h.module)) groups.set(h.module, []);
    groups.get(h.module)!.push(h);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-lg border bg-popover shadow-2xl">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search contacts, deals, invoices, tickets…"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {q.trim().length < 2 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Type at least 2 characters.</p>
          ) : hits.length === 0 && !loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No results.</p>
          ) : (
            <ul role="listbox" className="py-1">
              {[...groups.entries()].map(([mod, items]) => (
                <li key={mod}>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {MODULE_LABELS[mod]}
                  </div>
                  <ul>
                    {items.map((h) => {
                      const idx = hits.indexOf(h);
                      return (
                        <li key={h.id}>
                          <button
                            type="button"
                            onMouseEnter={() => setActive(idx)}
                            onClick={() => go(h.href)}
                            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                              idx === active ? "bg-accent" : "hover:bg-accent/60"
                            }`}
                          >
                            <span className="truncate">{h.title}</span>
                            {h.subtitle ? (
                              <span className="shrink-0 text-xs text-muted-foreground">{h.subtitle}</span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground">
          <kbd className="rounded border bg-background px-1">↑</kbd>
          <kbd className="ml-1 rounded border bg-background px-1">↓</kbd> navigate
          <span className="mx-2">·</span>
          <kbd className="rounded border bg-background px-1">↵</kbd> open
          <span className="mx-2">·</span>
          <kbd className="rounded border bg-background px-1">Esc</kbd> close
        </div>
      </div>
    </div>
  );
}
