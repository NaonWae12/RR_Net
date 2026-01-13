"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FormActionsProps {
  submitText?: string;
  resetText?: string;
  cancelText?: string;
  onReset?: () => void;
  onCancel?: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  align?: "left" | "right" | "center" | "between";
}

export function FormActions({
  submitText = "Submit",
  resetText = "Reset",
  cancelText,
  onReset,
  onCancel,
  loading = false,
  disabled = false,
  className,
  align = "right",
}: FormActionsProps) {
  const getAlignmentClass = () => {
    switch (align) {
      case "left":
        return "justify-start";
      case "center":
        return "justify-center";
      case "between":
        return "justify-between";
      default:
        return "justify-end";
    }
  };

  return (
    <div className={cn("flex items-center gap-2", getAlignmentClass(), className)}>
      {onCancel && (
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading || disabled}>
          {cancelText || "Cancel"}
        </Button>
      )}
      {onReset && (
        <Button type="button" variant="outline" onClick={onReset} disabled={loading || disabled}>
          {resetText}
        </Button>
      )}
      <Button type="submit" disabled={loading || disabled}>
        {loading ? "Submitting..." : submitText}
      </Button>
    </div>
  );
}

