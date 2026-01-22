import * as React from "react";
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
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    const computed = cn(baseClass, variantClass[variant], sizeClass[size], className);
    return <button ref={ref} className={computed} suppressHydrationWarning {...props} />;
  }
);
Button.displayName = "Button";

