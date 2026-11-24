/** Positions overlapping jobs side by side: each job gets a lane within its overlap group. */
export function assignLanes<T extends { start: number; end: number }>(
  items: T[],
) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: (T & { lane: number; lanes: number })[] = [];
  let group: (T & { lane: number; lanes: number })[] = [];
  let groupEnd = -Infinity;
  let laneEnds: number[] = [];

  const closeGroup = () => {
    for (const item of group) item.lanes = laneEnds.length;
    placed.push(...group);
    group = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (item.start >= groupEnd) {
      closeGroup();
      groupEnd = -Infinity;
    }
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    group.push({ ...item, lane, lanes: 0 });
    groupEnd = Math.max(groupEnd, item.end);
  }
  closeGroup();
  return placed;
}
