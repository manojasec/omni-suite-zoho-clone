import { Card } from "@/components/ui/card";

type CanvasNode = {
  id: string;
  key: string;
  label: string;
  kind: string;
  posX: number;
  posY: number;
};

type CanvasEdge = {
  id: string;
  fromKey: string;
  toKey: string;
  branch: string | null;
};

const NODE_W = 140;
const NODE_H = 56;
const PAD = 24;

const KIND_FILL: Record<string, string> = {
  TRIGGER: "#dbeafe",
  TASK: "#f1f5f9",
  CONDITION: "#fef3c7",
  APPROVAL: "#fce7f3",
  END: "#dcfce7",
};

export function FlowCanvas({
  nodes,
  edges,
}: {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}) {
  if (nodes.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Add nodes to see the visual graph.
      </Card>
    );
  }

  // Auto-layout: any node missing a position is placed by topological order column.
  const positioned = layoutNodes(nodes, edges);
  const byKey = new Map(positioned.map((n) => [n.key, n]));

  const maxX =
    Math.max(...positioned.map((n) => n.posX + NODE_W)) + PAD;
  const maxY =
    Math.max(...positioned.map((n) => n.posY + NODE_H)) + PAD;
  const width = Math.max(maxX, 480);
  const height = Math.max(maxY, 200);

  return (
    <Card className="overflow-auto p-3">
      <div className="mb-2 text-sm font-semibold">Visual graph</div>
      <svg
        role="img"
        aria-label="Flow visual graph"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="rounded border bg-muted/20"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
          </marker>
        </defs>

        {edges.map((e) => {
          const a = byKey.get(e.fromKey);
          const b = byKey.get(e.toKey);
          if (!a || !b) return null;
          const x1 = a.posX + NODE_W / 2;
          const y1 = a.posY + NODE_H;
          const x2 = b.posX + NODE_W / 2;
          const y2 = b.posY;
          const midY = (y1 + y2) / 2;
          const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
          return (
            <g key={e.id}>
              <path
                d={path}
                stroke="#475569"
                strokeWidth={1.5}
                fill="none"
                markerEnd="url(#arrow)"
              />
              {e.branch ? (
                <text
                  x={(x1 + x2) / 2}
                  y={midY - 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#475569"
                >
                  {e.branch}
                </text>
              ) : null}
            </g>
          );
        })}

        {positioned.map((n) => (
          <g key={n.id} transform={`translate(${n.posX} ${n.posY})`}>
            <rect
              width={NODE_W}
              height={NODE_H}
              rx={8}
              ry={8}
              fill={KIND_FILL[n.kind] ?? "#f1f5f9"}
              stroke="#94a3b8"
            />
            <text
              x={NODE_W / 2}
              y={22}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill="#0f172a"
            >
              {truncate(n.label, 18)}
            </text>
            <text
              x={NODE_W / 2}
              y={40}
              textAnchor="middle"
              fontSize="10"
              fill="#475569"
            >
              {n.kind} · {truncate(n.key, 18)}
            </text>
          </g>
        ))}
      </svg>
    </Card>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Compute display positions. If a node already has non-zero posX/posY, keep it.
 * Otherwise lay out by depth (longest-path from a TRIGGER) and order within depth.
 */
function layoutNodes(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): CanvasNode[] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.key, []);
  for (const e of edges) {
    adj.get(e.fromKey)?.push(e.toKey);
  }

  // Compute depth via BFS from nodes with no incoming edges (or TRIGGER nodes).
  const incoming = new Map<string, number>();
  for (const n of nodes) incoming.set(n.key, 0);
  for (const e of edges) {
    incoming.set(e.toKey, (incoming.get(e.toKey) ?? 0) + 1);
  }
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const [key, c] of incoming) {
    if (c === 0) {
      depth.set(key, 0);
      queue.push(key);
    }
  }
  while (queue.length) {
    const k = queue.shift()!;
    const d = depth.get(k) ?? 0;
    for (const next of adj.get(k) ?? []) {
      const nd = (depth.get(next) ?? -1);
      if (d + 1 > nd) {
        depth.set(next, d + 1);
        queue.push(next);
      }
    }
  }

  // Group by depth, assign columns.
  const byDepth = new Map<number, CanvasNode[]>();
  for (const n of nodes) {
    const d = depth.get(n.key) ?? 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(n);
  }

  const result: CanvasNode[] = [];
  const colGap = NODE_W + 60;
  const rowGap = NODE_H + 40;
  for (const [d, group] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    group.sort((a, b) => a.key.localeCompare(b.key));
    group.forEach((n, idx) => {
      const useStored = n.posX > 0 || n.posY > 0;
      result.push({
        ...n,
        posX: useStored ? n.posX : PAD + idx * colGap,
        posY: useStored ? n.posY : PAD + d * rowGap,
      });
    });
  }
  return result;
}
