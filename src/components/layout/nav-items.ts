import {
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  LayoutDashboard,
  UserCog,
  Users,
} from "lucide-react";

export const adminNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/employees", label: "Employees", icon: UserCog },
] as const;
