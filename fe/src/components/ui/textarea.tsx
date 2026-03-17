import * as React from "react";
import { cn } from "../../lib/utils/styles";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, id, ...props }, ref) => {
    return (
      <div className="flex w-full flex-col gap-1 text-slate-900">
        {label ? (
          <label htmlFor={id} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={id}
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-rose-400 focus-visible:ring-rose-200" : "",
            className
          )}
          {...props}
        />
        {error ? (
          <span className="text-xs text-rose-600" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
