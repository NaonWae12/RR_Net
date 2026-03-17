"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiWhatsapp } from "react-icons/si";
import { ExternalLink, CheckCircle2, XCircle, Zap } from "lucide-react";
import Link from "next/link";

export function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-xl">System Integrations</CardTitle>
          <CardDescription>
            Connect and manage external services integrated with your ERP.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {/* WhatsApp Integration */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#25D366]/10 text-[#25D366]">
                  <SiWhatsapp className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-lg">WhatsApp Gateway</h3>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">Connected</Badge>
                  </div>
                  <p className="text-sm text-slate-500 mt-1 max-w-md">
                    Automate notifications, reminders, and billing alerts to your clients via WhatsApp.
                  </p>
                </div>
              </div>
              <div className="mt-4 md:mt-0 flex gap-2 w-full md:w-auto">
                <Button asChild variant="outline" className="flex-1 md:flex-none border-slate-200 hover:bg-slate-50">
                  <Link href="/whatsapp">
                    <Zap className="w-4 h-4 mr-2 text-amber-500" />
                    Configure
                  </Link>
                </Button>
                <Button variant="ghost" className="hidden md:flex text-slate-400 hover:text-slate-900">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Placeholder for future integrations */}
            <div className="p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-2 py-10">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-slate-600">More Integrations Coming</h3>
              <p className="text-sm text-slate-400 max-w-xs">
                We are working on integrating more services like Mikrotik API, Payment Gateways (Xendit/Midtrans), and Email Services.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
