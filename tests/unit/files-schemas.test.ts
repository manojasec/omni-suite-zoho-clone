import { describe, expect, it } from "vitest";
import {
  buildBreadcrumb,
  fileAssetSchema,
  fileIconKind,
  fileMoveSchema,
  fileRenameSchema,
  folderSchema,
  formatBytes,
} from "@/modules/files/schemas";

describe("folderSchema", () => {
  it("requires a name", () => {
    expect(folderSchema.safeParse({ name: "" }).success).toBe(false);
  });
  it("rejects names with slashes", () => {
    expect(folderSchema.safeParse({ name: "a/b" }).success).toBe(false);
    expect(folderSchema.safeParse({ name: "a\\b" }).success).toBe(false);
  });
  it("rejects names starting with a dot", () => {
    expect(folderSchema.safeParse({ name: ".hidden" }).success).toBe(false);
  });
  it("accepts a clean name and empty parent", () => {
    const r = folderSchema.safeParse({ name: "Reports", parentId: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.parentId).toBeUndefined();
  });
});

describe("fileAssetSchema", () => {
  const base = { name: "doc.pdf", mimeType: "application/pdf", sizeBytes: "1024", storageKey: "key/abc" };
  it("accepts valid input", () => {
    expect(fileAssetSchema.safeParse(base).success).toBe(true);
  });
  it("rejects invalid mime type", () => {
    expect(fileAssetSchema.safeParse({ ...base, mimeType: "not-a-mime" }).success).toBe(false);
  });
  it("rejects size over cap", () => {
    expect(fileAssetSchema.safeParse({ ...base, sizeBytes: String(101 * 1024 * 1024) }).success).toBe(false);
  });
  it("rejects negative size", () => {
    expect(fileAssetSchema.safeParse({ ...base, sizeBytes: "-1" }).success).toBe(false);
  });
  it("rejects malformed sha256", () => {
    expect(fileAssetSchema.safeParse({ ...base, sha256: "not-hex" }).success).toBe(false);
  });
  it("accepts valid sha256", () => {
    const sha = "a".repeat(64);
    const r = fileAssetSchema.safeParse({ ...base, sha256: sha });
    expect(r.success).toBe(true);
  });
});

describe("fileRenameSchema / fileMoveSchema", () => {
  it("rename rejects slashes", () => {
    expect(fileRenameSchema.safeParse({ name: "a/b" }).success).toBe(false);
  });
  it("move accepts empty folderId", () => {
    const r = fileMoveSchema.safeParse({ folderId: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.folderId).toBeUndefined();
  });
});

describe("formatBytes", () => {
  it("handles 0", () => expect(formatBytes(0)).toBe("0 B"));
  it("handles bytes", () => expect(formatBytes(512)).toBe("512 B"));
  it("handles KB", () => expect(formatBytes(2048)).toBe("2.0 KB"));
  it("handles MB", () => expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB"));
  it("handles bigint input", () => expect(formatBytes(BigInt(1024))).toBe("1.0 KB"));
  it("returns 0 B for negative", () => expect(formatBytes(-1)).toBe("0 B"));
});

describe("fileIconKind", () => {
  it("detects images", () => expect(fileIconKind("image/png")).toBe("image"));
  it("detects pdf", () => expect(fileIconKind("application/pdf")).toBe("pdf"));
  it("detects sheets", () => expect(fileIconKind("text/csv")).toBe("sheet"));
  it("detects video", () => expect(fileIconKind("video/mp4")).toBe("video"));
  it("detects archive", () => expect(fileIconKind("application/zip")).toBe("archive"));
  it("falls back to file", () => expect(fileIconKind("application/octet-stream")).toBe("file"));
});

describe("buildBreadcrumb", () => {
  it("prepends a Files root entry", () => {
    const trail = buildBreadcrumb([{ id: "a", name: "Docs" }, { id: "b", name: "Reports" }]);
    expect(trail.length).toBe(3);
    expect(trail[0]).toEqual({ id: null, name: "Files" });
    expect(trail[2]).toEqual({ id: "b", name: "Reports" });
  });
});
