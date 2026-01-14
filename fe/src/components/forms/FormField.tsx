"use client";

import * as React from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

export type FieldType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "date"
  | "time"
  | "datetime"
  | "file"
  | "switch";

export interface ValidationRule {
  type: "required" | "min" | "max" | "pattern" | "email" | "custom";
  value?: any;
  message: string;
}

export interface ConditionalRule {
  field: string;
  operator: "equals" | "notEquals" | "greaterThan" | "lessThan" | "contains";
  value: any;
}

export interface FormFieldProps {
  name: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  validation?: ValidationRule[];
  conditional?: ConditionalRule[];
  disabled?: boolean;
  options?: Array<{ label: string; value: string | number }>;
  rows?: number;
  className?: string;
  render?: (props: any) => React.ReactNode;
}

export function FormField({
  name,
  type,
  label,
  placeholder,
  helpText,
  validation,
  conditional,
  disabled = false,
  options,
  rows = 4,
  className,
  render,
}: FormFieldProps) {
  const {
    control,
    formState: { errors },
    watch,
  } = useFormContext();

  const error = errors[name];
  const shouldShow = React.useMemo(() => {
    if (!conditional || conditional.length === 0) return true;

    return conditional.every((rule) => {
      const fieldValue = watch(rule.field);
      switch (rule.operator) {
        case "equals":
          return fieldValue === rule.value;
        case "notEquals":
          return fieldValue !== rule.value;
        case "greaterThan":
          return fieldValue > rule.value;
        case "lessThan":
          return fieldValue < rule.value;
        case "contains":
          return Array.isArray(fieldValue) && fieldValue.includes(rule.value);
        default:
          return true;
      }
    });
  }, [conditional, watch]);

  if (!shouldShow) return null;

  const requiredRule = validation?.find((v) => v.type === "required");
  const minRule = validation?.find((v) => v.type === "min");
  const maxRule = validation?.find((v) => v.type === "max");
  const patternRule = validation?.find((v) => v.type === "pattern");
  const customRule = validation?.find((v) => v.type === "custom");

  const renderInput = (field: any) => {
    if (render) {
      return render({ ...field, error: !!error });
    }

    switch (type) {
      case "textarea":
        return (
          <textarea
            {...field}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            className={cn(
              "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-destructive",
              className
            )}
          />
        );

      case "select":
        return (
          <select
            {...field}
            disabled={disabled}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-destructive",
              className
            )}
          >
            <option value="">{placeholder || "Select..."}</option>
            {options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              {...field}
              checked={field.value}
              disabled={disabled}
              className="h-4 w-4 rounded border-gray-300"
            />
            {helpText && <span className="text-sm text-slate-600">{helpText}</span>}
          </div>
        );

      case "radio":
        return (
          <div className="space-y-2">
            {options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  {...field}
                  value={option.value}
                  checked={field.value === option.value}
                  disabled={disabled}
                  className="h-4 w-4"
                />
                <Label>{option.label}</Label>
              </div>
            ))}
          </div>
        );

      case "switch":
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              {...field}
              checked={field.value}
              disabled={disabled}
              role="switch"
              className="h-5 w-9 rounded-full bg-gray-200 appearance-none checked:bg-primary transition-colors"
            />
            {helpText && <span className="text-sm text-slate-600">{helpText}</span>}
          </div>
        );

      default:
        return (
          <Input
            {...field}
            type={type}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(error && "border-destructive", className)}
          />
        );
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {type !== "checkbox" && type !== "switch" && (
        <Label htmlFor={name}>
          {label}
          {validation?.some((v) => v.type === "required") && (
            <span className="text-destructive ml-1">*</span>
          )}
        </Label>
      )}
      <Controller
        name={name}
        control={control}
        rules={{
          required: requiredRule ? (requiredRule.message || "This field is required") : undefined,
          min: minRule?.value
            ? {
                value: minRule.value,
                message: minRule.message || `Minimum value is ${minRule.value}`,
              }
            : undefined,
          max: maxRule?.value
            ? {
                value: maxRule.value,
                message: maxRule.message || `Maximum value is ${maxRule.value}`,
              }
            : undefined,
          pattern: patternRule?.value
            ? {
                value: patternRule.value,
                message: patternRule.message || "Invalid format",
              }
            : undefined,
          validate: customRule
            ? (value: any) => {
                if (customRule?.value) {
                  return customRule.value(value) || customRule.message || "Invalid value";
                }
                return true;
              }
            : undefined,
        }}
        render={({ field }) => (
          <>
            {type === "checkbox" || type === "switch" ? (
              <div className="flex items-center space-x-2">
                {renderInput(field)}
                <Label htmlFor={name}>
                  {label}
                  {validation?.some((v) => v.type === "required") && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </Label>
              </div>
            ) : (
              renderInput(field)
            )}
            {helpText && type !== "checkbox" && type !== "switch" && (
              <p className="text-xs text-slate-600">{helpText}</p>
            )}
            {error && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error.message as string}</span>
              </div>
            )}
          </>
        )}
      />
    </div>
  );
}
