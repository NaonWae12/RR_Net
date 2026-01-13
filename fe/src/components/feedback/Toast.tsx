"use client";

import * as React from "react";
import { toast as sonnerToast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastProps {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  progress?: boolean;
}

export interface ToastOptions {
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
  duration?: number;
}

const toastIcons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function toast({ type, title, message, duration = 5000, action, progress }: ToastProps) {
  const Icon = toastIcons[type];

  return sonnerToast[type](title, {
    description: message,
    duration,
    icon: <Icon className="h-4 w-4" />,
    action: action
      ? {
          label: action.label,
          onClick: action.onClick,
        }
      : undefined,
    ...(progress && {
      // Progress bar can be added via sonner's custom render
    }),
  });
}

// Convenience functions
export const toastSuccess = (title: string, message?: string, options?: ToastOptions) =>
  toast({ type: "success", title, message, duration: options?.duration });

export const toastError = (title: string, message?: string, options?: ToastOptions) =>
  toast({ type: "error", title, message, duration: options?.duration });

export const toastWarning = (title: string, message?: string, options?: ToastOptions) =>
  toast({ type: "warning", title, message, duration: options?.duration });

export const toastInfo = (title: string, message?: string, options?: ToastOptions) =>
  toast({ type: "info", title, message, duration: options?.duration });

// Toast Container Component
export interface ToastContainerProps {
  position?: ToastOptions["position"];
  richColors?: boolean;
}

export function ToastContainer({ position = "top-right", richColors = true }: ToastContainerProps) {
  // This is handled by Toaster component from sonner
  // This is just for type consistency
  return null;
}

