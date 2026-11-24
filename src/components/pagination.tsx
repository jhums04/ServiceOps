import Link from "next/link";

import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageSize,
  total,
  hrefForPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefForPage: (page: number) => string;
}) {
  if (total <= pageSize) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const lastPage = Math.ceil(total / pageSize);

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex items-center justify-between gap-4"
    >
      <p className="text-muted-foreground tabular-nums">
        {first}-{last} of {total}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={hrefForPage(page - 1)}>Previous</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        )}
        {page < lastPage ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={hrefForPage(page + 1)}>Next</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </nav>
  );
}
