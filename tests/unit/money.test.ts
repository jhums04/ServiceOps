import { describe, expect, it } from "vitest";

import { centsToInput, formatMoney, parseMoneyToCents } from "@/lib/money";

describe("formatMoney", () => {
  it("formats cents as US dollars", () => {
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(189000)).toBe("$1,890.00");
    expect(formatMoney(12345)).toBe("$123.45");
  });
});

describe("parseMoneyToCents", () => {
  it.each([
    ["189", 18900],
    ["189.5", 18950],
    ["189.05", 18905],
    ["$1,890.00", 189000],
    [" 0.99 ", 99],
    ["0", 0],
  ])("parses %s", (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "1.234", "-5", "1e3", "12345678"])(
    "rejects %s",
    (input) => {
      expect(parseMoneyToCents(input)).toBeNull();
    },
  );

  it("round-trips through the input format", () => {
    for (const cents of [0, 5, 50, 99, 100, 18905, 189000]) {
      expect(parseMoneyToCents(centsToInput(cents))).toBe(cents);
    }
  });
});
