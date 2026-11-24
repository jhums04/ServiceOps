import { z } from "zod";

export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

/** Optional text input: trimmed, with an empty or missing value stored as null. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .optional()
    .transform((value) => value || null);
}

export function requiredText(max: number, message: string) {
  return z
    .string()
    .trim()
    .min(1, message)
    .max(max, `Use ${max} characters or fewer.`);
}

export function validationError(error: z.ZodError): ActionState {
  return { fieldErrors: z.flattenError(error).fieldErrors };
}
