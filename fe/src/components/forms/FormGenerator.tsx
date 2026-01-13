"use client";

import * as React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField, FormFieldProps } from "./FormField";
import { FormSection } from "./FormSection";
import { FormActions } from "./FormActions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FormSchema {
  [key: string]: {
    type: FormFieldProps["type"];
    label: string;
    placeholder?: string;
    helpText?: string;
    validation?: FormFieldProps["validation"];
    conditional?: FormFieldProps["conditional"];
    options?: FormFieldProps["options"];
    disabled?: boolean;
    render?: FormFieldProps["render"];
    section?: string;
  };
}

export interface FormGeneratorProps {
  schema: FormSchema;
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  onFieldChange?: (field: string, value: any) => void;
  validation?: z.ZodSchema;
  multiStep?: boolean;
  autoSave?: boolean;
  submitText?: string;
  resetText?: string;
  className?: string;
  showActions?: boolean;
}

export const FormGenerator = React.memo(function FormGenerator({
  schema,
  initialValues = {},
  onSubmit,
  onFieldChange,
  validation,
  multiStep = false,
  autoSave = false,
  submitText = "Submit",
  resetText = "Reset",
  className,
  showActions = true,
}: FormGeneratorProps) {
  // Build Zod schema from form schema
  const buildZodSchema = (): z.ZodSchema => {
    if (validation) return validation;

    const shape: Record<string, z.ZodTypeAny> = {};
    Object.entries(schema).forEach(([key, field]) => {
      let fieldSchema: z.ZodTypeAny = z.any();

      switch (field.type) {
        case "text":
        case "email":
        case "password":
        case "textarea":
          fieldSchema = z.string();
          break;
        case "number":
          fieldSchema = z.number();
          break;
        case "checkbox":
        case "switch":
          fieldSchema = z.boolean();
          break;
        case "date":
        case "time":
        case "datetime":
          fieldSchema = z.string().or(z.date());
          break;
        default:
          fieldSchema = z.any();
      }

      // Apply validation rules
      if (field.validation) {
        field.validation.forEach((rule) => {
          if (rule.type === "required") {
            fieldSchema = fieldSchema.refine((val) => val !== undefined && val !== null && val !== "", {
              message: rule.message,
            });
          } else if (rule.type === "min" && typeof rule.value === "number") {
            if (field.type === "number") {
              fieldSchema = (fieldSchema as z.ZodNumber).min(rule.value, rule.message);
            } else {
              fieldSchema = (fieldSchema as z.ZodString).min(rule.value, rule.message);
            }
          } else if (rule.type === "max" && typeof rule.value === "number") {
            if (field.type === "number") {
              fieldSchema = (fieldSchema as z.ZodNumber).max(rule.value, rule.message);
            } else {
              fieldSchema = (fieldSchema as z.ZodString).max(rule.value, rule.message);
            }
          } else if (rule.type === "email") {
            fieldSchema = (fieldSchema as z.ZodString).email(rule.message);
          } else if (rule.type === "pattern" && rule.value) {
            fieldSchema = (fieldSchema as z.ZodString).regex(rule.value, rule.message);
          }
        });
      }

      shape[key] = fieldSchema.optional();
    });

    return z.object(shape);
  };

  const methods = useForm({
    resolver: zodResolver(buildZodSchema()),
    defaultValues: initialValues,
    mode: "onChange",
  });

  const { handleSubmit, watch, reset } = methods;

  // Auto-save functionality
  React.useEffect(() => {
    if (!autoSave) return;

    const subscription = watch((value) => {
      const timeoutId = setTimeout(() => {
        // Auto-save logic here
        console.log("Auto-saving:", value);
      }, 1000);

      return () => clearTimeout(timeoutId);
    });

    return () => subscription.unsubscribe();
  }, [watch, autoSave]);

  // Handle field changes
  const handleFieldChange = (field: string, value: any) => {
    onFieldChange?.(field, value);
  };

  // Group fields by section
  const fieldsBySection = React.useMemo(() => {
    const grouped: Record<string, Array<[string, FormSchema[string]]>> = {};
    const ungrouped: Array<[string, FormSchema[string]]> = [];

    Object.entries(schema).forEach(([key, field]) => {
      if (field.section) {
        if (!grouped[field.section]) {
          grouped[field.section] = [];
        }
        grouped[field.section].push([key, field]);
      } else {
        ungrouped.push([key, field]);
      }
    });

    return { grouped, ungrouped };
  }, [schema]);

  const onSubmitForm = async (values: Record<string, any>) => {
    try {
      await onSubmit(values);
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(onSubmitForm)}
        className={cn("space-y-6", className)}
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          if (target.name) {
            handleFieldChange(target.name, target.value);
          }
        }}
      >
        {/* Render grouped sections */}
        {Object.entries(fieldsBySection.grouped).map(([sectionName, fields]) => (
          <FormSection key={sectionName} title={sectionName}>
            {fields.map(([key, field]) => (
              <FormField
                key={key}
                name={key}
                type={field.type}
                label={field.label}
                placeholder={field.placeholder}
                helpText={field.helpText}
                validation={field.validation}
                conditional={field.conditional}
                options={field.options}
                disabled={field.disabled}
                render={field.render}
              />
            ))}
          </FormSection>
        ))}

        {/* Render ungrouped fields */}
        {fieldsBySection.ungrouped.map(([key, field]) => (
          <FormField
            key={key}
            name={key}
            type={field.type}
            label={field.label}
            placeholder={field.placeholder}
            helpText={field.helpText}
            validation={field.validation}
            conditional={field.conditional}
            options={field.options}
            disabled={field.disabled}
            render={field.render}
          />
        ))}

        {showActions && (
          <FormActions
            submitText={submitText}
            resetText={resetText}
            onReset={() => reset(initialValues)}
            loading={methods.formState.isSubmitting}
          />
        )}
      </form>
    </FormProvider>
  );
});

FormGenerator.displayName = "FormGenerator";

