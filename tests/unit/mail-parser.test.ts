import { describe, it, expect } from "vitest";
import {
  parseRfc822,
  parseHeaderBlock,
  splitHeadersAndBody,
  unfoldHeaders,
  parseAddressList,
  extractAddress,
  extractText,
} from "@/platform/mail/parser";

describe("mail parser", () => {
  it("splitHeadersAndBody handles CRLF", () => {
    const r = splitHeadersAndBody("a: 1\r\nb: 2\r\n\r\nbody here");
    expect(r.head).toBe("a: 1\r\nb: 2");
    expect(r.body).toBe("body here");
  });

  it("unfoldHeaders joins continuation lines", () => {
    expect(unfoldHeaders("Subject: Hello\r\n World")).toBe("Subject: Hello World");
  });

  it("parseHeaderBlock lowercases names and keeps first occurrence", () => {
    const h = parseHeaderBlock("From: a@b\r\nSubject: Hi\r\nFrom: c@d");
    expect(h.from).toBe("a@b");
    expect(h.subject).toBe("Hi");
  });

  it("extractAddress pulls from <bracket> form", () => {
    expect(extractAddress('"Alice" <alice@example.com>')).toBe("alice@example.com");
    expect(extractAddress("bob@example.com")).toBe("bob@example.com");
    expect(extractAddress("not an address")).toBeNull();
  });

  it("parseAddressList splits on commas, ignoring quotes/brackets", () => {
    const l = parseAddressList('"Doe, John" <j@x.com>, k@y.com');
    expect(l).toEqual(["j@x.com", "k@y.com"]);
  });

  it("parseRfc822 returns subject/from/to/text for a simple plain message", () => {
    const raw = [
      "From: Alice <alice@x.com>",
      "To: bob@y.com, carol@z.com",
      "Subject: Hello",
      "Date: Mon, 30 Apr 2026 10:00:00 +0000",
      "Message-ID: <abc@x.com>",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Hi there",
    ].join("\r\n");
    const m = parseRfc822(raw);
    expect(m.subject).toBe("Hello");
    expect(m.from).toBe("alice@x.com");
    expect(m.to).toEqual(["bob@y.com", "carol@z.com"]);
    expect(m.messageId).toBe("abc@x.com");
    expect(m.date?.toISOString()).toBe("2026-04-30T10:00:00.000Z");
    expect(m.text.trim()).toBe("Hi there");
  });

  it("extractText decodes quoted-printable bodies", () => {
    const text = extractText(
      { "content-type": "text/plain", "content-transfer-encoding": "quoted-printable" },
      "Hello=20World=\r\nNext line",
    );
    expect(text).toContain("Hello World");
  });

  it("extractText decodes base64 bodies", () => {
    const b64 = Buffer.from("Hi there", "utf8").toString("base64");
    const text = extractText(
      { "content-type": "text/plain", "content-transfer-encoding": "base64" },
      b64,
    );
    expect(text).toBe("Hi there");
  });

  it("extractText prefers text/plain in multipart/alternative", () => {
    const boundary = "BOUND";
    const body = [
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      "plain body",
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      "<p>html body</p>",
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const text = extractText(
      { "content-type": `multipart/alternative; boundary="${boundary}"` },
      body,
    );
    expect(text.trim()).toBe("plain body");
  });
});
