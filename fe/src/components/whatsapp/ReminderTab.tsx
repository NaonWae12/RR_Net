"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SimpleSelect } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, BellDot } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { MessageVariableHelper } from "./MessageVariableHelper";

export function ReminderTab() {
    const { showToast } = useNotificationStore();
    const [isLoading, setIsLoading] = useState(false);
    
    // State form
    const [messageTemplate, setMessageTemplate] = useState(
        "Halo {nama_client},\n\nIni adalah pengingat bahwa tagihan layanan internet Anda sebesar {jumlah_tagihan} akan jatuh tempo pada {tanggal_jatuh_tempo}.\n\nMohon segera lakukan pembayaran agar layanan tetap aktif. Abaikan pesan ini jika Anda sudah membayar.\n\nTerima kasih."
    );
    const [sendDaysBefore, setSendDaysBefore] = useState("3");
    const [sendTime, setSendTime] = useState("09:00");

    const handleSave = async () => {
        setIsLoading(true);
        // Simulasi API call
        setTimeout(() => {
            setIsLoading(false);
            showToast({
                title: "Berhasil disimpan",
                description: "Pengaturan pengingat tagihan berhasil disimpan.",
                variant: "success",
            });
        }, 1000);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BellDot className="w-5 h-5 text-blue-600" />
                        Pengaturan Reminder Tagihan
                    </CardTitle>
                    <CardDescription>
                        Konfigurasi pesan pengingat tagihan otomatis yang akan dikirimkan ke pelanggan sebelum tanggal jatuh tempo.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4 max-w-2xl">
                        
                        {/* Waktu Pengiriman */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Kirim Pengingat
                                </label>
                                <div className="flex items-center gap-2">
                                    <Input 
                                        type="number" 
                                        min="0"
                                        className="w-24"
                                        value={sendDaysBefore} 
                                        onChange={(e) => setSendDaysBefore(e.target.value)} 
                                    />
                                    <span className="text-sm text-slate-600">
                                        {sendDaysBefore === "0" ? "Tepat pada hari jatuh tempo" : "Hari sebelum jatuh tempo"}
                                    </span>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Pada Jam
                                </label>
                                <Input 
                                    type="time" 
                                    value={sendTime} 
                                    onChange={(e) => setSendTime(e.target.value)} 
                                />
                            </div>
                        </div>

                        {/* Template Pesan */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Template Pesan WhatsApp
                            </label>
                            <Textarea 
                                className="min-h-[200px] resize-y"
                                value={messageTemplate}
                                onChange={(e) => setMessageTemplate(e.target.value)}
                                placeholder="Ketik pesan reminder Anda di sini..."
                            />
                            
                            {/* Bantuan Variable */}
                            <MessageVariableHelper />
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button onClick={handleSave} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                                {isLoading ? (
                                    "Menyimpan..."
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Simpan Pengaturan
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

