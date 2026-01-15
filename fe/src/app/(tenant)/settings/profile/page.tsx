import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-slate-600">Pengaturan profil pengguna.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Halaman profile belum diimplementasi. Untuk sekarang, kamu bisa lanjut konfigurasi router di menu Network.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-700">
          Jika perlu, kita bisa isi halaman ini dengan: change password, MFA, update nama/email.
        </CardContent>
      </Card>
    </div>
  );
}


