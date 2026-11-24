import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  await requireAdmin();
  return children;
}
