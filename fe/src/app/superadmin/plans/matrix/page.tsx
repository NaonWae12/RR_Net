"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { featureService } from "@/lib/api/featureService";
import { Feature, Plan } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import {
  ArrowLeft,
  Check,
  X,
  CreditCard,
  Settings2,
  Eye,
  EyeOff,
  Filter,
  Users,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/stores/notificationStore";

type FeatureVisibility = Record<string, boolean>; // feature_code -> is_visible

export default function FeatureMatrixPage() {
  const router = useRouter();
  const { plans, loading: plansLoading, fetchPlans } = useSuperAdminStore();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(true);
  const [showHidden, setShowHidden] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [featureVisibility, setFeatureVisibility] = useState<FeatureVisibility>({});
  const { showToast } = useNotificationStore();

  // CRUD States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [formData, setFormData] = useState({ code: "", name: "", description: "", category: "Custom" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPlans();
    loadFeatures();
  }, [fetchPlans]);

  const loadFeatures = async () => {
    setLoadingFeatures(true);
    try {
      const data = await featureService.getFeatures();
      setFeatures(data);
      
      // Initialize visibility from localStorage if available, otherwise default to all true
      const savedVisibility = localStorage.getItem("feature_matrix_visibility");
      if (savedVisibility) {
          setFeatureVisibility(JSON.parse(savedVisibility));
      } else {
          const initialVisibility: FeatureVisibility = {};
          data.forEach(f => initialVisibility[f.code] = true);
          setFeatureVisibility(initialVisibility);
      }
    } catch (err) {
      console.error("Failed to load features:", err);
      showToast({ title: "Error", description: "Failed to load feature catalog", variant: "error" });
    } finally {
      setLoadingFeatures(false);
    }
  };

  const isLoading = plansLoading || loadingFeatures;

  const groupedFeatures = useMemo(() => {
    const groups: Record<string, Feature[]> = {};
    
    // Create a map of existing features for quick lookup
    const existingFeatureCodes = new Set(features.map(f => f.code));
    
    // Find features that are in plans but not in the catalog
    const uncategorizedFeatures: Feature[] = [];
    plans.forEach(plan => {
        plan.features?.forEach(code => {
            if (code !== "*" && !existingFeatureCodes.has(code)) {
                existingFeatureCodes.add(code);
                uncategorizedFeatures.push({
                    id: `temp-${code}`,
                    code: code,
                    name: code.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                    description: "Custom feature defined in plan (Not in Catalog)",
                    category: "Plan Defined",
                    is_system: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            }
        });
    });

    const allFeatures = [...features, ...uncategorizedFeatures];
    const processedFeatures = allFeatures.filter(f => showHidden || featureVisibility[f.code] !== false);
    
    processedFeatures.forEach((f) => {
      const category = f.category || "Other";
      if (!groups[category]) groups[category] = [];
      groups[category].push(f);
    });
    return groups;
  }, [features, plans, showHidden, featureVisibility]);

  const toggleVisibility = (code: string) => {
      const newVisibility = {
          ...featureVisibility,
          [code]: !featureVisibility[code]
      };
      setFeatureVisibility(newVisibility);
      // Persist to local storage
      localStorage.setItem("feature_matrix_visibility", JSON.stringify(newVisibility));
  };

  const handleCreate = async () => {
    if (!formData.code || !formData.name) {
      showToast({ title: "Validation Error", description: "Code and Name are required", variant: "error" });
      return;
    }
    setIsSubmitting(true);
    try {
      await featureService.createFeature(formData);
      showToast({ title: "Success", description: "Feature created successfully", variant: "success" });
      setIsAddOpen(false);
      setFormData({ code: "", name: "", description: "", category: "Custom" });
      loadFeatures(); // Turn off local state update, refresh from server
    } catch (err: any) {
      showToast({ title: "Error", description: err.response?.data?.message || err.message, variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedFeature?.id) return;
    setIsSubmitting(true);
    try {
      await featureService.updateFeature(selectedFeature.id, {
        name: formData.name,
        description: formData.description
      });
      showToast({ title: "Success", description: "Feature updated successfully", variant: "success" });
      setIsEditOpen(false);
      setSelectedFeature(null);
      loadFeatures();
    } catch (err: any) {
      showToast({ title: "Error", description: err.response?.data?.message || err.message, variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFeature?.id) return;
    setIsSubmitting(true);
    try {
      await featureService.deleteFeature(selectedFeature.id);
      showToast({ title: "Success", description: "Feature deleted successfully", variant: "success" });
      setIsDeleteOpen(false);
      setSelectedFeature(null);
      loadFeatures();
    } catch (err: any) {
      showToast({ title: "Error", description: err.response?.data?.message || err.message, variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (feature: Feature) => {
    setSelectedFeature(feature);
    setFormData({
      code: feature.code,
      name: feature.name,
      description: feature.description || "",
      category: feature.category || "Custom"
    });
    setIsEditOpen(true);
  };

  const openDelete = (feature: Feature) => {
    setSelectedFeature(feature);
    setIsDeleteOpen(true);
  };

  const canEdit = (feature: Feature) => {
    // Only allow editing if it has an ID (so it's in DB, or we support editing system features via overriding in DB)
    // Current backend logic supports overriding system features by creating a DB entry with same code.
    // However, our `List` returns `id: nil` for pure system features.
    // If we want to support "Edit System Feature" (to override it), we would create an entry.
    // But currently `updateFeature` requires an ID.
    // So we can only edit features that HAVE an ID (i.e. override exists OR content is custom).
    // If user wants to "Edit" a pure system feature, they technically need to "Create" an override.
    // For simplicity, let's only allow editing features with ID, OR if we want to allow overriding system features, we'd need a different flow.
    // Let's stick to: Can edit if feature.id exists.
    return !!feature.id; 
  };

  if (isLoading) {
    return (
      <div className="flex bg-slate-50 min-h-screen items-center justify-center">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push("/superadmin/plans")}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Badge variant="outline" className="text-slate-500 bg-white">Management View</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Feature Matrix</h1>
            <p className="text-slate-500">
              Detailed comparison of system capabilities across subscription tiers.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
                variant="outline" 
                size="sm" 
                className="bg-white"
                onClick={() => {
                    setFormData({ code: "", name: "", description: "", category: "Custom" });
                    setIsAddOpen(true);
                }}
            >
                <Plus className="h-4 w-4 mr-2" />
                Add Feature
            </Button>
            
            <div className="h-6 w-px bg-slate-300 mx-1" />

            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                <Button
                    variant={!editMode ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setEditMode(false)}
                >
                    <Users className="h-3.5 w-3.5 mr-1.5" />
                    Preview
                </Button>
                <Button
                    variant={editMode ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setEditMode(true)}
                >
                    <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                    Configure
                </Button>
            </div>
          </div>
        </div>

        {/* Matrix Container */}
        <Card className="border-slate-100/20 shadow-sm overflow-hidden min-h-[500px]">
            {editMode && (
                <div className="bg-slate-50 border-b border-slate-100/20 px-4 py-2 flex items-center justify-between">
                    <div className="text-xs text-slate-500 font-medium flex items-center">
                        <Filter className="h-3.5 w-3.5 mr-1.5" />
                        Visibility Configuration Mode
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Show hidden features</span>
                        <Switch 
                            checked={showHidden} 
                            onCheckedChange={setShowHidden} 
                            className="scale-75"
                        />
                    </div>
                </div>
            )}
            
            <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[1000px]">
                    <thead>
                        <tr>
                            <th className="sticky left-0 top-0 z-20 bg-white border-b border-r border-slate-100/20 p-4 text-left w-[360px] shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                                <span className="text-sm font-semibold text-slate-900">Features</span>
                            </th>
                            {plans.map((plan) => (
                                <th key={plan.id} className="bg-slate-50/50 border-b border-r border-slate-100/20 p-4 min-w-[200px] text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <Badge variant={plan.is_active ? "success" : "secondary"} className="mb-1 text-[10px] h-5 px-1.5">
                                            {plan.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                        <span className="text-sm font-bold text-slate-900">{plan.name}</span>
                                        <span className="text-xs text-slate-500 font-mono">{plan.code}</span>
                                        <div className="mt-2 text-sm font-semibold text-slate-900">
                                            {new Intl.NumberFormat("id-ID", {
                                                style: "currency",
                                                currency: plan.currency || "IDR",
                                                maximumFractionDigits: 0
                                            }).format(plan.price_monthly)}
                                            <span className="text-xs font-normal text-slate-500">/mo</span>
                                        </div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
                            <Fragment key={category}>
                                {/* Category Header */}
                                <tr className="bg-slate-50/80">
                                    <td colSpan={plans.length + 1} className="p-2 px-4 border-b border-slate-100/20">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{category}</span>
                                    </td>
                                </tr>
                                
                                {/* Features Rows */}
                                {categoryFeatures.map((feature, featureIdx) => {
                                    const isHidden = featureVisibility[feature.code] === false;
                                    const isEditable = canEdit(feature);
                                    
                                    return (
                                        <tr 
                                            key={feature.code} 
                                            className={cn(
                                                "group transition-colors hover:bg-slate-50",
                                                isHidden && editMode ? "bg-slate-50/50 opacity-60" : "bg-white"
                                            )}
                                        >
                                            <td className="sticky left-0 bg-white group-hover:bg-slate-50 border-b border-r border-slate-100/20 p-3 px-4 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium text-slate-900">{feature.name}</span>
                                                            {isHidden && (
                                                                <Badge variant="outline" className="text-[10px] h-4 px-1 text-slate-400 border-slate-100/20">Hidden</Badge>
                                                            )}
                                                            {feature.is_system && (
                                                                <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-slate-100 text-slate-500 border-slate-100/20">System</Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <code className="text-[10px] bg-slate-100 px-1 rounded text-slate-500">{feature.code}</code>
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 max-w-[280px]">{feature.description}</p>
                                                    </div>
                                                    
                                                    {editMode && (
                                                        <div className="flex flex-col gap-1 items-end">
                                                            <div className="flex gap-1">
                                                                {isEditable && (
                                                                    <>
                                                                        <Button
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            className="h-6 w-6 shrink-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                                            onClick={() => openEdit(feature)}
                                                                            title="Edit Feature"
                                                                        >
                                                                            <Edit className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            className="h-6 w-6 shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                                            onClick={() => openDelete(feature)}
                                                                            title="Delete Feature"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </>
                                                                )}
                                                                <Button
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-6 w-6 shrink-0 text-slate-400 hover:text-slate-900"
                                                                    onClick={() => toggleVisibility(feature.code)}
                                                                    title={isHidden ? "Show in comparison" : "Hide from comparison"}
                                                                >
                                                                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            {plans.map((plan) => {
                                                const hasFeature = plan.features?.includes(feature.code) || plan.features?.includes("*");
                                                const isWildcard = plan.features?.includes("*");
                                                
                                                return (
                                                    <td key={`${plan.id}-${feature.code}`} className="border-b border-r border-slate-100/20 p-3 text-center align-middle">
                                                        {hasFeature ? (
                                                            <div className="flex justify-center">
                                                                {isWildcard ? (
                                                                    <div className="group/wildcard relative">
                                                                        <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center">
                                                                            <Check className="h-4 w-4 text-purple-600" />
                                                                        </div>
                                                                        <span className="text-[10px] text-purple-600 font-medium absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover/wildcard:opacity-100 transition-opacity z-10 bg-white shadow-sm border border-slate-100 px-2 py-0.5 rounded-full">Via Wildcard</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                                                                        <Check className="h-4 w-4 text-green-600" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="h-1 w-4 bg-slate-200 rounded mx-auto" />
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogContent className="bg-white">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Plus className="h-5 w-5 text-indigo-600" />
                        Add Custom Feature
                    </DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Define a new feature to be tracked in the matrix and assigned to plans.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Feature Code <span className="text-red-500">*</span></label>
                        <Input 
                            placeholder="e.g. my_custom_feature" 
                            value={formData.code}
                            onChange={(e) => setFormData({...formData, code: e.target.value})}
                            className="focus-visible:ring-indigo-500"
                        />
                        <p className="text-xs text-slate-500">Unique identifier used in code. Use snake_case.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Display Name <span className="text-red-500">*</span></label>
                        <Input 
                            placeholder="e.g. Advanced Analytics" 
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="focus-visible:ring-indigo-500"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Category</label>
                        <Input 
                            placeholder="e.g. Analytics" 
                            value={formData.category}
                            onChange={(e) => setFormData({...formData, category: e.target.value})}
                            className="focus-visible:ring-indigo-500"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Description</label>
                        <Textarea 
                            placeholder="Describe what this feature does..." 
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            className="focus-visible:ring-indigo-500 min-h-[80px]"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddOpen(false)} className="border-slate-300 text-slate-700 hover:bg-slate-50">Cancel</Button>
                    <Button onClick={handleCreate} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Feature
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="bg-white">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Edit className="h-5 w-5 text-indigo-600" />
                        Edit Feature
                    </DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Update feature details. Code cannot be changed.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Feature Code</label>
                        <Input value={formData.code} disabled className="bg-slate-100 font-mono text-slate-500" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Display Name <span className="text-red-500">*</span></label>
                        <Input 
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="focus-visible:ring-indigo-500"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Description</label>
                        <Textarea 
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            className="focus-visible:ring-indigo-500 min-h-[80px]"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEditOpen(false)} className="border-slate-300 text-slate-700 hover:bg-slate-50">Cancel</Button>
                    <Button onClick={handleUpdate} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <DialogContent className="bg-white">
                <DialogHeader>
                    <DialogTitle className="text-red-600 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Delete Feature
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete <strong>{selectedFeature?.name}</strong>? This action cannot be undone.
                        Any plans using this feature code will still have the code, but it will appear as "Uncategorized".
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete Forever
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
