import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Employees | ServiceOps" };

export default function EmployeesPage() {
  return <PageHeader title="Employees" />;
}
