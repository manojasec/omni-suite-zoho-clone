import { z } from "zod";

export const VAULT_ITEM_TYPES = ["LOGIN", "NOTE", "CARD"] as const;
export const VAULT_ITEM_TYPE_LABELS: Record<(typeof VAULT_ITEM_TYPES)[number], string> = {
  LOGIN: "Login",
  NOTE: "Secure note",
  CARD: "Card",
};

export const vaultFolderSchema = z.object({
  name: z.string().trim().min(1).max(160),
});

export const vaultItemSchema = z.object({
  type: z.enum(VAULT_ITEM_TYPES).default("LOGIN"),
  name: z.string().trim().min(1).max(200),
  username: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(200).optional(),
  ),
  url: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
  notes: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(1000).optional(),
  ),
  secret: z.string().min(1, "Secret is required").max(2000),
  folderId: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().min(1).optional(),
  ),
});

export const vaultItemUpdateSchema = vaultItemSchema.extend({
  // Allow empty secret on update (means "keep existing").
  secret: z.string().max(2000).optional().or(z.literal("")),
});

export type VaultFolderInput = z.infer<typeof vaultFolderSchema>;
export type VaultItemInput = z.infer<typeof vaultItemSchema>;
export type VaultItemUpdateInput = z.infer<typeof vaultItemUpdateSchema>;

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ" + "abcdefghijkmnpqrstuvwxyz" + "23456789" + "!@#$%^&*-_=+";

export function generatePassword(length = 20): string {
  // Use crypto.getRandomValues if available (server-side via globalThis.crypto in Node 19+).
  const out: string[] = [];
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out.push(PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length]);
  }
  return out.join("");
}

/** Estimate password strength on a 0..4 scale (very rough; not zxcvbn). */
export function estimateStrength(plain: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let s = 0;
  if (plain.length >= 8) s++;
  if (plain.length >= 12) s++;
  if (/[a-z]/.test(plain) && /[A-Z]/.test(plain)) s++;
  if (/\d/.test(plain) && /[^A-Za-z0-9]/.test(plain)) s++;
  const score = Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
  const label = ["Very weak", "Weak", "Fair", "Strong", "Very strong"][score];
  return { score, label };
}
