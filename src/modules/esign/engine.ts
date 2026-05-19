import { createHash } from "node:crypto";

/**
 * Pure eSign engine — computes envelope/signer state transitions and the
 * tamper-evident audit chain. No DB coupling.
 *
 * Transition model mirrors the existing Prisma enums:
 *   EnvelopeStatus: DRAFT → SENT → IN_PROGRESS → COMPLETED | DECLINED | CANCELLED
 *   SignerStatus:   PENDING → VIEWED → SIGNED | DECLINED
 *
 * Sequential signing: a signer with `order=N` becomes "active" once every
 * signer with order < N has SIGNED. Out-of-order action is rejected.
 *
 * Audit chain: each event hashes (prevHash || canonicalEventBody). The first
 * event uses prevHash="" so verifying a chain end-to-end requires only the
 * stored events themselves.
 */

// ---------- Public types ----------

export type EnvelopeStatus =
  | "DRAFT"
  | "SENT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DECLINED"
  | "CANCELLED";

export type SignerStatus = "PENDING" | "VIEWED" | "SIGNED" | "DECLINED";

export type EsignEventType =
  | "ENVELOPE_CREATED"
  | "ENVELOPE_SENT"
  | "ENVELOPE_CANCELLED"
  | "SIGNER_VIEWED"
  | "SIGNER_SIGNED"
  | "SIGNER_DECLINED"
  | "ENVELOPE_COMPLETED";

export interface EsignSigner {
  id: string;
  name: string;
  email: string;
  order: number;
  status: SignerStatus;
  signatureName?: string | null;
  signedAt?: Date | null;
  declinedAt?: Date | null;
  declineReason?: string | null;
  signedIp?: string | null;
  signedUserAgent?: string | null;
}

export interface EsignEnvelope {
  id: string;
  status: EnvelopeStatus;
  signers: EsignSigner[];
}

export interface EsignEvent {
  id: string;
  envelopeId: string;
  signerId?: string | null;
  type: EsignEventType;
  ip?: string | null;
  userAgent?: string | null;
  detail?: string | null;
  createdAt: Date;
  /** Set after `chainEvents` runs. */
  hash?: string;
  prevHash?: string;
}

// ---------- Status helpers ----------

export function activeSigner(env: EsignEnvelope): EsignSigner | null {
  if (env.status !== "SENT" && env.status !== "IN_PROGRESS") return null;
  const sorted = [...env.signers].sort((a, b) => a.order - b.order);
  return (
    sorted.find(
      (s) => s.status === "PENDING" || s.status === "VIEWED",
    ) ?? null
  );
}

export function allSigned(env: EsignEnvelope): boolean {
  return env.signers.length > 0 && env.signers.every((s) => s.status === "SIGNED");
}

export function anyDeclined(env: EsignEnvelope): boolean {
  return env.signers.some((s) => s.status === "DECLINED");
}

// ---------- Transitions ----------

export interface SignAction {
  signerId: string;
  signatureName: string;
  ip?: string;
  userAgent?: string;
  now?: Date;
}

export interface DeclineAction {
  signerId: string;
  reason: string;
  ip?: string;
  userAgent?: string;
  now?: Date;
}

export interface SendAction { now?: Date }
export interface CancelAction { now?: Date }

export interface TransitionResult {
  envelope: EsignEnvelope;
  events: EsignEvent[]; // newly produced (not yet chained)
}

function ensureActive(env: EsignEnvelope, signerId: string): EsignSigner {
  const active = activeSigner(env);
  if (!active) throw new Error("No active signer for this envelope");
  if (active.id !== signerId) {
    throw new Error("It is not this signer's turn");
  }
  if (active.status === "SIGNED" || active.status === "DECLINED") {
    throw new Error("Signer has already responded");
  }
  return active;
}

function freshEvent(env: EsignEnvelope, type: EsignEventType, opts: { signerId?: string; ip?: string; userAgent?: string; detail?: string; now?: Date }): EsignEvent {
  return {
    id: `evt_${env.id}_${type}_${(opts.now ?? new Date()).getTime()}`,
    envelopeId: env.id,
    signerId: opts.signerId ?? null,
    type,
    ip: opts.ip ?? null,
    userAgent: opts.userAgent ?? null,
    detail: opts.detail ?? null,
    createdAt: opts.now ?? new Date(),
  };
}

export function send(env: EsignEnvelope, action: SendAction = {}): TransitionResult {
  if (env.status !== "DRAFT") throw new Error(`Envelope cannot be sent from status ${env.status}`);
  if (env.signers.length === 0) throw new Error("Envelope has no signers");
  const next: EsignEnvelope = { ...env, status: "SENT" };
  return {
    envelope: next,
    events: [freshEvent(next, "ENVELOPE_SENT", { now: action.now })],
  };
}

export function recordView(env: EsignEnvelope, signerId: string, now: Date = new Date()): TransitionResult {
  const signer = env.signers.find((s) => s.id === signerId);
  if (!signer) throw new Error("Signer not found");
  if (signer.status !== "PENDING") return { envelope: env, events: [] };
  const updatedSigner: EsignSigner = { ...signer, status: "VIEWED" };
  const next: EsignEnvelope = {
    ...env,
    status: env.status === "SENT" ? "IN_PROGRESS" : env.status,
    signers: env.signers.map((s) => (s.id === signerId ? updatedSigner : s)),
  };
  return {
    envelope: next,
    events: [freshEvent(next, "SIGNER_VIEWED", { signerId, now })],
  };
}

