import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Customers | ServiceOps" };

export default function CustomersPage() {
  return <PageHeader title="Customers" />;
}
