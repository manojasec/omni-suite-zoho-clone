import { z } from "zod";

const trimmedOptional = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim() || undefined);

export const signerInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Valid email is required"),
});
export type SignerInput = z.infer<typeof signerInputSchema>;

export const envelopeSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  message: trimmedOptional,
  documentUrl: z.string().trim().url("Document URL must be valid"),
  expiresAt: trimmedOptional,
  signers: z
    .array(signerInputSchema)
    .min(1, "At least one signer is required")
    .max(20, "Up to 20 signers allowed"),
});
export type EnvelopeInput = z.infer<typeof envelopeSchema>;

export const signSubmitSchema = z.object({
  signatureName: z.string().trim().min(2, "Type your full name to sign").max(120),
  agree: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "on" || v === "true")
    .refine((v) => v === true, "You must agree before signing"),
});
export type SignSubmitInput = z.infer<typeof signSubmitSchema>;

export const declineSchema = z.object({
  reason: z.string().trim().min(1, "Reason is required").max(500),
});
export type DeclineInput = z.infer<typeof declineSchema>;
