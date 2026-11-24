import { z } from "zod";

import { optionalText, requiredText } from "@/lib/forms";

export const memberSchema = z.object({
  id: z.uuid(),
  full_name: requiredText(200, "Enter the employee's name."),
  phone: optionalText(50),
});

export const memberActiveSchema = z.object({
  id: z.uuid(),
  is_active: z.boolean(),
});
