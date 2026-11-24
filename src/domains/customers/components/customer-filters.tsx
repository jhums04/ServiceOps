"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toQueryString } from "@/lib/search-params";

export function CustomerFilters({
  q,
  outstanding,
}: {
  q: string;
  outstanding: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function navigate(next: { q: string; outstanding: boolean }) {
    const query = toQueryString({
      q: next.q.trim(),
      outstanding: next.outstanding ? "1" : "",
    });
    startTransition(() => router.replace(`${pathname}${query}`));
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <div className="relative w-full max-w-sm">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search customers"
          placeholder="Search by name, email, or phone"
          className="pl-8"
          value={search}
          onChange={(event) => {
            const value = event.target.value;
            setSearch(value);
            clearTimeout(timer.current);
            timer.current = setTimeout(
              () => navigate({ q: value, outstanding }),
              300,
            );
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="outstanding"
          checked={outstanding}
          onCheckedChange={(checked) =>
            navigate({ q: search, outstanding: checked })
          }
        />
        <Label htmlFor="outstanding">Has outstanding balance</Label>
      </div>
    </div>
  );
}
