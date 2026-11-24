import { describe, expect, it } from "vitest";

import { assignLanes } from "@/domains/jobs/calendar-layout";

const lanesOf = (items: { start: number; end: number }[]) =>
  assignLanes(items.map((item, index) => ({ ...item, id: index })))
    .sort((a, b) => a.id - b.id)
    .map(({ lane, lanes }) => [lane, lanes]);

describe("assignLanes", () => {
  it("keeps separate jobs full width", () => {
    expect(
      lanesOf([
        { start: 0, end: 60 },
        { start: 60, end: 120 },
      ]),
    ).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("splits overlapping jobs into lanes", () => {
    expect(
      lanesOf([
        { start: 0, end: 120 },
        { start: 30, end: 90 },
        { start: 90, end: 150 },
      ]),
    ).toEqual([
      [0, 2],
      [1, 2],
      [1, 2],
    ]);
  });
});
