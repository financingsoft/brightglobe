import { z } from "zod";

const secureAvatarUrl = z.string().url().refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "Avatar URL must use HTTPS.");

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(48).optional(),
  locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).max(16).optional(),
  timeZone: z.string().trim().min(1).max(64).optional(),
  countryCode: z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
  avatarUrl: secureAvatarUrl.nullable().optional(),
  bio: z.string().trim().max(160).nullable().optional()
}).strict().refine((value) => Object.values(value).some((entry) => entry !== undefined), {
  message: "At least one profile field must be provided."
});
