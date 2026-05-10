"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiWhatsapp } from "react-icons/si";
import { ExternalLink, CheckCircle2, XCircle, Zap, DollarSign, Settings2, Loader2 } from "lucide-react";
import Link from "next/link";
import { MidtransConfigModal } from "./MidtransConfigModal";
import { FeeConfigurationModal } from "@/components/common/FeeConfigurationModal";
import { integrationService, MidtransConfig } from "@/lib/api/integrationService";
import { Scale } from "lucide-react";

export function IntegrationsTab() {
  const [showMidtransModal, setShowMidtransModal] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [config, setConfig] = useState<MidtransConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const data = await integrationService.getMidtransConfig();
      setConfig(data);
    } catch (error) {
      console.error("Failed to fetch Midtrans config:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

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
            {/* Midtrans Integration */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
                  <DollarSign className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-lg">Midtrans Payment Gateway</h3>
                    {loading ? (
                      <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    ) : config?.enabled ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-400 border-slate-200 font-medium">Not Configured</Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1 max-w-md">
                    Enable automated payments via VA, QRIS, and Credit Cards for your clients.
                  </p>
                </div>
              </div>
              <div className="mt-4 md:mt-0 flex gap-2 w-full md:w-auto">
                <Button 
                  variant="outline" 
                  className="flex-1 md:flex-none border-slate-200 hover:bg-slate-50"
                  onClick={() => setShowFeeModal(true)}
                >
                  <Scale className="w-4 h-4 mr-2 text-slate-500" />
                  Fee Sharing
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 md:flex-none border-slate-200 hover:bg-slate-50"
                  onClick={() => setShowMidtransModal(true)}
                >
                  <Settings2 className="w-4 h-4 mr-2 text-slate-500" />
                  Configure
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
                We are working on integrating more services like Mikrotik API, Xendit, and Email Services.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <MidtransConfigModal 
        isOpen={showMidtransModal} 
        onClose={() => {
          setShowMidtransModal(false);
          fetchConfig();
        }} 
      />

      <FeeConfigurationModal
        isOpen={showFeeModal}
        onClose={() => setShowFeeModal(false)}
        config={config}
        onSave={async (share) => {
          if (!config) return;
          try {
            await integrationService.updateMidtransConfig({
              ...config,
              customer_share_percent: share
            });
            toast({
              type: "success",
              title: "Fee Sharing Updated",
              message: "Your customer payment fee sharing has been updated."
            });
            fetchConfig();
          } catch (error: any) {
            toast({
              type: "error",
              title: "Update Failed",
              message: error.message || "Failed to update fee sharing settings."
            });
          }
        }}
        title="Payment Fee Sharing"
        description="Configure how transaction fees are shared with your customers."
      />
    </div>
  );
}
