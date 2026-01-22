"use client";

import * as React from "react";
import { Modal } from "./Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  requireConfirmation?: boolean;
  confirmationText?: string;
  countdown?: number;
  loading?: boolean;
  className?: string;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  requireConfirmation = false,
  confirmationText,
  countdown,
  loading = false,
  className,
}: ConfirmModalProps) {
  const [confirmationInput, setConfirmationInput] = React.useState("");
  const [remainingTime, setRemainingTime] = React.useState(countdown || 0);
  const [isCountingDown, setIsCountingDown] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && countdown && countdown > 0) {
      setIsCountingDown(true);
      setRemainingTime(countdown);
    } else {
      setIsCountingDown(false);
    }
  }, [isOpen, countdown]);

  React.useEffect(() => {
    if (isCountingDown && remainingTime > 0) {
      const timer = setTimeout(() => {
        setRemainingTime((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (remainingTime === 0 && isCountingDown) {
      setIsCountingDown(false);
    }
  }, [isCountingDown, remainingTime]);

  const handleConfirm = async () => {
    if (requireConfirmation && confirmationInput !== confirmationText) {
      return;
    }
    if (isCountingDown) {
      return;
    }
    await onConfirm();
    setConfirmationInput("");
  };

  const isConfirmDisabled =
    loading ||
    isCountingDown ||
    (requireConfirmation && confirmationInput !== confirmationText);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={title}
      className={className || "bg-white"}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            variant={danger ? "destructive" : "default"}
          >
            {isCountingDown ? `${remainingTime}s` : loading ? "Processing..." : confirmText}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          {danger && (
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm text-foreground">{message}</p>
        </div>

        {requireConfirmation && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Type <strong>{confirmationText}</strong> to confirm:
            </label>
            <Input
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder={confirmationText}
              className={cn(
                confirmationInput &&
                  confirmationInput !== confirmationText &&
                  "border-destructive"
              )}
            />
            {confirmationInput && confirmationInput !== confirmationText && (
              <p className="text-xs text-destructive">Confirmation text does not match</p>
            )}
          </div>
        )}

        {isCountingDown && (
          <div className="text-sm text-slate-600 text-center">
            Please wait {remainingTime} second{remainingTime !== 1 ? "s" : ""} before confirming
          </div>
        )}
      </div>
    </Modal>
  );
}
