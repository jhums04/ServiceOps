import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeader title="Calendar" />
      <Skeleton className="mb-4 h-9 w-full max-w-md" />
      <Skeleton className="h-[600px] w-full" />
    </>
  );
}
