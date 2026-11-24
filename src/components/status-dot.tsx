import { cn } from "@/lib/utils";

export type StatusTone = "amber" | "green" | "red" | "gray";

const toneClass: Record<StatusTone, string> = {
  amber: "bg-status-amber",
  green: "bg-status-green",
  red: "bg-status-red",
  gray: "bg-status-gray",
};

export function StatusDot({
  tone,
  label,
}: {
  tone: StatusTone;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", toneClass[tone])}
      />
      {label}
    </span>
  );
}
