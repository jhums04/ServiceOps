const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatMoney(cents: number) {
  return usd.format(cents / 100);
}

/** Parses a dollar amount typed by a person ("1,250.5", "$89") into integer cents. */
export function parseMoneyToCents(input: string): number | null {
  const normalized = input.trim().replace(/^\$/, "").replaceAll(",", "");
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const [, dollars = "0", fraction = ""] = match;
  return Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Formats cents for a money input field, without currency symbol or grouping. */
export function centsToInput(cents: number) {
  const dollars = Math.trunc(cents / 100);
  const remainder = cents % 100;
  return remainder === 0
    ? String(dollars)
    : `${dollars}.${String(remainder).padStart(2, "0")}`;
}
