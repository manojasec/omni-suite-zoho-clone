import { describe, it, expect } from "vitest";
import {
  applyMove,
  computeMoveRank,
  groupCards,
  type KanbanBoard,
} from "@/platform/views/kanban";

const board: KanbanBoard = {
  columns: [
    { id: "todo", title: "Todo" },
    { id: "doing", title: "Doing", wipLimit: 2 },
    { id: "done", title: "Done" },
  ],
  cards: [
    { id: "a", columnId: "todo", rank: 1024, title: "A" },
    { id: "b", columnId: "todo", rank: 2048, title: "B" },
    { id: "c", columnId: "doing", rank: 1024, title: "C" },
  ],
};

describe("kanban", () => {
  it("computeMoveRank: empty column → RANK_STEP", () => {
    expect(computeMoveRank(board, "a", "done", 0)).toBe(1024);
  });

  it("computeMoveRank: head insert → first rank − step", () => {
    const r = computeMoveRank(board, "x", "todo", 0);
    expect(r).toBe(0);
  });

  it("computeMoveRank: tail insert → last rank + step", () => {
    const r = computeMoveRank(board, "x", "todo", 99);
    expect(r).toBe(2048 + 1024);
  });

  it("computeMoveRank: middle → midpoint", () => {
    const r = computeMoveRank(board, "x", "todo", 1);
    expect(r).toBe((1024 + 2048) / 2);
  });

  it("applyMove returns a new board (immutable)", () => {
    const next = applyMove(board, "a", "doing", 1);
    expect(next).not.toBe(board);
    expect(board.cards.find((c) => c.id === "a")?.columnId).toBe("todo");
    expect(next.cards.find((c) => c.id === "a")?.columnId).toBe("doing");
  });

  it("applyMove rejects when WIP limit would be exceeded", () => {
    const filled: KanbanBoard = {
      ...board,
      cards: [
        ...board.cards,
        { id: "d", columnId: "doing", rank: 2048, title: "D" },
      ],
    };
    // doing now has c+d (2/2). Move `a` in → 3/2.
    expect(() => applyMove(filled, "a", "doing", 0)).toThrow(/WIP/);
  });

  it("applyMove allows move within same WIP-limited column", () => {
    const filled: KanbanBoard = {
      ...board,
      cards: [
        ...board.cards,
        { id: "d", columnId: "doing", rank: 2048, title: "D" },
      ],
    };
    expect(() => applyMove(filled, "c", "doing", 1)).not.toThrow();
  });

  it("groupCards returns sorted arrays by column", () => {
    const groups = groupCards(board);
    expect(groups.todo.map((c) => c.id)).toEqual(["a", "b"]);
    expect(groups.doing.map((c) => c.id)).toEqual(["c"]);
    expect(groups.done).toEqual([]);
  });
});
