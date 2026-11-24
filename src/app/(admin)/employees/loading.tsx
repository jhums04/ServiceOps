import { PageHeader } from "@/components/layout/page-header";
import { TableSkeleton } from "@/components/table-skeleton";

export default function Loading() {
  return (
    <>
      <PageHeader title="Employees" />
      <TableSkeleton rows={5} />
    </>
  );
}
