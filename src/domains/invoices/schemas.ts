import { z } from "zod";

import { firstValue, pageParam } from "@/lib/search-params";

export const INVOICE_FILTERS = ["unpaid", "overdue", "paid", "void"] as const;

export const invoiceListParamsSchema = z.object({
  status: firstValue.transform((value) =>
    INVOICE_FILTERS.find((filter) => filter === value),
  ),
  invoice: firstValue.transform((value) =>
    z.uuid().safeParse(value).success ? value : undefined,
  ),
  page: pageParam,
});

export type InvoiceListParams = z.infer<typeof invoiceListParamsSchema>;
