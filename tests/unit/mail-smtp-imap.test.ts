import { describe, it, expect } from "vitest";
import { buildEnvelope, dotStuff, quoteMime } from "@/platform/mail/smtp";
import {
  buildLogin,
  buildSelect,
  buildUidFetch,
  imapQuote,
  parseFetchResponse,
  parseSearchResponse,
  nextTag,
} from "@/platform/mail/imap";

describe("smtp wire format", () => {
  it("quoteMime passes ASCII through and base64-encodes non-ASCII", () => {
    expect(quoteMime("Plain Subject")).toBe("Plain Subject");
    const enc = quoteMime("Héllo");
    expect(enc.startsWith("=?utf-8?B?")).toBe(true);
    expect(enc.endsWith("?=")).toBe(true);
  });

  it("dotStuff escapes leading periods on every line", () => {
    expect(dotStuff(".hidden\n.foo\nbar")).toBe("..hidden\n..foo\nbar");
  });

  it("buildEnvelope produces RFC 5322 with required headers", () => {
    const raw = buildEnvelope({
      from: "a@x.com",
      to: ["b@y.com"],
      subject: "Hi",
      text: "Hello",
    });
    expect(raw).toContain("From: a@x.com\r\n");
    expect(raw).toContain("To: b@y.com\r\n");
    expect(raw).toContain("Subject: Hi\r\n");
    expect(raw).toContain("MIME-Version: 1.0\r\n");
    expect(raw).toMatch(/Message-ID: <[^>]+>\r\n/);
    expect(raw).toMatch(/Content-Type: text\/plain/);
    expect(raw.endsWith("Hello\r\n")).toBe(true);
  });

  it("buildEnvelope produces multipart/alternative when both text and html provided", () => {
    const raw = buildEnvelope({
      from: "a@x.com",
      to: ["b@y.com"],
      subject: "Hi",
      text: "plain",
      html: "<b>html</b>",
    });
    expect(raw).toMatch(/multipart\/alternative; boundary="b_/);
    expect(raw).toContain("plain");
    expect(raw).toContain("<b>html</b>");
  });

  it("buildEnvelope adds In-Reply-To and References when given", () => {
    const raw = buildEnvelope({
      from: "a@x.com",
      to: ["b@y.com"],
      subject: "Re",
      text: "x",
      inReplyTo: "<orig@y.com>",
    });
    expect(raw).toContain("In-Reply-To: <orig@y.com>\r\n");
    expect(raw).toContain("References: <orig@y.com>\r\n");
  });
});

describe("imap wire format", () => {
  it("imapQuote escapes quotes and backslashes", () => {
    expect(imapQuote("hello")).toBe('"hello"');
    expect(imapQuote('a"b\\c')).toBe('"a\\"b\\\\c"');
  });

  it("imapQuote uses literal form for very long strings", () => {
    const s = "x".repeat(2000);
    const q = imapQuote(s);
    expect(q.startsWith("{2000}\r\n")).toBe(true);
  });

  it("buildLogin / buildSelect / buildUidFetch produce expected commands", () => {
    expect(buildLogin("A0001", "u@x", "p")).toBe('A0001 LOGIN "u@x" "p"\r\n');
    expect(buildSelect("A0002")).toBe('A0002 SELECT "INBOX"\r\n');
    expect(buildUidFetch("A0003", 100)).toBe(
      "A0003 UID FETCH 100:* (UID BODY.PEEK[])\r\n",
    );
  });

  it("nextTag increments on each call (with reset)", () => {
    expect(nextTag(true)).toBe("A0001");
    expect(nextTag()).toBe("A0002");
    expect(nextTag()).toBe("A0003");
  });

  it("parseSearchResponse extracts UIDs", () => {
    expect(parseSearchResponse("* SEARCH 1 4 9\r\nA01 OK\r\n")).toEqual([1, 4, 9]);
  });

  it("parseFetchResponse extracts uid + body for one message", () => {
    const body = "From: a@x\r\nSubject: Hi\r\n\r\nHello";
    const lit = `* 1 FETCH (UID 42 BODY[] {${body.length}}\r\n${body})\r\n`;
    const out = parseFetchResponse(lit);
    expect(out).toHaveLength(1);
    expect(out[0].uid).toBe(42);
    expect(out[0].rfc822).toBe(body);
  });
});
