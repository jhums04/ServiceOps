"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { JobFormOptions } from "../queries";
import { JobSheet } from "./job-sheet";

export function NewJobButton({
  options,
  timeZone,
  defaultDate,
}: {
  options: JobFormOptions;
  timeZone: string;
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        New job
      </Button>
      <JobSheet
        open={open}
        onOpenChange={setOpen}
        job={null}
        options={options}
        timeZone={timeZone}
        defaultDate={defaultDate}
      />
    </>
  );
}
