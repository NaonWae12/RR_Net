"use client";

import React, { useState, useEffect } from "react";
import { aiService, AIConfig } from "@/lib/api/aiService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Bot, 
  Sparkles, 
  Key, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  ExternalLink,
  Info
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AITabProps {
  isAdmin?: boolean;
}

export const AITab = ({ isAdmin = false }: AITabProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AIConfig>({
    provider: "google",
    api_key: "",
    model: "gemini-2.0-flash-lite",
    is_active: false,
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = isAdmin 
          ? await aiService.getAdminConfig()
          : await aiService.getConfig();
          
        setConfig({
          ...data,
          api_key: data.api_key || "",
          provider: data.provider || "google",
          model: data.model || "gemini-2.0-flash-lite",
          is_active: data.is_active ?? false
        });
      } catch (error) {
        console.error("Failed to fetch AI config:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [isAdmin]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isAdmin) {
        await aiService.saveAdminConfig(config);
      } else {
        await aiService.saveConfig(config);
      }
      toast.success("AI configuration saved successfully");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-600" />
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">AI & Automation {isAdmin && "(Global Settings)"}</h3>
          <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-200 bg-indigo-50 font-black ml-2 uppercase">
            {isAdmin ? "System Global" : "Pro Add-on"}
          </Badge>
        </div>
        <p className="text-sm text-slate-500">
          {isAdmin 
            ? "Configure global AI settings that apply to all tenants across the platform."
            : "Supercharge your workflow with AI-powered data extraction and intelligent assistants."}
        </p>
      </div>

      <div className="grid gap-6">
        {/* Main AI Toggle */}
        <Card className="border-indigo-100 bg-linear-to-br from-indigo-50/50 to-white/50 border-2 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">Enable AI Capabilities</span>
                  {config.is_active && <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />}
                </div>
                <p className="text-sm text-slate-500 max-w-md leading-relaxed">
                  Toggle this to activate AI-driven features like bulk client migration and intelligent document processing.
                </p>
              </div>
              <Switch 
                checked={config.is_active} 
                onCheckedChange={(val) => setConfig({ ...config, is_active: val })}
                className="data-[state=checked]:bg-indigo-600 border-2 border-transparent focus-visible:ring-indigo-600"
              />
            </div>
          </CardContent>
        </Card>

        {/* Provider Configuration */}
        <div className="space-y-6 transition-all">
          <div className={cn("grid md:grid-cols-2 gap-6 transition-opacity", !config.is_active && "opacity-60")}>
            <div className="space-y-2">
              <Label className="text-slate-700 font-bold">Primary Provider</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div 
                  onClick={() => setConfig({ ...config, provider: "google", model: "gemini-2.0-flash-lite" })}
                  className={cn(
                    "relative p-4 rounded-xl border-2 flex items-center justify-between group cursor-pointer transition-all",
                    config.provider === "google" ? "border-indigo-600 bg-indigo-50/50" : "border-slate-200 hover:border-indigo-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                      <img src="https://www.gstatic.com/lamda/images/favicon_v1_150160d1396a920de632.svg" alt="Gemini" className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">Google Gemini</p>
                      <p className="text-xs text-slate-500">Cloud AI (Multimodal)</p>
                    </div>
                  </div>
                  {config.provider === "google" && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                </div>

                <div 
                  onClick={() => setConfig({ ...config, provider: "huggingface", model: "Qwen/Qwen3.5-35B-A3B:novita" })}
                  className={cn(
                    "relative p-4 rounded-xl border-2 flex items-center justify-between group cursor-pointer transition-all",
                    config.provider === "huggingface" ? "border-indigo-600 bg-indigo-50/50" : "border-slate-200 hover:border-indigo-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                      <Bot className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">Hugging Face</p>
                      <p className="text-xs text-slate-500">Qwen Vision (Cloud API)</p>
                    </div>
                  </div>
                  {config.provider === "huggingface" && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-bold">Model Version</Label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
              >
                {config.provider === "google" ? (
                  <>
                    <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite (Best for Free Tier)</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                    <option value="gemini-3-flash-preview">Gemini 3 Flash (Preview)</option>
                  </>
                ) : (
                  <option value="Qwen/Qwen3.5-35B-A3B:novita">Qwen3.5-35B-A3B (Vision) — Hardcoded</option>
                )}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-slate-700 font-bold flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-500" />
                {config.provider === "huggingface" ? "Your HuggingFace Token (HF_TOKEN)" : "Your Gemini API Key"}
              </Label>
              {config.provider === "google" && (
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-[10px] text-indigo-600 font-black flex items-center gap-1 hover:underline uppercase tracking-wider"
                >
                  Get a FREE Key <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="relative">
              <Input 
                type="password"
                placeholder={config.provider === "huggingface" ? "hf_xxxxxxxxxxxxxxxxxxxx" : "Paste your AI Studio key here"}
                className="bg-slate-50 border-slate-200 focus:bg-white transition-all pl-10"
                value={config.api_key}
                onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              />
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                {config.provider === "huggingface" ? (
                  <><strong>HuggingFace Setup:</strong> Enter your HF Token from huggingface.co/settings/tokens. The Qwen Vision model will analyze images directly — no OCR needed.</>
                ) : (
                  <><strong>BYOK Policy:</strong> You use your own API keys. We securely encrypt your keys at rest. RRNet does not charge additionally for your AI Token usage.</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400 group cursor-help">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs font-medium">API connection will be validated upon saving</span>
        </div>
        {isAdmin ? (
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              "Save Global AI Configuration"
            )}
          </Button>
        ) : (
          <p className="text-xs text-slate-400 italic">Configuration managed by Super Admin</p>
        )}
      </div>
    </div>
  );
};
