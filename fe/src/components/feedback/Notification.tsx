"use client";

import * as React from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Alert } from "./Alert";

export interface NotificationItem {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  timestamp?: Date;
  read?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface NotificationProps {
  notifications: NotificationItem[];
  onMarkAsRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onAction?: (id: string, action: NotificationItem["action"]) => void;
  maxItems?: number;
  className?: string;
}

export const Notification = React.memo<NotificationProps>(
  ({ notifications, onMarkAsRead, onDismiss, onAction, maxItems = 5, className }) => {
    const unreadCount = notifications.filter((n) => !n.read).length;
    const displayNotifications = notifications.slice(0, maxItems);

    return (
      <div className={cn("space-y-2", className)}>
        {displayNotifications.map((notification) => (
          <div
            key={notification.id}
            className={cn(
              "relative border rounded-lg p-4 transition-colors",
              !notification.read && "bg-muted/50"
            )}
          >
            <Alert
              variant={notification.type}
              title={notification.title}
              message={notification.message}
              dismissible={!!onDismiss}
              onDismiss={() => onDismiss?.(notification.id)}
            />
            {notification.timestamp && (
              <p className="text-xs text-slate-600 mt-2">
                {new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
                  Math.round((notification.timestamp.getTime() - Date.now()) / 60000),
                  "minute"
                )}
              </p>
            )}
            {notification.action && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  onAction?.(notification.id, notification.action);
                  notification.action?.onClick();
                }}
              >
                {notification.action.label}
              </Button>
            )}
            {!notification.read && (
              <button
                onClick={() => onMarkAsRead?.(notification.id)}
                className="absolute top-2 right-2 text-xs text-slate-600 hover:text-slate-900"
              >
                Mark as read
              </button>
            )}
          </div>
        ))}
        {notifications.length > maxItems && (
          <p className="text-sm text-center text-slate-600">
            {notifications.length - maxItems} more notification{notifications.length - maxItems > 1 ? "s" : ""}
          </p>
        )}
      </div>
    );
  }
);

Notification.displayName = "Notification";

// Notification Bell Component
export interface NotificationBellProps {
  count?: number;
  onClick?: () => void;
  className?: string;
}

export function NotificationBell({ count = 0, onClick, className }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      className={cn("relative p-2 rounded-md hover:bg-muted transition-colors", className)}
      aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

