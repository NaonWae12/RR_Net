"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RoleGuard } from "@/components/guards/RoleGuard";

// Redirect to dashboard by default
export default function HRPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to HR dashboard
    router.replace("/hr/dashboard");
  }, [router]);

  return (
    <RoleGuard allowedRoles={["owner", "admin", "hr"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">HR Management</h1>
          <p className="text-slate-500 mt-1">
            Redirecting to HR Dashboard...
          </p>
        </div>
      </div>
    </RoleGuard>
  );
}


