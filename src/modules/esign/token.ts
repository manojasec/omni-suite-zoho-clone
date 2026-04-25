import { randomBytes } from "node:crypto";

/** Generate a URL-safe random access token for signers. */
export function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}
