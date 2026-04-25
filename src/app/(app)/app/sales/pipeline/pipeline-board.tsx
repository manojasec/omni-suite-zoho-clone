"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { moveDealStageAction } from "../deals/actions";

type DealCard = {
  id: string;
  name: string;
  value: string;
  currency: string;
  status: "OPEN" | "WON" | "LOST";
  ownerName: string | null;
  contactName: string | null;
  stageId: string;
};

type Stage = {
  id: string;
  name: string;
  probability: number;
};

export function PipelineBoard({
  stages,
  initialDeals,
  canEdit,
}: {
  stages: Stage[];
  initialDeals: DealCard[];
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();
  const [deals, setDealsOptimistic] = useOptimistic(
    initialDeals,
    (state: DealCard[], move: { id: string; stageId: string }) =>
      state.map((d) => (d.id === move.id ? { ...d, stageId: move.stageId } : d)),
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = (stageId: string, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    setDraggingId(null);
    startTransition(async () => {
      setDealsOptimistic({ id, stageId });
      const res = await moveDealStageAction({ dealId: id, stageId });
      if (res && "error" in res && res.error) setError(res.error);
    });
  };

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(260px, 1fr))` }}>
        {stages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stageId === stage.id && d.status === "OPEN");
          const total = stageDeals.reduce((acc, d) => acc + Number(d.value), 0);
          return (
            <div
              key={stage.id}
              className="flex flex-col rounded-lg border bg-card"
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => canEdit && onDrop(stage.id, e)}
            >
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div>
                  <h3 className="text-sm font-semibold">{stage.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {stageDeals.length} · {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{stage.probability}%</span>
              </div>
              <div className="flex flex-col gap-2 p-2 min-h-[160px]">
                {stageDeals.map((d) => (
                  <Link
                    key={d.id}
                    href={`/app/sales/deals/${d.id}`}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      if (!canEdit) return;
                      e.dataTransfer.setData("text/plain", d.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(d.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={`rounded-md border bg-background p-2 text-sm shadow-sm hover:bg-accent ${
                      draggingId === d.id ? "opacity-50" : ""
                    } ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
                  >
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {Number(d.value).toLocaleString()} {d.currency}
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>{d.contactName ?? "—"}</span>
                      <span>{d.ownerName ?? ""}</span>
                    </div>
                  </Link>
                ))}
                {stageDeals.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-muted-foreground">No deals</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
