import { describe, expect, it } from "vitest";

import { dashboardRange } from "@/domains/dashboard/range";

describe("dashboardRange", () => {
  it("covers the last N days through today, end exclusive", () => {
    expect(dashboardRange("7d", "2026-11-25")).toEqual({
      from: "2026-11-19",
      to: "2026-11-26",
      bucket: "day",
    });
    expect(dashboardRange("30d", "2026-11-25").from).toBe("2026-10-27");
    expect(dashboardRange("90d", "2026-11-25").from).toBe("2026-08-28");
  });

  it("covers twelve whole months ending with the current one", () => {
    expect(dashboardRange("12m", "2026-11-25")).toEqual({
      from: "2025-12-01",
      to: "2026-11-26",
      bucket: "month",
    });
    expect(dashboardRange("12m", "2026-01-31").from).toBe("2025-02-01");
  });

  it("crosses month and year boundaries", () => {
    expect(dashboardRange("7d", "2026-03-02").from).toBe("2026-02-24");
    expect(dashboardRange("7d", "2026-12-31").to).toBe("2027-01-01");
  });
});
