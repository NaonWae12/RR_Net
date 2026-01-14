"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mfaVerifySchema, type MFAVerifyInput } from "@/lib/validation/auth";
import { authService } from "@/lib/api/authService";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

interface MFAVerificationProps {
  onVerify: (code: string) => Promise<void>;
  onCancel?: () => void;
  timeRemaining?: number;
}

export function MFAVerification({
  onVerify,
  onCancel,
  timeRemaining = 300,
}: MFAVerificationProps) {
  const [timer, setTimer] = useState(timeRemaining);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<MFAVerifyInput>({
    resolver: zodResolver(mfaVerifySchema),
  });

  const code = watch("code");

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  useEffect(() => {
    if (code && code.length === 6) {
      handleSubmit(onSubmit)();
    }
  }, [code]);

  const onSubmit = async (data: MFAVerifyInput) => {
    try {
      setIsSubmitting(true);
      await onVerify(data.code);
    } catch (err: any) {
      toast.error("Invalid MFA code", {
        description: err?.response?.data?.error ?? "Please try again",
      });
      setValue("code", "");
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
        <p className="text-sm text-slate-600 mt-1">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            MFA Code <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            placeholder="000000"
            maxLength={6}
            className="text-center text-2xl tracking-widest font-mono"
            {...register("code", {
              pattern: {
                value: /^\d{6}$/,
                message: "Code must be 6 digits",
              },
            })}
          />
          {errors.code?.message && (
            <p className="text-sm text-destructive">{errors.code.message}</p>
          )}
        </div>

        {timer > 0 && (
          <p className="text-sm text-slate-600 text-center">
            Time remaining: {formatTime(timer)}
          </p>
        )}

        {timer === 0 && (
          <p className="text-sm text-destructive text-center">
            Code expired. Please request a new one.
          </p>
        )}

        <div className="flex gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            className="flex-1"
            disabled={isSubmitting || timer === 0}
          >
            {isSubmitting ? "Verifying..." : "Verify"}
          </Button>
        </div>
      </form>
    </div>
  );
}

