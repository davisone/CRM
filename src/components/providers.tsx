"use client";

import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/lib/use-toast";
import { Toaster } from "@/components/ui/toaster";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
