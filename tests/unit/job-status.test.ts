import { describe, expect, it } from "vitest";

import { canTransition, JOB_STATUSES } from "@/domains/jobs/status";

describe("canTransition", () => {
  const allowed = new Set([
    "scheduled>in_progress",
    "scheduled>cancelled",
    "in_progress>completed",
    "in_progress>cancelled",
  ]);

  for (const from of JOB_STATUSES) {
    for (const to of JOB_STATUSES) {
      const key = `${from}>${to}`;
      it(`${allowed.has(key) ? "allows" : "rejects"} ${from} -> ${to}`, () => {
        expect(canTransition(from, to)).toBe(allowed.has(key));
      });
    }
  }
});
