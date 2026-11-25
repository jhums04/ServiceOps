import { z } from "zod";

import { renderInvoicePdf } from "@/domains/invoices/invoice-pdf";
import { getInvoicePdfData } from "@/domains/invoices/queries";
import { getCurrentMember } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/invoices/[id]/pdf">,
) {
  const { id } = await params;

  // Route handlers under /api are not guarded by the proxy, so check access here.
  const member = await getCurrentMember();
  if (!member)
    return Response.json(
      { error: "Sign in to download invoices." },
      { status: 401 },
    );
  if (member.role !== "admin") {
    return Response.json(
      { error: "Only administrators can download invoices." },
      { status: 403 },
    );
  }
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "Invoice not found." }, { status: 404 });
  }

  const invoice = await getInvoicePdfData(id, member.organization);
  if (!invoice)
    return Response.json({ error: "Invoice not found." }, { status: 404 });
  return renderInvoicePdf(invoice);
}
