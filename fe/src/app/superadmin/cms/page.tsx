"use client";

import { useEffect, useState } from "react";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { PageLayout } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/feedback";
import { 
  Globe, 
  Search, 
  Tag, 
  CreditCard, 
  CheckCircle2, 
  Save, 
  Plus, 
  X,
  Eye,
  Settings2,
  Layout
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/styles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function LandingCMSPage() {
  const { 
    seo, 
    pricingConfig, 
    plans,
    loading, 
    fetchSEO, 
    updateSEO, 
    fetchPricingConfig, 
    updatePricingConfig,
    fetchPlans
  } = useSuperAdminStore();

  const [activeTab, setActiveTab] = useState<"seo" | "pricing">("seo");
  const [seoForm, setSeoForm] = useState({
    title: "",
    description: "",
    keywords: [] as string[]
  });
  const [keywordInput, setKeywordInput] = useState("");
  const [pricingForm, setPricingForm] = useState({
    display_count: 3,
    show_monthly: true,
    show_yearly: true,
    plans: [] as string[],
    popular_plan_id: "",
    yearly_discount: 20
  });

  useEffect(() => {
    fetchSEO();
    fetchPricingConfig();
    fetchPlans();
  }, [fetchSEO, fetchPricingConfig, fetchPlans]);

  useEffect(() => {
    if (seo) {
      setSeoForm({
        title: seo.title || "",
        description: seo.description || "",
        keywords: seo.keywords || []
      });
    }
  }, [seo]);

  useEffect(() => {
    if (pricingConfig) {
      setPricingForm({
        display_count: pricingConfig.display_count || 3,
        show_monthly: pricingConfig.show_monthly ?? true,
        show_yearly: pricingConfig.show_yearly ?? true,
        plans: pricingConfig.plans || [],
        popular_plan_id: pricingConfig.popular_plan_id || "",
        yearly_discount: pricingConfig.yearly_discount ?? 20
      });
    }
  }, [pricingConfig]);

  const handleSaveSEO = async () => {
    try {
      await updateSEO(seoForm);
      toast({
        type: "success",
        title: "SEO Updated",
        message: "Landing page metadata has been successfully updated.",
      });
    } catch (err: any) {
      toast({
        type: "error",
        title: "Failed to update SEO",
        message: err.message,
      });
    }
  };

  const handleSavePricing = async () => {
    try {
      await updatePricingConfig(pricingForm);
      toast({
        type: "success",
        title: "Pricing Updated",
        message: "Landing page pricing configuration has been updated.",
      });
    } catch (err: any) {
      toast({
        type: "error",
        title: "Failed to update Pricing",
        message: err.message,
      });
    }
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !seoForm.keywords.includes(keywordInput.trim())) {
      setSeoForm({ ...seoForm, keywords: [...seoForm.keywords, keywordInput.trim()] });
      setKeywordInput("");
    }
  };

  const removeKeyword = (kw: string) => {
    setSeoForm({ ...seoForm, keywords: seoForm.keywords.filter(k => k !== kw) });
  };

  const togglePlanSelection = (planId: string) => {
    if (pricingForm.plans.includes(planId)) {
      setPricingForm({ ...pricingForm, plans: pricingForm.plans.filter(id => id !== planId) });
    } else {
      setPricingForm({ ...pricingForm, plans: [...pricingForm.plans, planId] });
    }
  };

  return (
    <PageLayout
      title="Landing Page CMS"
      subtitle="Manage your public facing content, SEO, and subscription visibility."
      breadcrumbs={[
        { label: "Super Admin", href: "/superadmin" },
        { label: "Landing CMS" },
      ]}
    >
      <div className="flex flex-col gap-8">
        {/* Tabs */}
        <div className="flex bg-white p-1 rounded-2xl border border-slate-100 w-fit shadow-sm">
          <button
            onClick={() => setActiveTab("seo")}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all duration-300 font-bold text-sm",
              activeTab === "seo" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Globe size={18} />
            SEO Optimization
          </button>
          <button
            onClick={() => setActiveTab("pricing")}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all duration-300 font-bold text-sm",
              activeTab === "pricing" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <CreditCard size={18} />
            Pricing & Visibility
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {activeTab === "seo" && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Search Engine Optimization</h2>
                      <p className="text-slate-500 text-sm font-medium">Control how your landing page appears in search results.</p>
                    </div>
                    <Button onClick={handleSaveSEO} isLoading={loading} className="rounded-xl shadow-lg shadow-indigo-100 font-bold px-6">
                      <Save className="mr-2 h-4 w-4" /> Save Changes
                    </Button>
                  </div>

                  <div className="grid gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Page Title</Label>
                      <Input
                        value={seoForm.title}
                        onChange={(e) => setSeoForm({ ...seoForm, title: e.target.value })}
                        placeholder="e.g. RRNET | Premium ERP for ISP"
                        className="rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white h-12 text-sm font-semibold"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Meta Description</Label>
                      <Textarea
                        value={seoForm.description}
                        onChange={(e) => setSeoForm({ ...seoForm, description: e.target.value })}
                        placeholder="Detailed description of your service..."
                        className="rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white min-h-[120px] text-sm font-medium"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Focus Keywords</Label>
                      <div className="flex gap-2 mb-3">
                        <Input
                          value={keywordInput}
                          onChange={(e) => setKeywordInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                          placeholder="Add keyword (e.g. internet provider erp)"
                          className="rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white h-12 text-sm font-medium"
                        />
                        <Button variant="outline" onClick={addKeyword} className="h-12 rounded-2xl px-6 font-bold border-slate-100 bg-white">
                          <Plus size={18} />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {seoForm.keywords.map((kw, i) => (
                          <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                            {kw}
                            <button onClick={() => removeKeyword(kw)} className="hover:text-red-500 transition-colors">
                              <X size={14} />
                            </button>
                          </span>
                        ))}
                        {seoForm.keywords.length === 0 && (
                          <p className="text-slate-400 text-xs italic">No keywords added yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "pricing" && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Pricing Configuration</h2>
                      <p className="text-slate-500 text-sm font-medium">Manage how plans are displayed on the public landing page.</p>
                    </div>
                    <Button onClick={handleSavePricing} isLoading={loading} className="rounded-xl shadow-lg shadow-indigo-100 font-bold px-6">
                      <Save className="mr-2 h-4 w-4" /> Save Changes
                    </Button>
                  </div>

                  <div className="grid gap-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <Label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Plan Display Count</Label>
                        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <input 
                            type="range" 
                            min="1" 
                            max="6" 
                            step="1" 
                            value={pricingForm.display_count}
                            onChange={(e) => setPricingForm({ ...pricingForm, display_count: parseInt(e.target.value) })}
                            className="flex-1 accent-indigo-600"
                          />
                          <span className="font-black text-2xl text-indigo-600 w-8 text-center">{pricingForm.display_count}</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Billing Options</Label>
                        <div className="flex flex-col gap-3">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={cn(
                              "h-6 w-11 rounded-full p-1 transition-all duration-300",
                              pricingForm.show_monthly ? "bg-indigo-600" : "bg-slate-300"
                            )} onClick={() => setPricingForm({ ...pricingForm, show_monthly: !pricingForm.show_monthly })}>
                              <div className={cn(
                                "h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300",
                                pricingForm.show_monthly ? "translate-x-5" : "translate-x-0"
                              )} />
                            </div>
                            <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Show Monthly Pricing</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                             <div className={cn(
                              "h-6 w-11 rounded-full p-1 transition-all duration-300",
                              pricingForm.show_yearly ? "bg-indigo-600" : "bg-slate-300"
                            )} onClick={() => setPricingForm({ ...pricingForm, show_yearly: !pricingForm.show_yearly })}>
                              <div className={cn(
                                "h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300",
                                pricingForm.show_yearly ? "translate-x-5" : "translate-x-0"
                              )} />
                            </div>
                            <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Show Yearly Pricing</span>
                          </label>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <Label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Yearly Discount (%)</Label>
                        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <input 
                            type="range" 
                            min="0" 
                            max="50" 
                            step="5" 
                            value={pricingForm.yearly_discount}
                            onChange={(e) => setPricingForm({ ...pricingForm, yearly_discount: parseInt(e.target.value) })}
                            className="flex-1 accent-indigo-600"
                          />
                          <span className="font-black text-2xl text-indigo-600 w-12 text-center">{pricingForm.yearly_discount}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Plan Visibility Selection</Label>
                      <div className="p-1 bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {plans.map((p) => (
                            <div 
                              key={p.id}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 relative group",
                                pricingForm.plans.includes(p.id)
                                  ? "bg-white border-indigo-600 shadow-md ring-4 ring-indigo-50"
                                  : "border-transparent text-slate-500 bg-white hover:border-slate-200"
                              )}
                            >
                              <div className="flex items-center gap-3 cursor-pointer" onClick={() => togglePlanSelection(p.id)}>
                                <div className={cn(
                                  "h-10 w-10 rounded-xl flex items-center justify-center",
                                  pricingForm.plans.includes(p.id) ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"
                                )}>
                                  <Tag size={20} />
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-slate-900">{p.name}</p>
                                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">{p.code}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => setPricingForm({ ...pricingForm, popular_plan_id: p.id })}
                                  className={cn(
                                    "p-2 rounded-lg transition-all",
                                    pricingForm.popular_plan_id === p.id 
                                      ? "bg-amber-100 text-amber-600 shadow-inner" 
                                      : "text-slate-300 hover:text-amber-500 hover:bg-slate-50"
                                  )}
                                  title="Mark as Popular"
                                >
                                  <CheckCircle2 size={18} className={pricingForm.popular_plan_id === p.id ? "fill-amber-600" : ""} />
                                </button>

                                <div 
                                  onClick={() => togglePlanSelection(p.id)}
                                  className={cn(
                                    "h-6 w-6 rounded-full flex items-center justify-center transition-all cursor-pointer",
                                    pricingForm.plans.includes(p.id) ? "bg-indigo-600 text-white scale-110" : "bg-slate-200 text-transparent scale-90"
                                  )}
                                >
                                  <CheckCircle2 size={16} />
                                </div>
                              </div>
                              
                              {pricingForm.popular_plan_id === p.id && (
                                <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[8px] font-black uppercase tracking-tighter px-2 py-1 rounded-lg shadow-lg rotate-12 z-20">
                                  Most Popular
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 font-medium px-1 italic">Selecting plans will force only those plans to show. If none selected, all public plans will be displayed up to the limit.</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-8">
            <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden group shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/30 rounded-full blur-[80px] -mr-32 -mt-32 animate-pulse" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                   <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                     <Eye size={24} className="text-indigo-400" />
                   </div>
                   <h3 className="text-xl font-bold">SEO Preview</h3>
                </div>

                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-6 shadow-2xl">
                    <p className="text-blue-700 text-xl font-bold mb-1 hover:underline cursor-pointer truncate">{seoForm.title || "Your Page Title"}</p>
                    <p className="text-emerald-700 text-sm mb-2 truncate">https://rrnet.id</p>
                    <p className="text-slate-600 text-xs leading-relaxed line-clamp-3">
                      {seoForm.description || "Enter a meta description to see how it might appear in search engine results like Google."}
                    </p>
                  </div>

                  <div className="px-1 py-4">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">Live Keywords Visibility</h4>
                     <div className="flex flex-wrap gap-2">
                        {seoForm.keywords.slice(0, 5).map((kw, i) => (
                          <span key={i} className="text-[10px] font-bold text-white/60 bg-white/5 border border-white/10 px-2 py-1 rounded">#{kw.toLowerCase().replace(/\s+/g, '')}</span>
                        ))}
                        {seoForm.keywords.length > 5 && <span className="text-[10px] font-bold text-white/40">+{seoForm.keywords.length - 5} more</span>}
                     </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
               <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                    <Layout size={20} />
                  </div>
                  <h3 className="font-bold text-slate-900">Landing Stats</h3>
               </div>
               
               <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-500">Selected Plans</span>
                    <span className="text-sm font-black text-slate-900">{pricingForm.plans.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-500">Visibility Score</span>
                    <span className="text-sm font-black text-emerald-600">Premium</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-500">SEO Health</span>
                    <span className={cn(
                      "text-sm font-black",
                      seoForm.description.length > 50 ? "text-emerald-600" : "text-amber-500"
                    )}>{seoForm.description.length > 50 ? "Great" : "Needs Review"}</span>
                  </div>
               </div>
               
               <Button variant="outline" className="w-full rounded-xl border-slate-200 font-bold hover:bg-slate-50 py-6" onClick={() => window.open('/', '_blank')}>
                 <Eye size={18} className="mr-2" /> View Live Site
               </Button>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
