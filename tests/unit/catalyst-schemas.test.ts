import { describe, it, expect } from "vitest";
import {
  CATALYST_RUNTIMES,
  CATALYST_RUNTIME_LABELS,
  DEFAULT_NODE_CODE,
  functionSchema,
  invokeSchema,
  slugify,
} from "@/modules/catalyst/schemas";

describe("catalyst schemas", () => {
  it("slugifies a name", () => {
    expect(slugify("Send Welcome Email!")).toBe("send-welcome-email");
    expect(slugify("  Sync — Deals  ")).toBe("sync-deals");
  });

  it("accepts a valid function", () => {
    const out = functionSchema.parse({
      name: "Welcome",
      slug: "welcome",
      runtime: "NODE_20",
      handler: "index.handler",
      code: DEFAULT_NODE_CODE,
      timeoutMs: "5000",
      memoryMb: "128",
    });
    expect(out.timeoutMs).toBe(5000);
    expect(out.runtime).toBe("NODE_20");
  });

  it("rejects invalid slug", () => {
    expect(() =>
      functionSchema.parse({
        name: "X",
        slug: "Bad Slug",
        runtime: "NODE_20",
        handler: "index.handler",
        code: "x",
      }),
    ).toThrow();
  });

  it("rejects unknown runtime", () => {
    expect(() =>
      functionSchema.parse({
        name: "X",
        slug: "x",
        runtime: "RUBY" as never,
        handler: "index.handler",
        code: "x",
      }),
    ).toThrow();
  });

  it("clamps timeout above max", () => {
    expect(() =>
      functionSchema.parse({
        name: "X",
        slug: "x",
        runtime: "NODE_20",
        handler: "index.handler",
        code: "x",
        timeoutMs: "9999999",
        memoryMb: "128",
      }),
    ).toThrow();
  });

  it("invokeSchema accepts empty payload", () => {
    expect(invokeSchema.parse({ payload: "" }).payload).toBe("");
  });

  it("has a label for every runtime", () => {
    for (const r of CATALYST_RUNTIMES) {
      expect(CATALYST_RUNTIME_LABELS[r]).toBeTruthy();
    }
  });
});
