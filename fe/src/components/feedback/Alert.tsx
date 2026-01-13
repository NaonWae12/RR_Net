"use client";

import * as React from "react";
import { Alert as UIAlert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { X, Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AlertProps {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  message: string;
  dismissible?: boolean;
  icon?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const variantIcons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const variantStyles = {
  info: "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800",
  success: "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800",
  warning: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800",
  error: "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950 dark:text-rose-100 dark:border-rose-800",
};

export const Alert = React.memo<AlertProps>(
  ({ variant = "info", title, message, dismissible = false, icon, onDismiss, className, children }) => {
    const [isDismissed, setIsDismissed] = React.useState(false);
    const IconComponent = variantIcons[variant];
    const displayIcon = icon || <IconComponent className="h-4 w-4" />;

    const handleDismiss = () => {
      setIsDismissed(true);
      onDismiss?.();
    };

    if (isDismissed) return null;

    return (
      <UIAlert
        variant={variant === "error" ? "destructive" : "default"}
        className={cn(variantStyles[variant], className)}
      >
        <div className="flex items-start gap-3">
          {displayIcon}
          <div className="flex-1">
            {title && <AlertTitle>{title}</AlertTitle>}
            <AlertDescription className={cn(title && "mt-1")}>
              {message}
              {children}
            </AlertDescription>
          </div>
          {dismissible && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </div>
      </UIAlert>
    );
  }
);

Alert.displayName = "Alert";

