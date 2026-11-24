import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ServiceOps",
  description:
    "Scheduling, invoicing, and payments for field-service businesses.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
