import { redirect } from "next/navigation";

import { getMember, homePathFor } from "@/lib/auth";

export default async function TechnicianLayout({
  children,
}: LayoutProps<"/tech">) {
  const member = await getMember();
  if (member.role !== "technician") redirect(homePathFor(member.role));
  return children;
}
