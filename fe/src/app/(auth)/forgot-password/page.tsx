"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";
import { authService } from "@/lib/api/authService";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      setSubmitted(true);
      await authService.forgotPassword(data.email);
      toast.success("Password reset email sent", {
        description: "Check your email for reset instructions",
      });
    } catch (err: any) {
      toast.error("Failed to send reset email", {
        description: err?.response?.data?.error ?? "Please try again",
      });
      setSubmitted(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-semibold text-slate-900">Forgot Password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register("email")}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <Button
            className="w-full"
            type="submit"
            disabled={submitted}
          >
            {submitted ? "Sending..." : "Send Reset Link"}
          </Button>

          <div className="text-center">
            <Link href="/login" className="text-sm text-slate-600 hover:underline">
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

