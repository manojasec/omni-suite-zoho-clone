/**
 * Pure Kanban helpers. Re-orders cards across columns using a fractional
 * index ("rank") so insertion/move never requires a full rewrite.
 *
 * Ranks are stored as numbers; midpoint between two existing ranks is taken
 * for inserts. This is good for thousands of moves; for production use a
 * lexorank string scheme.
 */

export type KanbanCard<T = unknown> = {
  id: string;
  columnId: string;
  rank: number;
  title: string;
  data?: T;
};

export type KanbanColumn = {
  id: string;
  title: string;
  /** Optional max-cards limit; reorder will refuse to exceed it. */
  wipLimit?: number;
  /** Optional column tint. */
  color?: string;
};

export type KanbanBoard<T = unknown> = {
  columns: KanbanColumn[];
  cards: KanbanCard<T>[];
};

const RANK_STEP = 1024;

/** Compute the rank for inserting `card` at `targetIndex` of column `toColumnId`. */
export function computeMoveRank<T>(
  board: KanbanBoard<T>,
  cardId: string,
  toColumnId: string,
  targetIndex: number,
): number {
  const sameColumnCards = board.cards
    .filter((c) => c.columnId === toColumnId && c.id !== cardId)
    .sort((a, b) => a.rank - b.rank);

  if (sameColumnCards.length === 0) return RANK_STEP;
  const clampedIdx = Math.max(0, Math.min(targetIndex, sameColumnCards.length));
  if (clampedIdx === 0) return sameColumnCards[0].rank - RANK_STEP;
  if (clampedIdx === sameColumnCards.length) {
    return sameColumnCards[sameColumnCards.length - 1].rank + RANK_STEP;
  }
  const prev = sameColumnCards[clampedIdx - 1].rank;
  const next = sameColumnCards[clampedIdx].rank;
  return (prev + next) / 2;
}

/** Apply a move and return a new board (immutable). */
export function applyMove<T>(
  board: KanbanBoard<T>,
  cardId: string,
  toColumnId: string,
  targetIndex: number,
): KanbanBoard<T> {
  const col = board.columns.find((c) => c.id === toColumnId);
  if (!col) throw new Error(`Unknown column ${toColumnId}`);
  const card = board.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`Unknown card ${cardId}`);

  if (col.wipLimit !== undefined) {
    const others = board.cards.filter(
      (c) => c.columnId === toColumnId && c.id !== cardId,
    );
    if (others.length + 1 > col.wipLimit) {
      throw new Error(`Column "${col.title}" is at WIP limit ${col.wipLimit}`);
    }
  }

  const newRank = computeMoveRank(board, cardId, toColumnId, targetIndex);
  return {
    ...board,
    cards: board.cards.map((c) =>
      c.id === cardId ? { ...c, columnId: toColumnId, rank: newRank } : c,
    ),
  };
}

/** Group + sort cards by column for rendering. */
export function groupCards<T>(
  board: KanbanBoard<T>,
): Record<string, KanbanCard<T>[]> {
  const out: Record<string, KanbanCard<T>[]> = {};
  for (const col of board.columns) out[col.id] = [];
  for (const card of board.cards) {
    if (!out[card.columnId]) out[card.columnId] = [];
    out[card.columnId].push(card);
  }
  for (const arr of Object.values(out)) arr.sort((a, b) => a.rank - b.rank);
  return out;
}
