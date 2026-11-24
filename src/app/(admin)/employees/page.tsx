import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { EmployeesTable } from "@/domains/employees/components/employees-table";
import { listMembers } from "@/domains/employees/queries";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Employees | ServiceOps" };

export default async function EmployeesPage() {
  const member = await requireAdmin();
  const members = await listMembers(member.organization.time_zone);

  return (
    <>
      <PageHeader title="Employees" />
      <EmployeesTable members={members} currentMemberId={member.id} />
    </>
  );
}
