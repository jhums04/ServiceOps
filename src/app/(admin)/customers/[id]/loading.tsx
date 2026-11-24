import { TableSkeleton } from "@/components/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <Skeleton className="mb-6 h-9 w-64" />
      <Skeleton className="mb-8 h-14 w-full" />
      <TableSkeleton rows={5} />
    </>
  );
}
