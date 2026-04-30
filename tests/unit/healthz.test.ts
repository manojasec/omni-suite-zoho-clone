import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      $queryRawUnsafe: vi.fn(),
    },
  };
});

import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/healthz/route";

const queryRaw = prisma.$queryRawUnsafe as unknown as ReturnType<typeof vi.fn>;

describe("GET /api/healthz", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("returns 200 + status:ok when the db ping succeeds", async () => {
    queryRaw.mockResolvedValue([{ "1": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      db: string;
      uptimeSeconds: number;
      latencyMs: number;
      time: string;
    };
    expect(body.status).toBe("ok");
    expect(body.db).toBe("ok");
    expect(typeof body.uptimeSeconds).toBe("number");
    expect(typeof body.latencyMs).toBe("number");
    expect(typeof body.time).toBe("string");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 503 + status:degraded when the db ping fails", async () => {
    queryRaw.mockRejectedValue(new Error("connection refused"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      status: string;
      db: string;
      error: string;
    };
    expect(body.status).toBe("degraded");
    expect(body.db).toBe("error");
    expect(body.error).toContain("connection refused");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("hides non-Error throws behind a generic message", async () => {
    queryRaw.mockRejectedValue("boom");
    const res = await GET();
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unknown");
  });
});
