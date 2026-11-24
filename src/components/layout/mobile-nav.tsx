"use client";

import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { SidebarNav } from "./sidebar-nav";

export function MobileNav({ footer }: { footer: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-56 gap-0 bg-sidebar p-3">
        <SheetTitle className="px-2.5 pt-1 pb-4 text-base font-semibold">
          ServiceOps
        </SheetTitle>
        <SidebarNav onNavigate={() => setOpen(false)} />
        <div className="mt-auto border-t border-sidebar-border pt-3">
          {footer}
        </div>
      </SheetContent>
    </Sheet>
  );
}
