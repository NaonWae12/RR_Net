import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, ShieldCheck, Save, Loader2, Coins } from "lucide-react";
import { authService } from "@/lib/api/authService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone || "");
    }
  }, [user]);

  if (!user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama tidak boleh kosong");
      return;
    }

    setLoading(true);
    try {
      await authService.updateProfile({ 
        name, 
        email: email !== user.email ? email : undefined,
        phone: phone !== (user.phone || "") ? phone : undefined,
        otp: showOtpInput ? otp : undefined
      });
      await refreshUser();
      toast.success("Profil berhasil diperbarui");
      setShowOtpInput(false);
      setOtp("");
    } catch (err: any) {
      if (err.response?.data?.error === "OTP_REQUIRED") {
        setShowOtpInput(true);
        toast.info("Verifikasi OTP diperlukan untuk perubahan email/nomor WA");
      } else {
        toast.error(err.response?.data?.error || "Gagal memperbarui profil");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOTP = async (method: "email" | "whatsapp") => {
    const value = method === "email" ? email : phone;
    if (!value) {
      toast.error(`Masukkan ${method === "email" ? "email" : "nomor WA"} baru terlebih dahulu`);
      return;
    }

    setSendingOtp(true);
    try {
      await authService.requestProfileUpdateOTP(method, value);
      toast.success(`OTP berhasil dikirim ke ${value}`);
      setShowOtpInput(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Gagal mengirim OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const isEmailChanged = email !== user.email;
  const isPhoneChanged = phone !== (user.phone || "");
  const isChanged = name !== user.name || isEmailChanged || isPhoneChanged;

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-xl">Informasi Profil</CardTitle>
          <CardDescription>
            Detail data diri dan status akun Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-500">Nama Lengkap</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    className="pl-10 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-500">Alamat Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn(
                      "pl-10 pr-24 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500",
                      isEmailChanged && "border-indigo-300 bg-indigo-50/30"
                    )}
                  />
                  {isEmailChanged && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleRequestOTP("email")}
                      disabled={sendingOtp}
                      className="absolute right-1.5 top-1 h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700"
                    >
                      {sendingOtp ? "..." : "Kirim OTP"}
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 ml-1 italic">
                  {isEmailChanged ? "* Perlu verifikasi OTP ke email baru." : "* Pastikan email aktif untuk menerima notifikasi."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-500">Nomor WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contoh: 08123456789"
                    className={cn(
                      "pl-10 pr-24 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500",
                      isPhoneChanged && "border-emerald-300 bg-emerald-50/30"
                    )}
                  />
                  {isPhoneChanged && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleRequestOTP("whatsapp")}
                      disabled={sendingOtp}
                      className="absolute right-1.5 top-1 h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700"
                    >
                      {sendingOtp ? "..." : "Kirim OTP"}
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 ml-1 italic">
                  {isPhoneChanged ? "* Perlu verifikasi OTP ke nomor WA baru." : "* Gunakan format nomor HP aktif (misal: 0812...)."}
                </p>
              </div>

              {showOtpInput && (
                <div className="space-y-2 md:col-span-2 bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200">
                  <Label htmlFor="otp" className="text-indigo-600 font-bold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Masukkan Kode OTP Verifikasi
                  </Label>
                  <div className="flex gap-4">
                    <Input
                      id="otp"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="6 Digit Kode OTP"
                      className="max-w-[200px] border-indigo-200 focus:border-indigo-500 text-center tracking-[1em] font-black text-lg"
                      maxLength={6}
                    />
                    <div className="flex-1 flex items-center text-xs text-slate-500 leading-tight">
                      Cek {isEmailChanged ? "Email" : "WhatsApp"} baru Anda untuk mendapatkan kode verifikasi.
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-slate-500">Role / Jabatan</Label>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 capitalize py-1.5 px-3">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                    {user.role}
                  </Badge>
                </div>
              </div>

              {/* Role-Specific Info: Base Salary for Employees */}
              {(user.role === "technician" || user.role === "collector" || user.role === "admin") && user.base_salary > 0 && (
                <div className="space-y-2">
                  <Label className="text-slate-500">Gaji Pokok</Label>
                  <div className="flex items-center gap-2 pt-1">
                     <div className="flex items-center text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                        <Coins className="w-4 h-4 mr-2" />
                        Rp {user.base_salary?.toLocaleString('id-ID')}
                     </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={loading || !isChanged}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Simpan Perubahan
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
