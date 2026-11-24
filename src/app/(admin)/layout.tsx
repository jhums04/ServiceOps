import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const member = await requireAdmin();
  return <AppShell member={member}>{children}</AppShell>;
}
