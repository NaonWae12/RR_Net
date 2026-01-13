"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export interface FormValidationProps {
  showErrors?: boolean;
  className?: string;
}

export function FormValidation({ showErrors = true, className }: FormValidationProps) {
  const {
    formState: { errors },
  } = useFormContext();

  if (!showErrors || Object.keys(errors).length === 0) {
    return null;
  }

  const errorMessages = Object.entries(errors).map(([key, error]) => ({
    field: key,
    message: (error as any)?.message || "Validation error",
  }));

  return (
    <div className={className}>
      {errorMessages.map((error, index) => (
        <Alert key={index} variant="destructive" className="mb-2">
          <AlertCircle className="h-4 w-4" />
          <span className="ml-2">
            <strong>{error.field}:</strong> {error.message}
          </span>
        </Alert>
      ))}
    </div>
  );
}

