"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleGuard } from "@/components/guards/RoleGuard";

export default function SettingsPage() {
  return (
    <RoleGuard allowedRoles={["owner"]} redirectTo="/dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-600">Pengaturan akun dan aplikasi.</p>
        </div>

        <Card className="bg-white border-slate-200 text-slate-900">
          <CardHeader>
            <CardTitle className="text-slate-900">Account</CardTitle>
            <CardDescription className="text-slate-600">Profil pengguna dan keamanan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-900">
            <div>
              <Link className="text-blue-600 hover:text-blue-700 hover:underline" href="/settings/profile">
                Profile
              </Link>
            </div>
            <div>
              <Link className="text-blue-600 hover:text-blue-700 hover:underline" href="/tenant/me">
                Tenant (Info)
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}


