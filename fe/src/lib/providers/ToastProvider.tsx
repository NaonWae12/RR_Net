"use client";

import { Toaster } from "@/components/ui/sonner";

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
};

