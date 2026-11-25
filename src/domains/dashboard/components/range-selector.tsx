import Link from "next/link";

import { cn } from "@/lib/utils";

import { RANGE_LABELS, RANGE_PRESETS, type RangePreset } from "../range";

export function RangeSelector({ current }: { current: RangePreset }) {
  return (
    <nav aria-label="Date range">
      <ul className="flex rounded-md border p-0.5">
        {RANGE_PRESETS.map((preset) => (
          <li key={preset}>
            <Link
              href={`/dashboard?range=${preset}`}
              aria-current={preset === current ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center rounded-[4px] px-2.5 text-[13px] whitespace-nowrap text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                preset === current && "bg-muted font-medium text-foreground",
              )}
            >
              {RANGE_LABELS[preset]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
