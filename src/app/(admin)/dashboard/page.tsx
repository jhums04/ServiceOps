import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Dashboard | ServiceOps" };

export default function DashboardPage() {
  return <PageHeader title="Dashboard" />;
}
