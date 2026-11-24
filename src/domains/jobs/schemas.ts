import { z } from "zod";

import { isValidDate } from "@/lib/dates";
import { optionalText, requiredText } from "@/lib/forms";
import { parseMoneyToCents } from "@/lib/money";
import { firstValue, pageParam } from "@/lib/search-params";

import { JOB_STATUSES } from "./status";

export const DURATION_OPTIONS = [
  30, 60, 90, 120, 150, 180, 240, 300, 360, 480,
] as const;
export const UNASSIGNED = "unassigned";

/** Fields that can change at any status. */
export const jobDetailsSchema = z.object({
  id: z.uuid().optional(),
  service: requiredText(200, "Enter the service."),
  description: optionalText(2000),
  price: z.string().transform((value, context) => {
    const cents = parseMoneyToCents(value);
    if (cents === null) {
      context.addIssue({
        code: "custom",
        message: "Enter a price like 189 or 189.50.",
      });
      return z.NEVER;
    }
    return cents;
  }),
});

/** Fields that can change only while the job is scheduled. */
export const jobScheduleSchema = z.object({
  customer_id: z.uuid("Choose a customer."),
  date: z.string().refine(isValidDate, "Choose a date."),
  start_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a start time."),
  duration_minutes: z.coerce
    .number<string>()
    .refine(
      (value) => (DURATION_OPTIONS as readonly number[]).includes(value),
      {
        message: "Choose a duration.",
      },
    ),
  technician_id: z
    .union(
      [z.uuid(), z.literal(UNASSIGNED)],
      "Choose a technician or leave it unassigned.",
    )
    .transform((value) => (value === UNASSIGNED ? null : value)),
});

export const jobListParamsSchema = z.object({
  status: firstValue.transform((value) =>
    JOB_STATUSES.find((status) => status === value),
  ),
  technician: firstValue.transform((value) =>
    value === UNASSIGNED || z.uuid().safeParse(value).success
      ? value
      : undefined,
  ),
  date: firstValue.transform((value) =>
    value && isValidDate(value) ? value : undefined,
  ),
  page: pageParam,
});

export type JobListParams = z.infer<typeof jobListParamsSchema>;

export const calendarParamsSchema = z.object({
  week: firstValue.transform((value) =>
    value && isValidDate(value) ? value : undefined,
  ),
  technician: firstValue.transform((value) =>
    z.uuid().safeParse(value).success ? value : undefined,
  ),
});
