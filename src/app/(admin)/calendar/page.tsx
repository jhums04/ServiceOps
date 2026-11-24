import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Calendar | ServiceOps" };

export default function CalendarPage() {
  return <PageHeader title="Calendar" />;
}
