import { PageHeader } from "@/components/layout/page-header";
import { TableSkeleton } from "@/components/table-skeleton";

export default function Loading() {
  return (
    <>
      <PageHeader title="Customers" />
      <TableSkeleton />
    </>
  );
}
