import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Invoices | ServiceOps" };

export default function InvoicesPage() {
  return <PageHeader title="Invoices" />;
}
