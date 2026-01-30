"use client";

import React from 'react';
import { ShieldAlert, MessageCircle, Phone, Info } from 'lucide-react';

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
          {/* Header Illustration */}
          <div className="bg-orange-500 p-8 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 rounded-full animate-ping scale-150 opacity-20"></div>
              <div className="bg-white p-4 rounded-2xl shadow-lg relative z-10">
                <ShieldAlert className="w-12 h-12 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Akses Ditangguhkan</h1>
            <p className="text-slate-600 mb-6 font-medium">
              Maaf bre, akun internet lu saat ini lagi di-isolir atau ditangguhkan sementara.
            </p>

            {/* Info Box */}
            <div className="bg-slate-50 rounded-2xl p-4 mb-8 text-left border border-slate-100">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Kemungkinan Penyebab</p>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>• Masa aktif voucher habis</li>
                    <li>• Kuota sudah terpenuhi</li>
                    <li>• Kebijakan administrator</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <a 
                href="https://wa.me/your-number-here" 
                className="flex items-center justify-center gap-2 w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-green-200"
              >
                <MessageCircle className="w-5 h-5" />
                Hubungi Admin (WhatsApp)
              </a>
              <button 
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 w-full py-4 bg-white border-2 border-slate-100 hover:border-slate-200 text-slate-700 rounded-2xl font-bold transition-all"
              >
                Cek Status Lagi
              </button>
            </div>
          </div>

          {/* Footer Footer */}
          <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
              Powered by RR Net System
            </p>
          </div>
        </div>
        
        <p className="text-center mt-6 text-slate-400 text-sm">
          IP Address: <span className="font-mono">Detecting...</span>
        </p>
      </div>
    </div>
  );
}
