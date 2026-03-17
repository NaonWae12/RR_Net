import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
type Size = "sm" | "md" | "lg" | "icon";

const baseClass =
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const variantClass: Record<Variant, string> = {
  default: "bg-slate-900 text-white hover:bg-slate-800",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  outline: "border border-slate-200 bg-white hover:bg-slate-50 text-slate-900",
  ghost: "bg-transparent hover:bg-slate-100 text-slate-900",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  link: "bg-transparent text-indigo-600 hover:text-indigo-700 underline-offset-4 hover:underline",
};

const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3",
  md: "h-10 px-4",
  lg: "h-11 px-5",
  icon: "h-10 w-10",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  loading?: boolean;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", asChild = false, loading, isLoading, children, disabled, ...props }, ref) => {
    const isActuallyLoading = loading || isLoading;
    const Component = asChild ? Slot : "button";
    const computed = cn(baseClass, variantClass[variant], sizeClass[size], className);
    
    return (
      <Component 
        ref={ref} 
        className={computed} 
        disabled={asChild ? undefined : (disabled || isActuallyLoading)}
        {...props}
      >
        {asChild ? (
          React.isValidElement(children) ? children : React.Children.toArray(children).find(child => React.isValidElement(child))
        ) : (
          <>
            {isActuallyLoading && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {children}
          </>
        )}
      </Component>
    );
  }
);
Button.displayName = "Button";

