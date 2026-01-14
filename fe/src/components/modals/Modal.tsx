"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface AnimationConfig {
  type?: "fade" | "slide" | "scale";
  duration?: number;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  backdrop?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  animation?: AnimationConfig;
  className?: string;
  children: React.ReactNode;
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-full mx-4",
};

export function Modal({
  isOpen,
  onClose,
  size = "md",
  backdrop = true,
  closeOnEscape = true,
  closeOnBackdrop = true,
  title,
  subtitle,
  footer,
  animation = { type: "fade", duration: 200 },
  className,
  children,
}: ModalProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        {backdrop && (
          <DialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 z-50 bg-black/50",
              animation.type === "fade" && "animate-in fade-in-0",
              animation.type === "slide" && "animate-in slide-in-from-bottom-4",
              animation.type === "scale" && "animate-in zoom-in-95"
            )}
            onClick={closeOnBackdrop ? onClose : undefined}
          />
        )}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
            sizeClasses[size],
            animation.type === "fade" && "animate-in fade-in-0 zoom-in-95",
            animation.type === "slide" && "animate-in slide-in-from-bottom-4",
            animation.type === "scale" && "animate-in zoom-in-95",
            className
          )}
          onEscapeKeyDown={closeOnEscape ? onClose : undefined}
          onPointerDownOutside={closeOnBackdrop ? onClose : undefined}
          onInteractOutside={closeOnBackdrop ? onClose : undefined}
        >
          {(title || subtitle) && (
            <div className="flex items-center justify-between">
              <div>
                {title && (
                  <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {subtitle && (
                  <DialogPrimitive.Description className="mt-2 text-sm text-slate-600">
                    {subtitle}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogPrimitive.Close>
            </div>
          )}

          <div className="overflow-y-auto max-h-[calc(100vh-200px)]">{children}</div>

          {footer && <div className="flex items-center justify-end gap-2 border-t pt-4">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

