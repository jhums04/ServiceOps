import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy aria-label="Loading" className="space-y-2">
      <Skeleton className="h-9 w-full max-w-md" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
