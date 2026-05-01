"use client";

import React from "react";
import { TabLayout, TabConfig } from "@/components/layouts/TabLayout";
import { User, Shield, UserCircle } from "lucide-react";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { SecurityTab } from "@/components/settings/SecurityTab";

export default function ProfilePage() {
  const tabs: TabConfig[] = [
    {
      id: "profile",
      label: "Profil Saya",
      content: <ProfileTab />,
    },
    {
      id: "security",
      label: "Keamanan Akun",
      content: <SecurityTab />,
    },
  ];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-indigo-600">
          <UserCircle className="w-8 h-8" />
          <span className="text-sm font-semibold uppercase tracking-wider">Informasi Akun</span>
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
          Profil Pengguna
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl">
          Kelola informasi profil dan pengaturan keamanan akun Anda.
        </p>
      </div>
      
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden min-h-[650px] flex">
        <TabLayout 
          tabs={tabs} 
          vertical={true} 
          className="w-full"
          defaultTab="profile"
        />
      </div>
      
      <div className="text-center text-slate-400 text-sm">
        <p>© 2026 RRNet Cloud ERP. Semua hak dilindungi.</p>
      </div>
    </div>
  );
}
