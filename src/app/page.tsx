import { redirect } from "next/navigation";

import { getMember, homePathFor } from "@/lib/auth";

export default async function Home() {
  const member = await getMember();
  redirect(homePathFor(member.role));
}
