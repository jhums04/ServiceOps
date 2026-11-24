import { redirect } from "next/navigation";

import { TechnicianShell } from "@/components/layout/technician-shell";
import { getMember, homePathFor } from "@/lib/auth";

export default async function TechnicianLayout({
  children,
}: LayoutProps<"/tech">) {
  const member = await getMember();
  if (member.role !== "technician") redirect(homePathFor(member.role));
  return <TechnicianShell member={member}>{children}</TechnicianShell>;
}
