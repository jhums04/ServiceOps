import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { LinkRow } from "@/components/link-row";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerFilters } from "@/domains/customers/components/customer-filters";
import { CustomerSheet } from "@/domains/customers/components/customer-sheet";
import {
  CUSTOMERS_PAGE_SIZE,
  listCustomers,
} from "@/domains/customers/queries";
import { customerListParamsSchema } from "@/domains/customers/schemas";
import { formatMoney } from "@/lib/money";
import { toQueryString } from "@/lib/search-params";

export const metadata: Metadata = { title: "Customers | ServiceOps" };

export default async function CustomersPage({
  searchParams,
}: PageProps<"/customers">) {
  const params = customerListParamsSchema.parse(await searchParams);
  const { customers, total } = await listCustomers(params);
  const filtered = params.q !== "" || params.outstanding;

  const newCustomer = (
    <Button>
      <Plus aria-hidden />
      New customer
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Customers"
        actions={<CustomerSheet trigger={newCustomer} />}
      />
      <CustomerFilters q={params.q} outstanding={params.outstanding} />

      {customers.length === 0 ? (
        filtered ? (
          <EmptyState message="No customers match these filters." />
        ) : (
          <EmptyState
            message="No customers yet."
            action={<CustomerSheet trigger={newCustomer} />}
          />
        )
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <LinkRow key={customer.id} href={`/customers/${customer.id}`}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="hover:underline"
                    >
                      {customer.name}
                    </Link>
                  </TableCell>
                  <TableCell>{customer.email}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.city}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {customer.outstanding_cents > 0
                      ? formatMoney(customer.outstanding_cents)
                      : "-"}
                  </TableCell>
                </LinkRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={params.page}
            pageSize={CUSTOMERS_PAGE_SIZE}
            total={total}
            hrefForPage={(page) =>
              `/customers${toQueryString({ q: params.q, outstanding: params.outstanding ? "1" : "", page })}`
            }
          />
        </>
      )}
    </>
  );
}
