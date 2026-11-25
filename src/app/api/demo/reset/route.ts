import { revalidatePath } from "next/cache";

import { isAuthorizedReset, resetDemo } from "@/domains/demo/reset";

export async function POST(request: Request) {
  if (!isAuthorizedReset(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await resetDemo();
  revalidatePath("/", "layout");
  return Response.json({ reset: true });
}
