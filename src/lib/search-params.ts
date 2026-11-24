import { z } from "zod";

/** Search params arrive as string | string[] | undefined; keep the first value only. */
export const firstValue = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => (Array.isArray(value) ? value[0] : value));

export const pageParam = firstValue.transform((value) => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
});

/** Builds a query string from the given values, dropping empty ones. */
export function toQueryString(
  values: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Removes characters that carry meaning in PostgREST filter expressions. */
export function toSearchTerm(input: string) {
  return input
    .replace(/[,()*%\\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}
