"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useAuth } from "../../../lib/hooks/useAuth";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "../../../stores/notificationStore";
import { useAuthStore } from "../../../stores/authStore";
import { useTenantStore } from "../../../stores/tenantStore";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const { showToast } = useNotificationStore();
  const [submitted, setSubmitted] = useState(false);
  const user = useAuthStore((state) => state.user);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      tenantSlug: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setSubmitted(true);

      // For super admin, don't send tenant slug
      // For tenant users, send tenant slug if provided
      const tenantSlug = data.tenantSlug?.trim() || undefined;

      await login(
        { email: data.email, password: data.password },
        tenantSlug
      );
      showToast({ title: "Login berhasil", variant: "success" });

      // Sync tenant to tenantStore after successful login (only for tenant users)
      const authState = useAuthStore.getState();
      if (authState.tenant && authState.tenantSlug) {
        // Set tenant in tenantStore from authStore
        useTenantStore.getState().setTenant(authState.tenant, authState.tenantSlug);
      } else {
        // For super admin, clear tenant store
        useTenantStore.getState().clear();
      }

      // Get user role from auth store to determine redirect
      const currentUser = useAuthStore.getState().user;
      const userRole = currentUser?.role || "";

      // Redirect based on role
      if (userRole === "super_admin") {
        router.push("/superadmin");
      } else {
        // For tenant users (owner, admin, hr, finance, technician, collector, client)
        router.push("/dashboard");
      }
    } catch (err: any) {
      console.error("Login error:", err);

      // Extract error message from various possible locations
      const errorMessage =
        err?.response?.data?.error ||
        err?.message ||
        err?.details?.error ||
        "Terjadi kesalahan saat login";

      console.log("Error message extracted:", errorMessage);

      // Clear previous errors
      clearErrors();

      // Set error to appropriate field based on error message
      const lowerMessage = errorMessage.toLowerCase();
      if (lowerMessage.includes("email tidak terdaftar") || lowerMessage.includes("email tidak ditemukan")) {
        setError("email", {
          type: "server",
          message: "Email tidak terdaftar",
        });
      } else if (lowerMessage.includes("password salah") || lowerMessage.includes("password incorrect") || lowerMessage.includes("kata sandi salah")) {
        setError("password", {
          type: "server",
          message: "Password salah",
        });
      } else if (lowerMessage.includes("tenant") || lowerMessage.includes("slug")) {
        // If error related to tenant/slug, show as general error (no specific field)
        setError("root", {
          type: "server",
          message: errorMessage,
        });
      }

      // Also show toast notification
      showToast({
        title: "Login gagal",
        description: errorMessage,
        variant: "error",
      });
      setSubmitted(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-semibold text-slate-900">Masuk</h1>
        <p className="mt-2 text-sm text-slate-600">
          Masukkan email, password, dan slug tenant (jika bukan super admin).
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <Input
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register("email", {
                onChange: () => {
                  // Clear email error when user starts typing
                  if (errors.email?.type === "server") {
                    clearErrors("email");
                  }
                },
              })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Password
            </label>
            <Input
              type="password"
              placeholder="********"
              error={errors.password?.message}
              {...register("password", {
                onChange: () => {
                  // Clear password error when user starts typing
                  if (errors.password?.type === "server") {
                    clearErrors("password");
                  }
                },
              })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Tenant Slug (opsional)
            </label>
            <Input
              placeholder="acme"
              error={errors.tenantSlug?.message || errors.root?.message}
              {...register("tenantSlug", {
                onChange: () => {
                  // Clear root error when user starts typing
                  if (errors.root?.type === "server") {
                    clearErrors("root");
                  }
                },
              })}
            />
            <p className="text-xs text-slate-500">
              Kosongkan untuk super_admin; isi mis. "acme" untuk login tenant.
            </p>
            <details className="mt-2">
              <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-700">
                📖 Apa itu Tenant Slug?
              </summary>
              <div className="mt-2 p-3 bg-blue-50 rounded text-xs text-slate-700 space-y-2">
                <p>
                  <strong>Tenant Slug</strong> adalah identifier unik untuk organisasi/perusahaan Anda dalam sistem multi-tenant.
                </p>
                <p>
                  <strong>Cara kerja:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Setiap organisasi (tenant) memiliki slug sendiri, misalnya: "acme", "company123", "isp-bandung"</li>
                  <li>Slug digunakan untuk mengisolasi data antar organisasi (data tenant A tidak bisa diakses tenant B)</li>
                  <li>Super admin tidak memerlukan slug karena memiliki akses global ke semua tenant</li>
                  <li>User biasa (owner, admin, dll) harus menggunakan slug tenant mereka saat login</li>
                </ul>
                <p className="mt-2">
                  <strong>Contoh:</strong> Jika organisasi Anda punya slug "acme", isi field ini dengan "acme" saat login sebagai user tenant.
                </p>
              </div>
            </details>
          </div>

          <Button
            className="w-full"
            type="submit"
            disabled={isLoading || submitted}
          >
            {isLoading || submitted ? "Memproses..." : "Login"}
          </Button>
        </form>
      </div>
    </div>
  );
}

