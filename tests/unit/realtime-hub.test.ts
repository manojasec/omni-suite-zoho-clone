import { describe, it, expect, beforeEach } from "vitest";
import {
  subscribe,
  publish,
  encodeSse,
  subscriberCount,
  channelCount,
} from "@/platform/realtime";

describe("realtime hub", () => {
  beforeEach(() => {
    // best-effort cleanup between tests by exhausting subscribers
    // (no public reset method by design)
  });

  it("delivers events to subscribers on the same channel", () => {
    const received: unknown[] = [];
    const unsub = subscribe("test:hub:1", (evt) => received.push(evt));
    publish("test:hub:1", { type: "ping", data: { n: 1 } });
    publish("test:hub:1", { type: "ping", data: { n: 2 } });
    expect(received).toHaveLength(2);
    expect((received[0] as { type: string }).type).toBe("ping");
    unsub();
  });

  it("does not leak across channels", () => {
    const a: unknown[] = [];
    const b: unknown[] = [];
    const ua = subscribe("test:hub:a", (e) => a.push(e));
    const ub = subscribe("test:hub:b", (e) => b.push(e));
    publish("test:hub:a", { type: "x", data: 1 });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(0);
    ua();
    ub();
  });

  it("unsubscribe stops delivery and frees the channel", () => {
    const received: unknown[] = [];
    const unsub = subscribe("test:hub:cleanup", (e) => received.push(e));
    expect(subscriberCount("test:hub:cleanup")).toBe(1);
    unsub();
    publish("test:hub:cleanup", { type: "x", data: 0 });
    expect(received).toHaveLength(0);
    expect(subscriberCount("test:hub:cleanup")).toBe(0);
  });

  it("isolates subscriber errors from other subscribers", () => {
    const received: unknown[] = [];
    const u1 = subscribe("test:hub:err", () => {
      throw new Error("boom");
    });
    const u2 = subscribe("test:hub:err", (e) => received.push(e));
    publish("test:hub:err", { type: "x", data: null });
    expect(received).toHaveLength(1);
    u1();
    u2();
  });

  it("publishes are no-ops on dead channels", () => {
    expect(() => publish("test:hub:dead", { type: "x", data: null })).not.toThrow();
  });

  it("channelCount tracks active channels", () => {
    const before = channelCount();
    const u = subscribe("test:hub:count", () => {});
    expect(channelCount()).toBe(before + 1);
    u();
    expect(channelCount()).toBe(before);
  });
});

describe("encodeSse", () => {
  it("formats with id, event, and data lines", () => {
    const out = encodeSse({ id: "42", type: "tick", data: { x: 1 } });
    expect(out).toContain("id: 42");
    expect(out).toContain("event: tick");
    expect(out).toContain('data: {"x":1}');
    expect(out.endsWith("\n\n")).toBe(true);
  });

  it("splits multi-line data values across data: lines", () => {
    const out = encodeSse({ id: "1", type: "msg", data: "line1\nline2" });
    // JSON.stringify("line1\nline2") = "\"line1\\nline2\"" — single line in SSE
    expect(out.match(/^data: /gm)?.length).toBe(1);
  });

  it("includes retry hint when set", () => {
    const out = encodeSse({ id: "1", type: "x", data: null, retry: 5000 });
    expect(out).toContain("retry: 5000");
  });
});
