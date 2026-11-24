"use client";

import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDuration } from "@/lib/dates";

import type { MemberRow } from "../queries";
import { ActiveSwitch } from "./active-switch";
import { MemberSheet } from "./member-sheet";

const roleLabel = { admin: "Administrator", technician: "Technician" } as const;

export function EmployeesTable({
  members,
  currentMemberId,
}: {
  members: MemberRow[];
  currentMemberId: string;
}) {
  const [editing, setEditing] = useState<MemberRow | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Assigned this week</TableHead>
            <TableHead className="w-24">Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow
              key={member.id}
              className="cursor-pointer"
              onClick={() => setEditing(member)}
            >
              <TableCell className="font-medium">
                <button
                  type="button"
                  className="hover:underline"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditing(member);
                  }}
                >
                  {member.full_name}
                </button>
              </TableCell>
              <TableCell>{roleLabel[member.role]}</TableCell>
              <TableCell>{member.phone}</TableCell>
              <TableCell className="text-right tabular-nums">
                {member.role === "technician"
                  ? formatDuration(member.week_minutes)
                  : "-"}
              </TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                <ActiveSwitch
                  member={member}
                  isSelf={member.id === currentMemberId}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <MemberSheet
        member={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </>
  );
}
