"use client";

import * as React from "react";
import { Modal } from "./Modal";
import { FormGenerator, FormSchema } from "@/components/forms/FormGenerator";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export interface FormConfig {
  schema: FormSchema;
  initialValues?: Record<string, any>;
  validation?: any;
}

export interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormConfig;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  submitText?: string;
  cancelText?: string;
  resetOnClose?: boolean;
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
}

export function FormModal({
  isOpen,
  onClose,
  form,
  onSubmit,
  submitText = "Submit",
  cancelText = "Cancel",
  resetOnClose = true,
  title,
  subtitle,
  size = "md",
  className,
}: FormModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formKey, setFormKey] = React.useState(0);

  React.useEffect(() => {
    if (!isOpen && resetOnClose) {
      setFormKey((prev) => prev + 1);
      setError(null);
    }
  }, [isOpen, resetOnClose]);

  const handleSubmit = async (values: Record<string, any>) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={size}
      title={title}
      subtitle={subtitle}
      className={className || "bg-white"}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {cancelText}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="ml-2">{error}</span>
          </Alert>
        )}
        <FormGenerator
          key={formKey}
          schema={form.schema}
          initialValues={form.initialValues}
          onSubmit={handleSubmit}
          validation={form.validation}
          submitText={submitText}
          showActions={true}
        />
      </div>
    </Modal>
  );
}

