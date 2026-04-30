import { z } from "zod";

export const CATALYST_RUNTIMES = ["NODE_18", "NODE_20", "PYTHON_311"] as const;
export const CATALYST_RUNTIME_LABELS: Record<
  (typeof CATALYST_RUNTIMES)[number],
  string
> = {
  NODE_18: "Node.js 18",
  NODE_20: "Node.js 20",
  PYTHON_311: "Python 3.11",
};

export const DEFAULT_NODE_CODE = `exports.handler = async (event) => {
  return { statusCode: 200, body: { ok: true, echo: event } };
};
`;

export const DEFAULT_PYTHON_CODE = `def handler(event):
    return {"statusCode": 200, "body": {"ok": True, "echo": event}}
`;

export const slugify = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const functionSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  runtime: z.enum(CATALYST_RUNTIMES),
  handler: z.string().trim().min(1).max(120).default("index.handler"),
  code: z.string().min(1).max(64_000),
  timeoutMs: z.coerce.number().int().min(100).max(900_000).default(30_000),
  memoryMb: z.coerce.number().int().min(64).max(4096).default(128),
});
export type FunctionInput = z.infer<typeof functionSchema>;

export const invokeSchema = z.object({
  payload: z.string().max(16_000).optional().or(z.literal("")),
});
