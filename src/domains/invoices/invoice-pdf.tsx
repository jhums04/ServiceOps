import "server-only";

import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatCalendarDate, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export type InvoicePdfData = {
  number: number;
  status: "unpaid" | "paid" | "void";
  lineDescription: string;
  amountCents: number;
  issuedAt: string;
  dueOn: string;
  paidAt: string | null;
  organizationName: string;
  timeZone: string;
  customer: {
    name: string;
    email: string | null;
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
  };
};

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1c1917",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  headerRight: { alignItems: "flex-end" },
  organization: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", textAlign: "right" },
  number: { fontFamily: "Courier", textAlign: "right", marginTop: 4 },
  muted: { color: "#57534e" },
  section: { marginBottom: 24 },
  label: { color: "#57534e", marginBottom: 4 },
  meta: { flexDirection: "row", gap: 32, marginBottom: 24 },
  table: { borderTop: "1pt solid #e7e5e4", borderBottom: "1pt solid #e7e5e4" },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottom: "1pt solid #e7e5e4",
    color: "#57534e",
  },
  tableRow: { flexDirection: "row", paddingVertical: 10 },
  description: { flex: 1 },
  amount: { width: 120, textAlign: "right" },
  total: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  status: { marginTop: 32, fontFamily: "Helvetica-Bold" },
});

function statusLine(invoice: InvoicePdfData) {
  if (invoice.status === "paid" && invoice.paidAt) {
    return `Paid on ${formatDate(invoice.paidAt, invoice.timeZone)}. Thank you.`;
  }
  if (invoice.status === "void") return "This invoice has been voided.";
  return `Payment due by ${formatCalendarDate(invoice.dueOn, { month: "long", day: "numeric", year: "numeric" })}.`;
}

function InvoiceDocument({ invoice }: { invoice: InvoicePdfData }) {
  const { customer } = invoice;
  const cityLine = [
    customer.city,
    [customer.state, customer.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Document
      title={`Invoice ${invoice.number}`}
      author={invoice.organizationName}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.organization}>{invoice.organizationName}</Text>
          <View style={styles.headerRight}>
            <Text style={styles.title}>Invoice</Text>
            <Text style={styles.number}>{invoice.number}</Text>
          </View>
        </View>

        <View style={styles.meta}>
          <View>
            <Text style={styles.label}>Issued</Text>
            <Text>{formatDate(invoice.issuedAt, invoice.timeZone)}</Text>
          </View>
          <View>
            <Text style={styles.label}>Due</Text>
            <Text>
              {formatCalendarDate(invoice.dueOn, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Bill to</Text>
          <Text>{customer.name}</Text>
          {customer.street && (
            <Text style={styles.muted}>{customer.street}</Text>
          )}
          {cityLine && <Text style={styles.muted}>{cityLine}</Text>}
          {customer.email && <Text style={styles.muted}>{customer.email}</Text>}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.description}>Description</Text>
            <Text style={styles.amount}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.description}>{invoice.lineDescription}</Text>
            <Text style={styles.amount}>
              {formatMoney(invoice.amountCents)}
            </Text>
          </View>
        </View>
        <View style={styles.total}>
          <Text>Total (USD) {formatMoney(invoice.amountCents)}</Text>
        </View>

        <Text style={styles.status}>{statusLine(invoice)}</Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(invoice: InvoicePdfData) {
  const buffer = await renderToBuffer(<InvoiceDocument invoice={invoice} />);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
