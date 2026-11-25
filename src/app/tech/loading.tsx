import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-busy aria-label="Loading" className="space-y-3">
      <Skeleton className="h-8 w-32" />
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-24 w-full" />
      ))}
    </div>
  );
}