export function sign(env: EsignEnvelope, action: SignAction): TransitionResult {
  const signer = ensureActive(env, action.signerId);
  const now = action.now ?? new Date();
  const updatedSigner: EsignSigner = {
    ...signer,
    status: "SIGNED",
    signatureName: action.signatureName,
    signedAt: now,
    signedIp: action.ip ?? null,
    signedUserAgent: action.userAgent ?? null,
  };
  const nextSigners = env.signers.map((s) => (s.id === signer.id ? updatedSigner : s));
  let nextEnv: EsignEnvelope = { ...env, status: "IN_PROGRESS", signers: nextSigners };
  const events: EsignEvent[] = [
    freshEvent(nextEnv, "SIGNER_SIGNED", {
      signerId: signer.id,
      ip: action.ip,
      userAgent: action.userAgent,
      detail: `Signed as ${action.signatureName}`,
      now,
    }),
  ];
  if (allSigned(nextEnv)) {
    nextEnv = { ...nextEnv, status: "COMPLETED" };
    events.push(freshEvent(nextEnv, "ENVELOPE_COMPLETED", { now }));
  }
  return { envelope: nextEnv, events };
}

export function decline(env: EsignEnvelope, action: DeclineAction): TransitionResult {
  const signer = ensureActive(env, action.signerId);
  const now = action.now ?? new Date();
  const updatedSigner: EsignSigner = {
    ...signer,
    status: "DECLINED",
    declinedAt: now,
    declineReason: action.reason,
  };
  const nextEnv: EsignEnvelope = {
    ...env,
    status: "DECLINED",
    signers: env.signers.map((s) => (s.id === signer.id ? updatedSigner : s)),
  };
  return {
    envelope: nextEnv,
    events: [
      freshEvent(nextEnv, "SIGNER_DECLINED", {
        signerId: signer.id,
        ip: action.ip,
        userAgent: action.userAgent,
        detail: action.reason,
        now,
      }),
    ],
  };
}

export function cancel(env: EsignEnvelope, action: CancelAction = {}): TransitionResult {
  if (env.status === "COMPLETED" || env.status === "DECLINED" || env.status === "CANCELLED") {
    throw new Error(`Envelope already in terminal status ${env.status}`);
  }
  const next: EsignEnvelope = { ...env, status: "CANCELLED" };
  return {
    envelope: next,
    events: [freshEvent(next, "ENVELOPE_CANCELLED", { now: action.now })],
  };
}

// ---------- Audit chain ----------

function canonicalEventBody(ev: EsignEvent): string {
  return JSON.stringify({
    id: ev.id,
    envelopeId: ev.envelopeId,
    signerId: ev.signerId ?? null,
    type: ev.type,
    ip: ev.ip ?? null,
    userAgent: ev.userAgent ?? null,
    detail: ev.detail ?? null,
    createdAt: ev.createdAt.toISOString(),
  });
}

export function hashEvent(prevHash: string, ev: EsignEvent): string {
  return createHash("sha256")
    .update(prevHash, "utf8")
    .update("\n", "utf8")
    .update(canonicalEventBody(ev), "utf8")
    .digest("hex");
}

/** Annotate events with prevHash + hash forming a tamper-evident chain. */
export function chainEvents(events: EsignEvent[], seed = ""): EsignEvent[] {
  let prev = seed;
  return events.map((ev) => {
    const h = hashEvent(prev, ev);
    const next = { ...ev, prevHash: prev, hash: h };
    prev = h;
    return next;
  });
}

export function verifyChain(events: EsignEvent[], seed = ""): boolean {
  let prev = seed;
  for (const ev of events) {
    if (ev.prevHash !== prev) return false;
    if (ev.hash !== hashEvent(prev, ev)) return false;
    prev = ev.hash;
  }
  return true;
}

// ---------- Audit certificate model (data-only) ----------

export interface AuditCertificateInput {
  envelope: { id: string; title: string; status: EnvelopeStatus; createdAt: Date; completedAt?: Date | null };
  signers: EsignSigner[];
  events: EsignEvent[]; // chained
  documentSha256?: string;
}

export interface AuditCertificate {
  envelopeId: string;
  title: string;
  status: EnvelopeStatus;
  documentSha256: string | null;
  signers: {
    name: string;
    email: string;
    status: SignerStatus;
    signedAt: Date | null;
    signedIp: string | null;
    signatureName: string | null;
  }[];
  events: { type: EsignEventType; createdAt: Date; ip: string | null; hash: string }[];
  chainValid: boolean;
}

export function buildAuditCertificate(input: AuditCertificateInput): AuditCertificate {
  return {
    envelopeId: input.envelope.id,
    title: input.envelope.title,
    status: input.envelope.status,
    documentSha256: input.documentSha256 ?? null,
    signers: input.signers.map((s) => ({
      name: s.name,
      email: s.email,
      status: s.status,
      signedAt: s.signedAt ?? null,
      signedIp: s.signedIp ?? null,
      signatureName: s.signatureName ?? null,
    })),
    events: input.events.map((e) => ({
      type: e.type,
      createdAt: e.createdAt,
      ip: e.ip ?? null,
      hash: e.hash ?? "",
    })),
    chainValid: verifyChain(input.events),
  };
}
