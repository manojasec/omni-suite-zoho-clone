import { describe, it, expect } from "vitest";
import {
  buildCliqMessageEvent,
  buildCliqTypingEvent,
  cliqChannelKey,
  publishCliqMessage,
  publishCliqTyping,
} from "@/modules/cliq/realtime";
import { subscribe, type RealtimeEvent } from "@/platform/realtime";

describe("cliq realtime", () => {
  it("derives a workspace-scoped channel key", () => {
    expect(cliqChannelKey("ws1", "ch1")).toBe("ws:ws1:cliq:ch1");
  });

  it("buildCliqMessageEvent serialises createdAt to ISO and includes parentId default", () => {
    const ev = buildCliqMessageEvent({
      id: "m1",
      channelId: "ch1",
      authorId: "u1",
      body: "hello",
      createdAt: new Date("2026-05-09T12:00:00Z"),
    });
    expect(ev.type).toBe("cliq.message.created");
    expect(ev.data).toMatchObject({
      id: "m1",
      channelId: "ch1",
      authorId: "u1",
      body: "hello",
      parentId: null,
      createdAt: "2026-05-09T12:00:00.000Z",
    });
  });

  it("publishCliqMessage delivers to subscribers on the right channel", () => {
    const seen: RealtimeEvent[] = [];
    const off = subscribe("ws:wsX:cliq:chX", (e) => seen.push(e));
    publishCliqMessage("wsX", {
      id: "m2",
      channelId: "chX",
      authorId: "u1",
      body: "hi",
      createdAt: new Date(),
    });
    off();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.type).toBe("cliq.message.created");
  });

  it("typing events include a default ttlMs", () => {
    const ev = buildCliqTypingEvent({ channelId: "c", userId: "u" });
    expect((ev.data as { ttlMs: number }).ttlMs).toBe(4000);
  });

  it("publishCliqTyping reaches subscribers", () => {
    const seen: RealtimeEvent[] = [];
    const off = subscribe("ws:wsY:cliq:chY", (e) => seen.push(e));
    publishCliqTyping("wsY", { channelId: "chY", userId: "u1", ttlMs: 200 });
    off();
    expect(seen[0]?.type).toBe("cliq.typing");
    expect((seen[0]?.data as { ttlMs: number }).ttlMs).toBe(200);
  });

  it("does NOT cross-deliver between unrelated channels", () => {
    const seen: RealtimeEvent[] = [];
    const off = subscribe("ws:other:cliq:other", (e) => seen.push(e));
    publishCliqMessage("ws1", {
      id: "m3",
      channelId: "ch1",
      authorId: "u1",
      body: "hi",
      createdAt: new Date(),
    });
    off();
    expect(seen).toHaveLength(0);
  });
});
