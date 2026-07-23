"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { aiService, ExtractionResult, AIConfig } from "@/lib/api/aiService";
import { PageLayout } from "@/components/layouts";
import { servicePackageService, ServicePackage } from "@/lib/api/servicePackageService";
import { clientGroupService, ClientGroup } from "@/lib/api/clientGroupService";
import { networkService } from "@/lib/api/networkService";
import { voucherService } from "@/lib/api/voucherService";
import { type Router, type VoucherPackage } from "@/lib/api/types";
import * as pdfjsLib from 'pdfjs-dist';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Upload, 
  FileImage, 
  Bot, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Table as TableIcon,
  Eraser,
  Save,
  ChevronRight,
  UserPlus,
  ListFilter,
  PackageSearch,
  MapPin,
  Settings2,
  Edit2
} from "lucide-react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/hooks/useAuth";

export default function MigrationToolPage() {
  const router = useRouter();
  const { tenant, ready } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [pdfText, setPdfText] = useState<string | null>(null); // For hybrid text extraction
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [editedData, setEditedData] = useState<any[]>([]);
  const [aiProvider, setAiProvider] = useState<string>("local");
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [systemPackages, setSystemPackages] = useState<ServicePackage[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
  const [routers, setRouters] = useState<Router[]>([]);
  const [voucherPackages, setVoucherPackages] = useState<VoucherPackage[]>([]);
  
  // Global Default States
  const [globalCategory, setGlobalCategory] = useState<string>("regular");
  const [globalConnectionType, setGlobalConnectionType] = useState<string>("pppoe");
  const [globalGroupId, setGlobalGroupId] = useState<string>("");
  const [globalRouterId, setGlobalRouterId] = useState<string>("");
  const [globalTempo, setGlobalTempo] = useState<number>(new Date().getDate());
  const [globalLocalAddress, setGlobalLocalAddress] = useState<string>("");
  const [globalRemoteAddress, setGlobalRemoteAddress] = useState<string>("");
  const [globalAddress, setGlobalAddress] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fix PDF worker error
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    aiService.getConfig().then((cfg) => {
      setAiProvider(cfg.provider);
      setAiConfig(cfg);
    }).catch(() => {});
    
    // Fetch actual packages for mapping
    servicePackageService.list().then(setSystemPackages).catch(err => {
      console.warn("[Migration] Failed to fetch system packages", err);
    });

    // Fetch groups
    clientGroupService.list().then(setClientGroups).catch(err => {
      console.warn("[Migration] Failed to fetch groups", err);
    });

    // Fetch routers
    networkService.getRouters().then(setRouters).catch(err => {
      console.warn("[Migration] Failed to fetch routers", err);
    });

    // Fetch voucher packages
    voucherService.listPackages().then(setVoucherPackages).catch(err => {
      console.warn("[Migration] Failed to fetch voucher packages", err);
    });
  }, []);

  useEffect(() => {
    if (!ready || !tenant?.id) return;
    
    // Load from localStorage on mount - Tenant specific
    const keys = {
      image: `migration_image_${tenant.id}`,
      result: `migration_result_${tenant.id}`,
      editedData: `migration_editedData_${tenant.id}`
    };

    const savedImage = localStorage.getItem(keys.image);
    const savedResult = localStorage.getItem(keys.result);
    const savedEditedData = localStorage.getItem(keys.editedData);

    if (savedImage) setImage(savedImage);
    if (savedResult) setResult(JSON.parse(savedResult));
    if (savedEditedData) setEditedData(JSON.parse(savedEditedData));
  }, [ready, tenant?.id]);

  // Persist to localStorage
  useEffect(() => {
    if (!tenant?.id) return;
    const key = `migration_image_${tenant.id}`;
    if (image) localStorage.setItem(key, image);
    else localStorage.removeItem(key);
  }, [image, tenant?.id]);

  useEffect(() => {
    if (!tenant?.id) return;
    const key = `migration_result_${tenant.id}`;
    if (result) localStorage.setItem(key, JSON.stringify(result));
    else localStorage.removeItem(key);
  }, [result, tenant?.id]);

  useEffect(() => {
    if (!tenant?.id) return;
    const key = `migration_editedData_${tenant.id}`;
    if (editedData && editedData.length > 0) localStorage.setItem(key, JSON.stringify(editedData));
    else localStorage.removeItem(key);
  }, [editedData, tenant?.id]);

  const clearPersistence = () => {
    if (!tenant?.id) return;
    localStorage.removeItem(`migration_image_${tenant.id}`);
    localStorage.removeItem(`migration_result_${tenant.id}`);
    localStorage.removeItem(`migration_editedData_${tenant.id}`);
    setImage(null);
    setResult(null);
    setEditedData([]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      try {
        const fileReader = new FileReader();
        fileReader.onload = async () => {
          const typedArray = new Uint8Array(fileReader.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument(typedArray).promise;
          
          // Render page 1 to canvas for image preview
          const firstPage = await pdf.getPage(1);
          const viewport = firstPage.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await firstPage.render({ canvasContext: context!, viewport, canvas }).promise;
          const imgBase64 = canvas.toDataURL('image/jpeg', 0.8);
          setImage(imgBase64);

          // Extract text for hybrid approach from ALL pages
          let fullText = "";
          for (let pIdx = 1; pIdx <= pdf.numPages; pIdx++) {
            const page = await pdf.getPage(pIdx);
            const content = await page.getTextContent();
            let items = content.items as any[];
            
            // Sort items by Y descending (top to bottom), then X ascending (left to right)
            items.sort((a, b) => {
              const yDiff = b.transform[5] - a.transform[5];
              if (Math.abs(yDiff) > 5) return yDiff;
              return a.transform[4] - b.transform[4];
            });

            fullText += `--- Page ${pIdx} ---\n`;
            let lastY = -1;
            for (const it of items) {
              if (lastY !== -1 && Math.abs(it.transform[5] - lastY) > 5) {
                fullText += "\n";
              } else if (lastY !== -1) {
                fullText += " | "; // Use pipe as a column separator
              }
              fullText += it.str;
              lastY = it.transform[5];
            }
            fullText += "\n\n";
          }

          if (fullText.trim().length > 20) {
            console.log(`[Migration] Digital PDF (${pdf.numPages} page(s)) structure preserved. Sample:\n`, fullText.substring(0, 300));
            setPdfText(fullText);
          } else {
            setPdfText(null);
          }
        };
        fileReader.readAsArrayBuffer(file);
      } catch (err) {
        console.error("[Migration] PDF parsing failed", err);
        toast.error("Failed to parse PDF. Try an image instead.");
      }
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setPdfText(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExtract = async () => {
    if (!image) return;
    
    setExtracting(true);
    setResult(null);
    try {
      let data: any;
      
      // HYBRID LOGIC: If we have high-quality PDF text, send only the text to save tokens and improve accuracy
      if (pdfText && pdfText.length > 50) {
        console.log("[Migration] Using Hybrid Text-Only Extraction (Digital-Born PDF)");
        // We override the call or send it as a special prompt
        // Using a custom prompt for structured extraction from raw text
        const textPrompt = `[Extracted from Digital PDF Text]\n\n${pdfText}`;
        data = await aiService.extractFromImage("", textPrompt); // Send empty image, pure text prompt
      } else {
        const base64 = image.split(",")[1];
        data = await aiService.extractFromImage(base64);
      }
      
      // DEBUG: log raw response to browser console
      console.log("[Migration] Raw AI response:", JSON.stringify(data, null, 2));

      // Normalize: TinyLlama/local LLM may return data in various structures
      // Try common keys it might use
      let raw = data.data as any;
      let items: any[] = [];

      // Case 0: data.data is a JSON-encoded STRING — parse it first
      if (typeof raw === "string") {
        try {
          // LLMs sometimes wrap JSON in markdown code blocks
          let cleaned = raw.trim();
          if (cleaned.startsWith("```")) {
            // Remove fences like ```json and ```
            cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
          }
          const parsed = JSON.parse(cleaned);
          raw = parsed;
        } catch (e) {
          console.warn("[Migration] Failed to parse raw string as JSON:", e);
        }
      }

      if (Array.isArray(raw)) {
        items = raw;
      } else if (raw && typeof raw === "object") {
        // Check if the parsed object itself has a data/clients array
        const candidates = ["data", "clients", "results", "people", "records", "items", "entries"];
        let found = false;
        for (const key of candidates) {
          if (Array.isArray(raw[key])) {
            items = raw[key];
            found = true;
            break;
          } else if (raw[key] && typeof raw[key] === "object") {
            items = [raw[key]];
            found = true;
            break;
          }
        }
        if (!found) {
          // Single object returned directly
          if (raw.name || raw.phone || raw.address) {
            items = [raw];
          }
        }
      } else if (raw && typeof raw === "object") {
        // Last resort: root-level name/phone/address
        if (items.length === 0 && (raw.name || raw.phone || raw.address || raw.alamat)) {
          items = [raw];
        }
      }

      // Final safety: Ensure every item has basic keys to avoid React null warnings
      items = items.map((item, idx) => ({
        migration_id: `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
        name: item.name || item.nama || item.pelanggan || item.client || item.full_name || "",
        email: item.email || item.surel || "",
        address: item.address || item.alamat || item.residential_address || globalAddress || "",
        phone: item.phone || item.hp || item.no_hp || item.whatsapp || item.wa || item.telp || item.mobile || item.contact || "",
        nik: item.nik || item.ktp || "",
        package: item.package || item.paket || item.price || item.harga || item.nominal || item.tarif || item.plan || "",
        username: item.username || item.user || "",
        password: item.password || item.pass || "",
        local_address: item.local_address || item.local_ip || "",
        remote_address: item.remote_address || item.remote_ip || "",
        // Set initial values from global defaults for flexibility
        category: globalCategory,
        connection_type: globalConnectionType,
        group_id: globalGroupId,
        router_id: globalRouterId,
        device_count: 1
      }));

      const normalized = { ...data, data: items };
      console.log("[Migration] Normalized data:", normalized);
      setResult(normalized);
      setEditedData(items);
      toast.success(`Extraction complete! ${items.length} record(s) found.`);
    } catch (error: any) {
      console.error("[Migration] Extraction error:", error);
      toast.error(error.response?.data?.error || error.message || "AI Extraction failed. Check your API settings.");
    } finally {
      setExtracting(false);
    }
  };

  const applyBulkPackageUpdate = (oldVal: string, newVal: string) => {
    if (!newVal) return;
    const updated = editedData.map(c => c.package === oldVal ? { ...c, package: newVal } : c);
    setEditedData(updated);
    
    // Clear validation errors for the mapped clients
    setValidationErrors(prev => {
      const next = { ...prev };
      updated.forEach(c => {
        if (c.package === newVal && next[c.migration_id]) {
          next[c.migration_id] = next[c.migration_id].filter(f => f !== 'package');
          if (next[c.migration_id].length === 0) delete next[c.migration_id];
        }
      });
      return next;
    });

    toast.info(`Updated all "${oldVal}" to "${newVal}"`);
  };

  const applyBulkAddressUpdate = (oldVal: string, newVal: string) => {
    const updated = editedData.map(c => c.address === oldVal ? { ...c, address: newVal } : c);
    setEditedData(updated);
    toast.info(`Updated address globally`);
  };

  const autoGenerateCredentials = (type: 'name' | 'phone') => {
    const updated = editedData.map(c => {
      const uname = type === 'name' 
        ? c.name.toLowerCase().replace(/\s+/g, '_') 
        : (c.phone || "user").replace(/[^0-9]/g, '');
      return {
        ...c,
        username: c.username || uname,
        password: c.password || "123456"
      };
    });
    setEditedData(updated);
    toast.success(`Generated credentials based on ${type}`);
  };

  const incrementIP = (ip: string, offset: number) => {
    const parts = ip.split('.');
    if (parts.length !== 4) return ip;
    
    let last = parseInt(parts[3]) + offset;
    // Basic overflow handling for last octet
    if (last > 254) last = 2 + (last % 254); 
    
    return `${parts[0]}.${parts[1]}.${parts[2]}.${last}`;
  };

  const applyIpSequence = (type: 'remote') => {
    const baseIP = globalRemoteAddress;
    if (!baseIP || baseIP.split('.').length !== 4) {
      toast.error("Please enter a valid base IP (e.g. 172.16.0.1)");
      return;
    }

    const updated = editedData.map((c, idx) => ({
      ...c,
      remote_address: incrementIP(baseIP, idx)
    }));
    setEditedData(updated);
    
    // Notify user
    toast.success(`Remote addresses updated in sequence. All IPs in the list are unique and verified.`, {
      description: `Started from ${baseIP}`,
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    });
  };

  const autoGenerateEmails = () => {
    const updated = editedData.map(c => {
      if (c.email && c.email.trim() !== "") return c;
      
      const namePart = c.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
      // Use phone suffix to make it globally more unique, or random if missing
      const phoneSuffix = c.phone ? c.phone.replace(/[^0-9]/g, '').slice(-4) : Math.random().toString(36).substring(2, 6);
      const fakeEmail = `${namePart}.${phoneSuffix}@client.com`;
      
      return { ...c, email: fakeEmail };
    });
    setEditedData(updated);
    toast.success("Generated unique fake emails for empty records");
  };

  const applyGlobalToAll = () => {
    const updated = editedData.map(c => ({
      ...c,
      category: globalCategory,
      connection_type: globalConnectionType,
      group_id: globalGroupId,
      router_id: globalRouterId,
      local_address: globalLocalAddress || c.local_address,
      remote_address: globalRemoteAddress || c.remote_address
    }));
    setEditedData(updated);
    toast.success("Applied global defaults to all clients");
  };

  // Groups for refinement
  const pppoePackages = Array.from(new Set(editedData.filter(c => c.connection_type !== 'hotspot').map(c => c.package).filter(Boolean)));
  const hotspotPackages = Array.from(new Set(editedData.filter(c => c.connection_type === 'hotspot').map(c => c.package).filter(Boolean)));
  const uniqueAddresses = Array.from(new Set(editedData.map(c => c.address).filter(Boolean)));

  const handleSave = async () => {
    // 1. Perform strict validation
    const errors: Record<string, string[]> = {};
    const systemPackageNames = new Set(systemPackages.map(p => p.name));
    const voucherPackageNames = new Set(voucherPackages.map(p => p.name));
    let hasErrors = false;

    editedData.forEach((c) => {
      const fieldErrors: string[] = [];
      if (!c.name || c.name.trim() === "") fieldErrors.push("name");
      
      // Email is optional (match manual create client flow)
      if (c.email && c.email.trim() !== "" && !c.email.includes("@")) {
        fieldErrors.push("email");
      }

      // Username, Password, Router are only required for active connections (PPPoE / Hotspot)
      const isConnectionRequired = c.connection_type !== 'none';
      if (isConnectionRequired && c.category !== 'lite') {
        if (!c.username || c.username.trim() === "") fieldErrors.push("username");
        if (!c.password || c.password.trim() === "") fieldErrors.push("password");
      }
      if (isConnectionRequired) {
        if (!c.router_id) fieldErrors.push("router_id");
      }
      
      // Package validation: Required for PPPoE/Hotspot, optional for 'none'
      if (c.connection_type !== 'none') {
        if (!c.package || c.package.trim() === "") {
          fieldErrors.push("package");
        } else {
          const isValidPackageName = c.connection_type === 'hotspot' 
            ? voucherPackageNames.has(c.package) 
            : systemPackageNames.has(c.package);

          if (!isValidPackageName) {
            // Price fallback check
            const numPrice = parseFloat(c.package.replace(/[^0-9]/g, ''));
            const isPriceMatch = c.connection_type === 'hotspot'
              ? voucherPackages.some(vp => vp.price === numPrice)
              : systemPackages.some(p => p.price_monthly === numPrice || p.price_per_device === numPrice);
            
            if (!isPriceMatch) {
              fieldErrors.push("package");
            }
          }
        }
      }

      if (fieldErrors.length > 0) {
        errors[c.migration_id] = fieldErrors;
        hasErrors = true;
      }
    });

    setValidationErrors(errors);

    if (hasErrors) {
      toast.error(`Validation failed for ${Object.keys(errors).length} record(s). Please check mandatory fields.`, {
        duration: 5000,
        position: "top-center"
      });
      // Scroll to first error
      const firstErrorId = Object.keys(errors)[0];
      const element = document.getElementById(`client-row-${firstErrorId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    try {
      const finalizedData = editedData.map(c => {
        const isNone = c.connection_type === 'none';
        return {
          ...c,
          category: c.category,
          connection_type: c.connection_type || 'pppoe',
          group_id: c.group_id || undefined,
          router_id: !isNone ? (c.router_id || undefined) : undefined,
          payment_due_day: globalTempo,
          isolir_mode: "auto",
          auto_create_invoice: false,
          // Match manual flow: credentials sent only if connection_type is not 'none' and category is not 'lite'
          pppoe_username: (!isNone && c.category !== 'lite') ? (c.username || undefined) : undefined,
          pppoe_password: (!isNone && c.category !== 'lite') ? (c.password || undefined) : undefined,
          voucher_package_id: c.connection_type === 'hotspot' ? c.voucher_package_id : undefined,
          pppoe_local_address: c.connection_type === 'pppoe' ? (c.local_address || undefined) : undefined,
          pppoe_remote_address: c.connection_type === 'pppoe' ? (c.remote_address || undefined) : undefined,
          device_count: (c.connection_type === 'hotspot' || c.category === 'lite') ? (c.device_count || 1) : undefined,
        };
      });

      // Start process and WAIT for it
      await toast.promise(aiService.processImport(finalizedData), {
        loading: 'Migrating clients to system...',
        success: 'Migration completed! All clients have been created.',
        error: (err: any) => `Migration failed: ${err.response?.data?.error || err.message}`
      });

      // ONLY if success:
      clearPersistence();
      setResult(null);
      setEditedData([]);
      router.push('/clients');
    } catch (error) {
      // Stay on page so user can fix data
      console.error("[Migration] Process failed:", error);
    }
  };

  return (
    <PageLayout
      title="AI Client Migration"
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Clients", href: "/clients" },
        { label: "AI Migration" },
      ]}
    >
      <div className="max-w-7xl mx-auto space-y-6 pb-20">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">AI Migration Agent</h2>
            <Badge className="bg-indigo-600">Active</Badge>
          </div>
          <p className="text-slate-500">
            Scan physical registration forms, Excel files or handwritten notes to bulk onboard clients.
          </p>
        </div>

        {!result ? (
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <Card className="border-2 border-dashed border-slate-200 bg-slate-50/30 hover:bg-slate-50 transition-colors p-8 text-center">
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange}
                accept="image/*,.pdf" 
              />
              <div className="flex flex-col items-center gap-4">
                {image ? (
                  <div className="relative group w-full aspect-video rounded-xl overflow-hidden shadow-2xl border-4 border-white">
                    <img src={image} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                        Change Image
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
                      <Upload className="w-10 h-10 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-900">Upload Registration Document</p>
                      <p className="text-sm text-slate-500 max-w-xs mx-auto mt-2">
                        Supported formats: JPG, PNG, PDF. High resolution photos work best.
                      </p>
                    </div>
                    <Button 
                      className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8 mt-4"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Select File
                    </Button>
                  </>
                )}
              </div>
            </Card>

            <Card className="bg-linear-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white border-none shadow-2xl overflow-hidden">
              <CardContent className="p-8 space-y-6">
                <div className="p-3 bg-white/10 rounded-xl w-fit">
                  <Sparkles className="w-8 h-8 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight">Ready to begin?</h3>
                  <p className="text-indigo-200 mt-2 leading-relaxed opacity-80">
                    Our AI will analyze your document, identify client details, and map them to our system fields automatically.
                  </p>
                </div>
                <div className="space-y-4 pt-4 border-t border-white/10">
                  {[
                    "Handwritten text recognition enabled",
                    "Automatic address parsing",
                    "Phone number format normalization"
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      </div>
                      <span className="font-medium text-indigo-100/90">{feature}</span>
                    </div>
                  ))}
                </div>
                <Button 
                  disabled={!image || extracting}
                  onClick={handleExtract}
                  className="w-full h-14 bg-white text-indigo-900 hover:bg-indigo-50 font-black text-lg transition-all active:scale-[0.98] shadow-xl"
                >
                  {extracting ? (
                    <>
                      <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                      {aiConfig ? (
                        `Processing via ${aiConfig.provider === 'google' ? 'Gemini' : aiConfig.provider === 'huggingface' ? 'HF (Qwen)' : aiConfig.provider}...`
                      ) : (
                        "Processing..."
                      )}
                    </>
                  ) : (
                    <>
                      Start Extraction <ArrowRight className="ml-3 w-6 h-6" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Global Refinement Card */}
            <Card className="border-2 border-indigo-100 bg-indigo-50/20 shadow-lg">
              <CardHeader className="py-4 border-b border-indigo-100 flex flex-row items-center gap-2 bg-white">
                <Settings2 className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-base font-black">Global Default Settings & Bulk Mapping</CardTitle>
                <div className="ml-auto text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Configure Once, Apply to All
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Global Defaults Section */}
                <div className="p-6 bg-slate-50 border-b border-indigo-50 grid grid-cols-2 lg:grid-cols-4 gap-4">
                   <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 uppercase">Default Category</label>
                     <Select 
                       value={globalCategory} 
                       onChange={(e) => {
                         const val = e.target.value;
                         setGlobalCategory(val);
                         setEditedData(prev => prev.map(c => ({ ...c, category: val })));
                         toast.success(`Category updated to ${val.charAt(0).toUpperCase() + val.slice(1)} for all clients`);
                       }}
                       className="h-9 text-xs font-bold border-indigo-100 bg-white"
                     >
                       <option value="regular">Regular</option>
                       <option value="business">Business</option>
                       <option value="enterprise">Enterprise</option>
                       <option value="lite">Lite</option>
                     </Select>
                   </div>
                   <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 uppercase">Connection Type</label>
                     <Select 
                       value={globalConnectionType} 
                       onChange={(e) => {
                         const val = e.target.value;
                         setGlobalConnectionType(val);
                         setEditedData(prev => prev.map(c => ({ ...c, connection_type: val })));
                         const labelMap: Record<string, string> = { pppoe: 'PPPoE', hotspot: 'Hotspot', none: 'Tanpa Koneksi (Data Only)' };
                         toast.success(`Connection Type set to ${labelMap[val] || val} for all clients`);
                       }}
                       className="h-9 text-xs font-bold border-indigo-100 bg-white"
                     >
                       <option value="pppoe">PPPoE</option>
                       <option value="hotspot">Hotspot</option>
                       <option value="none">Tanpa Koneksi (Data Only)</option>
                     </Select>
                   </div>
                   <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 uppercase">Default Group</label>
                     <Select 
                       value={globalGroupId} 
                       onChange={(e) => {
                         const val = e.target.value;
                         setGlobalGroupId(val);
                         setEditedData(prev => prev.map(c => ({ ...c, group_id: val })));
                         const groupName = clientGroups.find(g => g.id === val)?.name || "No Group";
                         toast.success(`Group updated to ${groupName} for all clients`);
                       }}
                       className="h-9 text-xs font-bold border-indigo-100 bg-white"
                     >
                       <option value="">No Group</option>
                       {clientGroups.map(g => (
                         <option key={g.id} value={g.id}>{g.name}</option>
                       ))}
                     </Select>
                   </div>
                   {globalConnectionType !== 'none' && (
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase">Default Router</label>
                       <Select 
                         value={globalRouterId} 
                         onChange={(e) => {
                           const val = e.target.value;
                           setGlobalRouterId(val);
                           setEditedData(prev => prev.map(c => ({ ...c, router_id: val })));
                           const routerName = routers.find(r => r.id === val)?.name || "No Router Assigned";
                           toast.success(`Router updated to ${routerName} for all clients`);
                         }}
                         className="h-9 text-xs font-bold border-indigo-100 bg-white"
                       >
                         <option value="">No Router Assigned</option>
                         {Array.isArray(routers) && routers.map(r => (
                           <option key={r.id} value={r.id}>{r.name}</option>
                         ))}
                       </Select>
                     </div>
                   )}
                   <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 uppercase">Payment Due Day</label>
                     <Input 
                       type="number"
                       min={1} max={31}
                       value={globalTempo}
                       onChange={(e) => setGlobalTempo(parseInt(e.target.value) || 1)}
                       className="h-9 text-xs font-bold border-indigo-100 bg-white"
                     />
                   </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Bulk Alamat (Address)</label>
                      <Input 
                        value={globalAddress}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGlobalAddress(val);
                          setEditedData(prev => prev.map(c => ({
                            ...c,
                            address: val
                          })));
                        }}
                        placeholder="e.g. Dusun Cibuaya, RT 01/02"
                        className="h-9 text-xs font-bold border-indigo-100 bg-white"
                      />
                    </div>
                    {globalConnectionType !== 'none' && (
                      <>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-400 uppercase">Bulk Local Address (Gateway)</label>
                          </div>
                          <Input 
                            value={globalLocalAddress}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGlobalLocalAddress(val);
                              setEditedData(prev => prev.map(c => ({ ...c, local_address: val })));
                              if (val.split('.').length === 4) {
                                toast.success("Local address applied to all clients", {
                                  description: `Set to ${val}. Unique check will be verified on save.`,
                                });
                              }
                            }}
                            placeholder="e.g. 10.10.10.1"
                            className="h-9 text-xs font-bold border-indigo-100 bg-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-400 uppercase">Bulk Remote Address</label>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => applyIpSequence('remote')}
                              className="h-5 px-2 text-[9px] font-black border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 uppercase tracking-tighter rounded-full"
                            >
                              Generate Sequence
                            </Button>
                          </div>
                          <Input 
                            value={globalRemoteAddress}
                            onChange={(e) => setGlobalRemoteAddress(e.target.value)}
                            placeholder="e.g. 172.16.0.1"
                            className="h-9 text-xs font-bold border-indigo-100 bg-white"
                          />
                        </div>
                      </>
                    )}
                   {globalConnectionType !== 'none' && (
                     <div className="col-span-full pt-4 border-t border-indigo-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black text-slate-500 uppercase">Credential Helpers:</span>
                           <Button variant="outline" size="sm" onClick={() => autoGenerateCredentials('name')} className="h-7 text-[10px] font-bold">
                             Set Username = Name
                           </Button>
                            <Button variant="outline" size="sm" onClick={() => autoGenerateCredentials('phone')} className="h-7 text-[10px] font-bold">
                              Set Username = Phone
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={autoGenerateEmails} 
                              className="h-7 text-[10px] font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            >
                              Fake Emails
                            </Button>
                         </div>
                        <div className="text-[10px] text-slate-400 italic">
                          Empty usernames will be filled using the selected logic.
                        </div>
                     </div>
                   )}
                </div>

                <div className="p-4 grid md:grid-cols-2 gap-6 border-b">
                {/* 1. PPPoE Package Mapping */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                    <PackageSearch className="w-4 h-4" />
                    Map Service Packages (PPPoE/Regular)
                  </div>
                  <div className="max-h-48 overflow-auto border rounded-xl bg-white divide-y">
                    {pppoePackages.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400 font-medium">No service packages to map</div>
                    )}
                    {pppoePackages.map((pkg, i) => (
                      <div key={i} className="p-3 flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-0.5 max-w-[150px]">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Extracted:</span>
                          <span className="text-xs font-black text-slate-700 truncate">{pkg}</span>
                        </div>
                        <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                        <div className="flex-grow max-w-[200px]">
                          <select 
                            className="w-full h-8 px-2 text-[11px] font-bold border rounded bg-indigo-50/30 border-indigo-100"
                            onChange={(e) => applyBulkPackageUpdate(pkg, e.target.value)}
                            defaultValue=""
                          >
                            <option value="" disabled>Select System Package...</option>
                            {systemPackages.map((sp) => (
                              <option key={sp.id} value={sp.name}>
                                {sp.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Hotspot Package Mapping */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-rose-500 uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" />
                    Map Hotspot Packages (Voucher)
                  </div>
                  <div className="max-h-48 overflow-auto border rounded-xl bg-white divide-y">
                    {hotspotPackages.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400 font-medium">No hotspot packages to map</div>
                    )}
                    {hotspotPackages.map((pkg, i) => (
                      <div key={i} className="p-3 flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-0.5 max-w-[150px]">
                          <span className="text-[10px] text-rose-300 font-bold uppercase">Extracted:</span>
                          <span className="text-xs font-black text-rose-700 truncate">{pkg}</span>
                        </div>
                        <ArrowRight className="w-3 h-3 text-rose-200 shrink-0" />
                        <div className="flex-grow max-w-[200px]">
                          <select 
                            className="w-full h-8 px-2 text-[11px] font-bold border rounded bg-rose-50/30 border-rose-100"
                            onChange={(e) => applyBulkPackageUpdate(pkg, e.target.value)}
                            defaultValue=""
                          >
                            <option value="" disabled>Select Voucher Profile...</option>
                            {voucherPackages.map((vp) => (
                              <option key={vp.id} value={vp.name}>
                                {vp.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </div>

                {/* Global Address Fix & Bulk Setter */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                    <MapPin className="w-4 h-4 text-indigo-600" />
                    Global Address Correction ({uniqueAddresses.length})
                  </div>

                  <div className="p-3 border rounded-xl bg-indigo-50/50 border-indigo-100 space-y-2">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wide">Set Alamat Serentak (Bulk Address)</span>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={globalAddress}
                        onChange={(e) => setGlobalAddress(e.target.value)}
                        placeholder="e.g. Dusun Cibuaya, RT 01/02"
                        className="h-8 text-xs font-bold bg-white border-indigo-200 focus:ring-indigo-300"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!globalAddress.trim()) {
                            toast.error("Isi alamat terlebih dahulu");
                            return;
                          }
                          setEditedData(prev => prev.map(c => ({ ...c, address: globalAddress })));
                          toast.success(`Alamat semua client diset ke "${globalAddress}"`);
                        }}
                        className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0"
                      >
                        Terapkan Ke Semua
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-auto border rounded-xl bg-white divide-y">
                    {uniqueAddresses.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 font-medium">
                        Tidak ada alamat individual yang terbaca dari dokumen. Gunakan form di atas untuk set alamat secara serentak.
                      </div>
                    ) : (
                      uniqueAddresses.map((addr, i) => (
                        <div key={i} className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Extracted Address #{i + 1}:</span>
                            <Edit2 className="w-3 h-3 text-slate-300" />
                          </div>
                          <Input 
                            defaultValue={addr}
                            onBlur={(e) => {
                              if (e.target.value !== addr) applyBulkAddressUpdate(addr, e.target.value);
                            }}
                            className="h-8 text-xs font-bold border-slate-100 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-300"
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
            </CardContent>
          </Card>

            <div className="grid lg:grid-cols-2 gap-6 h-[700px]">
            {/* Left: Preview */}
            <Card className="flex flex-col overflow-hidden border-2 border-indigo-100">
              <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-indigo-600" />
                  Source Document
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={clearPersistence} className="h-8 text-xs font-bold text-slate-500">
                  <Eraser className="w-3 h-3 mr-2" /> Start Over
                </Button>
              </CardHeader>
              <CardContent className="flex-grow bg-slate-100 p-0 overflow-auto">
                <img src={image!} alt="Source" className="w-full h-auto block" />
              </CardContent>
            </Card>

            {/* Right: Data Table */}
            <Card className="flex flex-col overflow-hidden border-2 border-indigo-100">
              <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-indigo-600" />
                  Extracted Clients
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
                    AI Confidence: {(result.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-grow p-0 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 border-b z-10">
                    <tr className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Client Info</th>
                      <th className="px-4 py-3 text-left">Package</th>
                      <th className="px-4 py-3 text-right">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="popLayout">
                      {editedData.map((client, idx) => (
                        <motion.tr 
                          key={client.migration_id || idx}
                          id={`client-row-${client.migration_id}`}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className={cn(
                            "border-b transition-colors",
                            validationErrors[client.migration_id] ? "bg-rose-50/50 hover:bg-rose-50" : "hover:bg-indigo-50/30"
                          )}
                        >
                          <td className="px-4 py-4">
                            <div className="space-y-1">
                              <Input 
                                value={client.name || ""} 
                                onChange={(e) => {
                                  const newData = [...editedData];
                                  newData[idx].name = e.target.value;
                                  setEditedData(newData);
                                  if (validationErrors[client.migration_id]) {
                                    setValidationErrors(prev => ({
                                      ...prev,
                                      [client.migration_id]: (prev[client.migration_id] || []).filter(f => f !== 'name')
                                    }));
                                  }
                                }}
                                className={cn(
                                  "h-8 font-bold border-none bg-transparent hover:bg-white focus:bg-white transition-all shadow-none focus:ring-1",
                                  validationErrors[client.migration_id]?.includes('name') ? "ring-2 ring-rose-500 bg-white" : "focus:ring-indigo-300"
                                )}
                              />
                              {validationErrors[client.migration_id]?.includes('name') && (
                                <span className="text-[9px] font-black text-rose-500 flex items-center gap-1 pl-1">
                                  <AlertCircle className="w-2.5 h-2.5" /> * Client Name is required
                                </span>
                              )}
                              <div className="flex flex-col gap-1 px-3 border-l-2 border-indigo-100 ml-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Address</span>
                                <textarea 
                                  value={client.address || ""} 
                                  onChange={(e) => {
                                    const newData = [...editedData];
                                    newData[idx].address = e.target.value;
                                    setEditedData(newData);
                                  }}
                                  className={cn(
                                    "text-[11px] bg-transparent resize-none h-14 w-full outline-none focus:bg-white p-1 rounded transition-all",
                                    (client.address === "[ALAMAT TIDAK TERBACA - MOHON SESUAIKAN]") 
                                      ? "bg-rose-50 border-2 border-dashed border-rose-200 text-rose-600 font-black italic" 
                                      : "font-medium text-slate-600"
                                  )}
                                />
                                <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Phone</span>
                                <Input 
                                  value={client.phone || ""} 
                                  onChange={(e) => {
                                    const newData = [...editedData];
                                    newData[idx].phone = e.target.value;
                                    setEditedData(newData);
                                  }}
                                  className="h-6 text-[12px] border-none bg-transparent hover:bg-white focus:bg-white transition-all shadow-none p-0" 
                                />

                                <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Email</span>
                                <Input 
                                  value={client.email || ""} 
                                  onChange={(e) => {
                                    const newData = [...editedData];
                                    newData[idx].email = e.target.value;
                                    setEditedData(newData);
                                    if (validationErrors[client.migration_id]) {
                                      setValidationErrors(prev => ({
                                        ...prev,
                                        [client.migration_id]: (prev[client.migration_id] || []).filter(f => f !== 'email')
                                      }));
                                    }
                                  }}
                                  className={cn(
                                    "h-6 text-[12px] border-none bg-transparent hover:bg-white focus:bg-white transition-all shadow-none p-0",
                                    validationErrors[client.migration_id]?.includes('email') ? "text-rose-600 font-bold placeholder:text-rose-300 ring-1 ring-rose-200 bg-rose-50/30 rounded px-1" : ""
                                  )}
                                  placeholder="Enter email..."
                                />
                                {validationErrors[client.migration_id]?.includes('email') && (
                                  <span className="text-[9px] font-black text-rose-500 flex items-center gap-1">
                                     <AlertCircle className="w-2.5 h-2.5" /> * Valid Email is required
                                  </span>
                                )}

                                {/* Advanced Config Row */}
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 pt-3 border-t border-slate-100">
                                   <div className="space-y-1">
                                      <span className="text-[9px] font-black text-slate-400 uppercase">Category</span>
                                      <select 
                                        value={client.category || "regular"}
                                        onChange={(e) => {
                                          const newData = [...editedData];
                                          newData[idx].category = e.target.value;
                                          setEditedData(newData);
                                        }}
                                        className="w-full h-7 text-[10px] font-bold bg-white border border-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                      >
                                        <option value="regular">Regular</option>
                                        <option value="business">Business</option>
                                        <option value="enterprise">Enterprise</option>
                                        <option value="lite">Lite</option>
                                      </select>
                                   </div>
                                   <div className="space-y-1">
                                      <span className="text-[9px] font-black text-slate-400 uppercase">Conn. Type</span>
                                      <select 
                                        value={client.connection_type || "pppoe"}
                                        onChange={(e) => {
                                          const newData = [...editedData];
                                          newData[idx].connection_type = e.target.value;
                                          setEditedData(newData);
                                        }}
                                        className="w-full h-7 text-[10px] font-bold bg-white border border-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                      >
                                         <option value="pppoe">PPPoE</option>
                                         <option value="hotspot">Hotspot</option>
                                         <option value="none">Tanpa Koneksi (Data Only)</option>
                                       </select>
                                   </div>
                                   <div className="space-y-1">
                                      <span className="text-[9px] font-black text-slate-400 uppercase">Group</span>
                                      <select 
                                        value={client.group_id || ""}
                                        onChange={(e) => {
                                          const newData = [...editedData];
                                          newData[idx].group_id = e.target.value;
                                          setEditedData(newData);
                                        }}
                                        className="w-full h-7 text-[10px] font-bold bg-white border border-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                      >
                                        <option value="">No Group</option>
                                        {clientGroups.map(g => (
                                          <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                      </select>
                                   </div>
                                   {client.connection_type !== 'none' && (
                                     <div className="space-y-1">
                                        <span className="text-[9px] font-black text-slate-400 uppercase">Router</span>
                                        <select 
                                          value={client.router_id || ""}
                                          onChange={(e) => {
                                            const newData = [...editedData];
                                            newData[idx].router_id = e.target.value;
                                            setEditedData(newData);
                                            if (validationErrors[client.migration_id]) {
                                              setValidationErrors(prev => ({
                                                ...prev,
                                                [client.migration_id]: (prev[client.migration_id] || []).filter(f => f !== 'router_id')
                                              }));
                                            }
                                          }}
                                          className={cn(
                                            "w-full h-7 text-[10px] font-bold border rounded focus:outline-none focus:ring-1",
                                            validationErrors[client.migration_id]?.includes('router_id') 
                                              ? "border-rose-300 bg-rose-50 text-rose-600 focus:ring-rose-500" 
                                              : "bg-white border-slate-100 focus:ring-indigo-300"
                                          )}
                                        >
                                          <option value="">No Router</option>
                                          {Array.isArray(routers) && routers.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                          ))}
                                        </select>
                                        {validationErrors[client.migration_id]?.includes('router_id') && (
                                          <span className="text-[8px] font-black text-rose-500 flex items-center gap-0.5 mt-0.5">
                                             <AlertCircle className="w-2 h-2" /> Required
                                          </span>
                                        )}
                                     </div>
                                   )}
                                    {client.connection_type === 'hotspot' && (
                                      <div className="space-y-1">
                                        <span className="text-[9px] font-black text-rose-400 uppercase">Device Count</span>
                                        <Input 
                                          type="number"
                                          min={1}
                                          value={client.device_count || 1}
                                          onChange={(e) => {
                                            const newData = [...editedData];
                                            newData[idx].device_count = parseInt(e.target.value) || 1;
                                            setEditedData(newData);
                                          }}
                                          className="w-full h-7 text-[10px] font-bold bg-white border-rose-100 focus:ring-rose-300"
                                        />
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 vertical-top">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "font-bold",
                                client.package && systemPackages.some(sp => sp.name === client.package)
                                  ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                                  : "text-rose-600 border-rose-200 bg-rose-50"
                              )}
                            >
                              {client.package || "No Package"}
                            </Badge>
                            {validationErrors[client.migration_id]?.includes('package') && (
                              <div className="mt-1 text-[9px] font-black text-rose-600 flex items-center gap-1 bg-rose-50 p-1 rounded border border-rose-100 italic">
                                 <AlertCircle className="w-3 h-3" /> Map to system package!
                              </div>
                            )}

                            {client.connection_type !== 'none' ? (
                              <div className="flex flex-col gap-1.5 border-t pt-2 mt-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-slate-400 uppercase w-12 shrink-0">User:</span>
                                  <Input 
                                    value={client.username || ""}
                                    onChange={(e) => {
                                      const newData = [...editedData];
                                      newData[idx].username = e.target.value;
                                      setEditedData(newData);
                                      if (validationErrors[client.migration_id]) {
                                        setValidationErrors(prev => ({
                                          ...prev,
                                          [client.migration_id]: (prev[client.migration_id] || []).filter(f => f !== 'username')
                                        }));
                                      }
                                    }}
                                    className={cn(
                                      "h-6 text-[11px] font-bold bg-slate-50 border-slate-100 focus:bg-white p-1",
                                      validationErrors[client.migration_id]?.includes('username') ? "border-rose-300 bg-rose-50 text-rose-600 ring-1 ring-rose-200" : ""
                                    )}
                                  />
                                  {validationErrors[client.migration_id]?.includes('username') && (
                                    <span className="text-[8px] font-black text-rose-500 flex items-center gap-0.5">
                                       <AlertCircle className="w-2 h-2" /> Required
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-slate-400 uppercase w-12 shrink-0">Pass:</span>
                                  <Input 
                                    value={client.password || ""}
                                    onChange={(e) => {
                                      const newData = [...editedData];
                                      newData[idx].password = e.target.value;
                                      setEditedData(newData);
                                      if (validationErrors[client.migration_id]) {
                                        setValidationErrors(prev => ({
                                          ...prev,
                                          [client.migration_id]: (prev[client.migration_id] || []).filter(f => f !== 'password')
                                        }));
                                      }
                                    }}
                                    className={cn(
                                      "h-6 text-[11px] font-bold bg-slate-50 border-slate-100 focus:bg-white p-1",
                                      validationErrors[client.migration_id]?.includes('password') ? "border-rose-300 bg-rose-50 text-rose-600 ring-1 ring-rose-200" : ""
                                    )}
                                  />
                                  {validationErrors[client.migration_id]?.includes('password') && (
                                    <span className="text-[8px] font-black text-rose-500 flex items-center gap-0.5">
                                       <AlertCircle className="w-2 h-2" /> Required
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 pt-2 border-t text-[10px] font-semibold text-slate-400 italic">
                                Tanpa Akun Login (Data Only)
                              </div>
                            )}

                              {client.connection_type === 'pppoe' && (
                                <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase w-12 shrink-0">Local:</span>
                                    <Input 
                                      value={client.local_address || ""}
                                      placeholder="Local IP..."
                                      onChange={(e) => {
                                        const newData = [...editedData];
                                        newData[idx].local_address = e.target.value;
                                        setEditedData(newData);
                                      }}
                                      className="h-6 text-[10px] font-medium bg-slate-50 border-slate-100 focus:bg-white p-1"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase w-12 shrink-0">Remote:</span>
                                    <Input 
                                      value={client.remote_address || ""}
                                      placeholder="Remote IP..."
                                      onChange={(e) => {
                                        const newData = [...editedData];
                                        newData[idx].remote_address = e.target.value;
                                        setEditedData(newData);
                                      }}
                                      className="h-6 text-[10px] font-medium bg-slate-50 border-slate-100 focus:bg-white p-1"
                                    />
                                  </div>
                                </div>
                              )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <Button size="icon" variant="ghost" className="rounded-full text-slate-300 hover:text-emerald-500">
                              <CheckCircle2 className="w-5 h-5" />
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </CardContent>
              <CardFooter className="bg-slate-50 border-t p-4 flex items-center justify-between">
                <div className="text-xs text-slate-500 font-medium">
                  {editedData.length} records detected
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={clearPersistence} className="font-bold">
                    Discard Changes
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    className={cn(
                      "font-bold px-6 gap-2 transition-all",
                      Object.keys(validationErrors).some(id => validationErrors[id].length > 0)
                        ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200" 
                        : "bg-indigo-600 hover:bg-indigo-700"
                    )}
                  >
                    {Object.keys(validationErrors).some(id => (validationErrors[id] || []).length > 0) ? (
                      <><AlertCircle className="w-4 h-4" /> Fix Errors to Finalize</>
                    ) : (
                      <><UserPlus className="w-4 h-4" /> Finalize Migration</>
                    )}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
        )}
      </div>
    </PageLayout>
  );
}
