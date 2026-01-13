import * as React from "react";
import { cn } from "../../lib/utils/styles";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, id, ...props }, ref) => {
    return (
      <div className="flex w-full flex-col gap-1">
        {label ? (
          <label htmlFor={id} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={id}
          className={cn(
            "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50",
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
Input.displayName = "Input";

