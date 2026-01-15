import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-600">Pengaturan akun dan aplikasi.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Profil pengguna dan keamanan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <Link className="text-blue-600 hover:underline" href="/settings/profile">
              Profile
            </Link>
          </div>
          <div>
            <Link className="text-blue-600 hover:underline" href="/tenant/me">
              Tenant (Info)
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


