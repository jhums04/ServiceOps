import { z } from "zod";

import { firstValue, pageParam } from "@/lib/search-params";
import { optionalText, requiredText } from "@/lib/forms";

export const customerSchema = z.object({
  id: z.uuid().optional(),
  name: requiredText(200, "Enter the customer's name."),
  email: optionalText(320).pipe(
    z.email("Enter a valid email address.").nullable(),
  ),
  phone: optionalText(50),
  street: optionalText(200),
  city: optionalText(100),
  state: optionalText(100),
  postal_code: optionalText(20),
});

export const customerListParamsSchema = z.object({
  q: firstValue.transform((value) => value?.trim() ?? ""),
  outstanding: firstValue.transform((value) => value === "1"),
  page: pageParam,
});

export type CustomerListParams = z.infer<typeof customerListParamsSchema>;
