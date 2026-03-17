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
              "fixed inset-0 z-[10000] bg-black/50",
              animation.type === "fade" && "animate-in fade-in-0",
              animation.type === "slide" && "animate-in slide-in-from-bottom-4",
              animation.type === "scale" && "animate-in zoom-in-95"
            )}
            onClick={closeOnBackdrop ? onClose : undefined}
          />
        )}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-[10000] grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border border-[#e2e8f0] bg-[#ffffff] p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] duration-200 sm:rounded-2xl",
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
            <div className="flex items-center justify-between pb-2">
              <div>
                {title && (
                  <DialogPrimitive.Title className="text-2xl font-bold leading-tight text-[#0f172a]">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {subtitle && (
                  <DialogPrimitive.Description className="mt-1.5 text-sm font-medium text-[#64748b]">
                    {subtitle}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-[#f1f5f9] text-[#94a3b8] hover:text-[#0f172a] transition-all">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogPrimitive.Close>
            </div>
          )}

          <div className="overflow-y-auto max-h-[calc(100vh-200px)]">{children}</div>

          {footer && <div className="flex items-center justify-end gap-3 border-t border-[#f1f5f9] pt-6 mt-2">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

