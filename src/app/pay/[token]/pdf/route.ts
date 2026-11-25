import { renderInvoicePdf } from "@/domains/invoices/invoice-pdf";
import {
  getPublicInvoice,
  publicInvoicePdfData,
} from "@/domains/invoices/queries";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/pay/[token]/pdf">,
) {
  const { token } = await params;
  const invoice = await getPublicInvoice(token);
  if (!invoice)
    return Response.json({ error: "Invoice not found." }, { status: 404 });
  return renderInvoicePdf(publicInvoicePdfData(invoice));
}
