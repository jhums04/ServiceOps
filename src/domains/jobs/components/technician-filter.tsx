"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { JobFormOptions } from "../queries";

const ALL = "all";

export function TechnicianFilter({
  value,
  technicians,
}: {
  value?: string;
  technicians: JobFormOptions["technicians"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <Select
      value={value ?? ALL}
      onValueChange={(technician) => {
        const params = new URLSearchParams(searchParams);
        if (technician === ALL) params.delete("technician");
        else params.set("technician", technician);
        const query = params.toString();
        startTransition(() =>
          router.replace(query ? `${pathname}?${query}` : pathname),
        );
      }}
    >
      <SelectTrigger aria-label="Technician" className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All technicians</SelectItem>
        {technicians.map((technician) => (
          <SelectItem key={technician.id} value={technician.id}>
            {technician.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
