import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  presignUrl,
  buildStorageKey,
  publicUrl,
  isStorageConfigured,
} from "@/platform/storage";

const ENV_KEYS = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_FORCE_PATH_STYLE",
  "S3_PUBLIC_BASE_URL",
] as const;

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  // Configure a known good test environment.
  process.env.S3_ENDPOINT = "https://s3.us-east-1.amazonaws.com";
  process.env.S3_REGION = "us-east-1";
  process.env.S3_BUCKET = "test-bucket";
  process.env.S3_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
  process.env.S3_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  delete process.env.S3_FORCE_PATH_STYLE;
  delete process.env.S3_PUBLIC_BASE_URL;
  // Force reload of cached config.
  delete (global as unknown as { __s3CacheCleared?: boolean }).__s3CacheCleared;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("S3 storage adapter", () => {
  it("isStorageConfigured returns true with full env", () => {
    expect(isStorageConfigured()).toBe(true);
  });

  it("buildStorageKey produces a workspace-scoped path", () => {
    const k = buildStorageKey({
      workspaceId: "ws_abc",
      scope: "files",
      id: "id1",
      filename: "report final.pdf",
    });
    expect(k).toMatch(/^ws\/ws_abc\/files\/\d{4}\/\d{2}\/id1-report_final\.pdf$/);
  });

  it("buildStorageKey sanitises filename", () => {
    const k = buildStorageKey({
      workspaceId: "w",
      scope: "files",
      id: "i",
      filename: "../../etc/passwd",
    });
    expect(k).not.toContain("..");
    expect(k).not.toContain("/etc/");
  });

  it("presignUrl returns a URL with required SigV4 query params", () => {
    const url = presignUrl({ method: "PUT", key: "ws/x/files/2026/04/id-name.png", expiresSeconds: 600 });
    expect(url).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
    expect(url).toContain("X-Amz-Signature=");
    expect(url).toContain("X-Amz-Credential=");
    expect(url).toContain("X-Amz-Date=");
    expect(url).toContain("X-Amz-Expires=600");
    expect(url).toContain("X-Amz-SignedHeaders=host");
  });

  it("presignUrl uses virtual-hosted style by default", () => {
    const url = presignUrl({ method: "GET", key: "a/b.txt" });
    expect(url).toContain("test-bucket.s3.us-east-1.amazonaws.com");
  });

  it("publicUrl returns null when not configured", () => {
    expect(publicUrl("a/b")).toBe(null);
  });
});
