"use client";

import * as React from "react";
import {
  applyMove,
  groupCards,
  type KanbanBoard,
  type KanbanCard,
  type KanbanColumn,
} from "./kanban";

export type KanbanViewProps<T = unknown> = {
  board: KanbanBoard<T>;
  /** Called after a successful drop with the resulting board. */
  onMove?: (
    move: { cardId: string; toColumnId: string; targetIndex: number },
    nextBoard: KanbanBoard<T>,
  ) => void;
  onCardClick?: (card: KanbanCard<T>, e: React.MouseEvent) => void;
  /** Render a custom card body. Default shows `card.title`. */
  renderCard?: (card: KanbanCard<T>) => React.ReactNode;
  /** Render a custom column header. */
  renderColumnHeader?: (col: KanbanColumn, count: number) => React.ReactNode;
};

/**
 * Native HTML5 drag-and-drop kanban. Uses dataTransfer to ferry the card id
 * and column boundaries to compute the drop index from cursor position.
 */
export function KanbanView<T = unknown>(props: KanbanViewProps<T>) {
  const { board, onMove, onCardClick, renderCard, renderColumnHeader } = props;
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [hoverColId, setHoverColId] = React.useState<string | null>(null);
  const grouped = React.useMemo(() => groupCards(board), [board]);

  function handleDragStart(e: React.DragEvent, cardId: string) {
    e.dataTransfer.setData("text/plain", cardId);
    e.dataTransfer.effectAllowed = "move";
    setDragId(cardId);
  }
  function handleDragEnd() {
    setDragId(null);
    setHoverColId(null);
  }

  function handleDrop(e: React.DragEvent, columnId: string) {
    e.preventDefault();
    setHoverColId(null);
    const cardId = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    if (!cardId) return;
    const targetIndex = computeIndexFromY(e, columnId, grouped[columnId] ?? []);
    try {
      const next = applyMove(board, cardId, columnId, targetIndex);
      onMove?.({ cardId, toColumnId: columnId, targetIndex }, next);
    } catch (err) {
      // WIP limit — caller may surface a toast; we just no-op here.
      console.warn("kanban move rejected:", (err as Error).message);
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {board.columns.map((col) => {
        const cards = grouped[col.id] ?? [];
        return (
          <div
            key={col.id}
            className={[
              "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 p-2",
              hoverColId === col.id ? "ring-2 ring-primary/40" : "",
            ].join(" ")}
            onDragOver={(e) => {
              e.preventDefault();
              setHoverColId(col.id);
            }}
            onDragLeave={() => setHoverColId((c) => (c === col.id ? null : c))}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div
              className="mb-2 flex items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium"
              style={col.color ? { borderLeft: `3px solid ${col.color}` } : undefined}
            >
              {renderColumnHeader ? (
                renderColumnHeader(col, cards.length)
              ) : (
                <>
                  <span>{col.title}</span>
                  <span className="rounded-full bg-background px-2 text-xs text-muted-foreground">
                    {cards.length}
                    {col.wipLimit !== undefined ? ` / ${col.wipLimit}` : ""}
                  </span>
                </>
              )}
            </div>
            <ul className="flex flex-col gap-2">
              {cards.map((card) => (
                <li
                  key={card.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, card.id)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => onCardClick?.(card, e)}
                  className={[
                    "cursor-grab rounded-md border bg-background p-2 text-sm shadow-sm",
                    dragId === card.id ? "opacity-50" : "",
                    onCardClick ? "hover:border-primary/40" : "",
                  ].join(" ")}
                  data-card-id={card.id}
                >
                  {renderCard ? renderCard(card) : <div>{card.title}</div>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function computeIndexFromY<T>(
  e: React.DragEvent,
  columnId: string,
  cards: KanbanCard<T>[],
): number {
  const container = e.currentTarget as HTMLElement;
  const lis = container.querySelectorAll(`[data-card-id]`);
  const y = e.clientY;
  for (let i = 0; i < lis.length; i++) {
    const r = (lis[i] as HTMLElement).getBoundingClientRect();
    if (y < r.top + r.height / 2) return i;
  }
  return cards.length;
}
