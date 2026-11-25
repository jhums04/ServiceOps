import { z } from "zod";

import { firstValue } from "@/lib/search-params";

import { DEFAULT_RANGE, RANGE_PRESETS } from "./range";

export const dashboardParamsSchema = z.object({
  range: firstValue.transform(
    (value) =>
      RANGE_PRESETS.find((preset) => preset === value) ?? DEFAULT_RANGE,
  ),
});
