import { describe, it, expect } from "vitest";
import {
  activeSigner,
  buildAuditCertificate,
  cancel,
  chainEvents,
  decline,
  recordView,
  send,
  sign,
  verifyChain,
  type EsignEnvelope,
  type EsignSigner,
} from "@/modules/esign/engine";

function makeSigner(id: string, order: number, overrides: Partial<EsignSigner> = {}): EsignSigner {
  return {
    id,
    name: `Signer ${id}`,
    email: `${id}@example.com`,
    order,
    status: "PENDING",
    ...overrides,
  };
}

function makeEnvelope(): EsignEnvelope {
  return {
    id: "env1",
    status: "DRAFT",
    signers: [makeSigner("s1", 1), makeSigner("s2", 2)],
  };
}

describe("esign engine — send + activeSigner", () => {
  it("send moves DRAFT → SENT and emits ENVELOPE_SENT", () => {
    const env = makeEnvelope();
    const r = send(env, { now: new Date("2026-05-01T10:00:00Z") });
    expect(r.envelope.status).toBe("SENT");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]?.type).toBe("ENVELOPE_SENT");
  });

  it("rejects send when no signers", () => {
    const env = { ...makeEnvelope(), signers: [] };
    expect(() => send(env)).toThrow(/no signers/i);
  });

  it("rejects send from a non-DRAFT status", () => {
    const env = { ...makeEnvelope(), status: "SENT" as const };
    expect(() => send(env)).toThrow(/cannot be sent/i);
  });

  it("activeSigner returns lowest-order pending signer", () => {
    const env = { ...makeEnvelope(), status: "SENT" as const };
    expect(activeSigner(env)?.id).toBe("s1");
  });

  it("activeSigner is null in terminal state", () => {
    const env = { ...makeEnvelope(), status: "COMPLETED" as const };
    expect(activeSigner(env)).toBeNull();
  });
});

describe("esign engine — view + sign + sequential ordering", () => {
  it("recordView marks PENDING signer as VIEWED and bumps to IN_PROGRESS", () => {
    const env = { ...makeEnvelope(), status: "SENT" as const };
    const r = recordView(env, "s1");
    expect(r.envelope.status).toBe("IN_PROGRESS");
    expect(r.envelope.signers.find((s) => s.id === "s1")?.status).toBe("VIEWED");
    expect(r.events[0]?.type).toBe("SIGNER_VIEWED");
  });

  it("sign marks signer SIGNED and emits SIGNER_SIGNED", () => {
    const env = { ...makeEnvelope(), status: "SENT" as const };
    const r = sign(env, { signerId: "s1", signatureName: "Alice", ip: "1.1.1.1" });
    expect(r.envelope.signers[0]?.status).toBe("SIGNED");
    expect(r.events[0]?.type).toBe("SIGNER_SIGNED");
    expect(r.envelope.status).toBe("IN_PROGRESS");
  });

  it("rejects out-of-order signing", () => {
    const env = { ...makeEnvelope(), status: "SENT" as const };
    expect(() => sign(env, { signerId: "s2", signatureName: "Bob" })).toThrow(/turn/);
  });

  it("completes envelope after the final signer signs", () => {
    let env: EsignEnvelope = { ...makeEnvelope(), status: "SENT" };
    env = sign(env, { signerId: "s1", signatureName: "Alice" }).envelope;
    const r = sign(env, { signerId: "s2", signatureName: "Bob" });
    expect(r.envelope.status).toBe("COMPLETED");
    expect(r.events.map((e) => e.type)).toEqual(["SIGNER_SIGNED", "ENVELOPE_COMPLETED"]);
  });
});

describe("esign engine — decline + cancel", () => {
  it("decline sets envelope DECLINED and signer DECLINED with reason", () => {
    const env = { ...makeEnvelope(), status: "SENT" as const };
    const r = decline(env, { signerId: "s1", reason: "Not me" });
    expect(r.envelope.status).toBe("DECLINED");
    expect(r.envelope.signers[0]?.declineReason).toBe("Not me");
  });

  it("cancel transitions to CANCELLED and rejects from terminal", () => {
    const env = { ...makeEnvelope(), status: "SENT" as const };
    expect(cancel(env).envelope.status).toBe("CANCELLED");
    expect(() => cancel({ ...env, status: "COMPLETED" })).toThrow(/terminal/i);
  });
});

describe("esign engine — audit chain", () => {
  it("chainEvents links events via prevHash and verifyChain accepts it", () => {
    let env: EsignEnvelope = { ...makeEnvelope(), status: "SENT" };
    const all = [
      ...send({ ...makeEnvelope() }).events, // ENVELOPE_SENT
      ...recordView(env, "s1").events,
      ...sign(env, { signerId: "s1", signatureName: "Alice" }).events,
    ];
    const chained = chainEvents(all);
    expect(chained[0]?.prevHash).toBe("");
    expect(chained[1]?.prevHash).toBe(chained[0]?.hash);
    expect(verifyChain(chained)).toBe(true);
  });

  it("verifyChain detects tampering", () => {
    const env: EsignEnvelope = { ...makeEnvelope(), status: "SENT" };
    const events = [
      ...send({ ...makeEnvelope() }).events,
      ...sign(env, { signerId: "s1", signatureName: "Alice" }).events,
    ];
    const chained = chainEvents(events);
    chained[1] = { ...chained[1]!, detail: "(tampered)" };
    expect(verifyChain(chained)).toBe(false);
  });

  it("buildAuditCertificate snapshots signers + events + chainValid", () => {
    let env: EsignEnvelope = { ...makeEnvelope(), status: "SENT" };
    const signed = sign(env, { signerId: "s1", signatureName: "Alice", ip: "9.9.9.9" });
    env = signed.envelope;
    const chained = chainEvents(signed.events);
    const cert = buildAuditCertificate({
      envelope: { id: env.id, title: "Lease", status: env.status, createdAt: new Date() },
      signers: env.signers,
      events: chained,
      documentSha256: "deadbeef",
    });
    expect(cert.envelopeId).toBe("env1");
    expect(cert.signers[0]?.signedIp).toBe("9.9.9.9");
    expect(cert.chainValid).toBe(true);
    expect(cert.documentSha256).toBe("deadbeef");
  });
});
