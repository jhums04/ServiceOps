import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Jobs | ServiceOps" };

export default function JobsPage() {
  return <PageHeader title="Jobs" />;
}
