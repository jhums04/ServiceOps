"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCalendarDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function RevenueChart({
  data,
  bucket,
}: {
  data: { bucket_start: string; revenue_cents: number }[];
  bucket: "day" | "month";
}) {
  const label = (date: string) =>
    bucket === "day"
      ? formatCalendarDate(date, { month: "short", day: "numeric" })
      : formatCalendarDate(date, { month: "short", year: "numeric" });
  const fullLabel = (date: string) =>
    bucket === "day"
      ? formatCalendarDate(date, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : formatCalendarDate(date, { month: "long", year: "numeric" });

  return (
    <>
      {/* The chart is visual only; the table below carries the same figures for screen readers. */}
      <div aria-hidden className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            accessibilityLayer={false}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="bucket_start"
              tickFormatter={label}
              tickLine={false}
              axisLine={false}
              minTickGap={16}
              fontSize={12}
              stroke="var(--muted-foreground)"
            />
            <YAxis
              tickFormatter={(cents: number) => compactUsd.format(cents / 100)}
              tickLine={false}
              axisLine={false}
              width={56}
              fontSize={12}
              stroke="var(--muted-foreground)"
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              labelFormatter={(value) => fullLabel(String(value))}
              formatter={(value) => [formatMoney(Number(value)), "Revenue"]}
              contentStyle={{
                borderRadius: 8,
                borderColor: "var(--border)",
                fontSize: 13,
              }}
            />
            <Bar
              dataKey="revenue_cents"
              fill="var(--color-chart-1)"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Revenue received by {bucket}</caption>
        <thead>
          <tr>
            <th scope="col">{bucket === "day" ? "Day" : "Month"}</th>
            <th scope="col">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.bucket_start}>
              <th scope="row">{fullLabel(row.bucket_start)}</th>
              <td>{formatMoney(row.revenue_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
