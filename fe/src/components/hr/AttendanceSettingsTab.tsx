"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { apiClient } from "@/lib/api/apiClient";
import { LocationPickerModal } from "./LocationPickerModal";
import { MapPin } from "lucide-react";

interface Location {
  name: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
}

interface AttendanceSettings {
  enabled: boolean;
  require_geolocation: boolean;
  radius_meters: number;
  allowed_locations: Location[];
}

export function AttendanceSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AttendanceSettings>({
    enabled: true,
    require_geolocation: true,
    radius_meters: 100,
    allowed_locations: [],
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeLocationIndex, setActiveLocationIndex] = useState<number | null>(null);

  const { showToast } = useNotificationStore();

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<AttendanceSettings>("/hr/attendance/settings");
      setSettings({
        enabled: response.data.enabled ?? true,
        require_geolocation: response.data.require_geolocation ?? true,
        radius_meters: response.data.radius_meters ?? 100,
        allowed_locations: response.data.allowed_locations || [],
      });
    } catch (err: any) {
      showToast({
        title: "Failed to load settings",
        description: err?.message || "An unexpected error occurred",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      console.log("Saving attendance settings:", settings);
      await apiClient.put("/hr/attendance/settings", settings);
      showToast({
        title: "Settings saved",
        description: "Attendance settings have been updated successfully.",
        variant: "success",
      });
      // Refresh to confirm save
      await fetchSettings();
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      showToast({
        title: "Failed to save settings",
        description: err?.message || "An unexpected error occurred",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const addLocation = () => {
    setSettings((prev) => ({
      ...prev,
      allowed_locations: [
        ...prev.allowed_locations,
        { name: "New Location", latitude: 0, longitude: 0 },
      ],
    }));
  };

  const removeLocation = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      allowed_locations: prev.allowed_locations.filter((_, i) => i !== index),
    }));
  };

  const updateLocation = (index: number, field: keyof Location, value: any) => {
    setSettings((prev) => ({
      ...prev,
      allowed_locations: prev.allowed_locations.map((loc, i) =>
        i === index ? { ...loc, [field]: value } : loc
      ),
    }));
  };

  const openPicker = (index: number) => {
    setActiveLocationIndex(index);
    setPickerOpen(true);
  };

  const onLocationPicked = (lat: number, lng: number) => {
    if (activeLocationIndex !== null) {
      updateLocation(activeLocationIndex, "latitude", lat);
      updateLocation(activeLocationIndex, "longitude", lng);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-[#f8fafc] to-[#ffffff] border-b border-[#e2e8f0]">
          <h2 className="text-xl font-bold text-[#0f172a]">Geolocation Settings</h2>
          <p className="text-sm text-[#64748b]">Configure attendance location requirements and geofencing</p>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between pb-6 border-b border-[#f1f5f9]">
            <div>
              <label className="text-base font-semibold text-[#0f172a]">Enable Attendance Feature</label>
              <p className="text-sm text-[#64748b]">Global switch to turn the attendance system on or off</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
              className={`relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none ${
                settings.enabled ? "bg-[#10b981]" : "bg-[#cbd5e1]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-300 ease-in-out ${
                  settings.enabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <label className="text-base font-semibold text-[#0f172a]">Require Geolocation</label>
              <p className="text-sm text-[#64748b]">Users must provide their location when checking in/out</p>
            </div>
            <button
              disabled={!settings.enabled}
              onClick={() => setSettings({ ...settings, require_geolocation: !settings.require_geolocation })}
              className={`relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none ${
                !settings.enabled ? "opacity-40 cursor-not-allowed" : ""
              } ${
                settings.require_geolocation ? "bg-[#4f46e5]" : "bg-[#cbd5e1]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-300 ease-in-out ${
                  settings.require_geolocation ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="space-y-3 pt-2">
            <label className="text-sm font-semibold text-[#334155]">Radius Range (Meters)</label>
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Input
                  type="number"
                  value={settings.radius_meters}
                  onChange={(e) => setSettings({ ...settings, radius_meters: parseInt(e.target.value) || 0 })}
                  className="max-w-[160px] border-[#e2e8f0] focus:ring-[#4f46e5] focus:border-[#4f46e5] font-semibold text-[#0f172a]"
                  min={0}
                />
                <div className="absolute inset-0 rounded-md bg-[#4f46e5]/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"></div>
              </div>
              <span className="text-sm text-[#64748b] italic">Maximum distance allowed from the fixed points</span>
            </div>
          </div>

          <div className="space-y-5 pt-8 border-t border-[#f1f5f9]">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-base font-semibold text-[#0f172a]">Allowed Fixed Locations</label>
                <p className="text-sm text-[#64748b]">Identify specific zones where employees can perform attendance</p>
              </div>
              <Button 
                onClick={addLocation}
                className="bg-[#4f46e5] hover:bg-[#4338ca] text-[#ffffff] font-semibold px-5 shadow-[0_4px_12px_rgba(79,70,229,0.3)] border-none transition-all hover:scale-105"
              >
                + Add Location
              </Button>
            </div>

            {(!settings.allowed_locations || settings.allowed_locations.length === 0) ? (
              <div className="text-center py-12 border-2 border-dashed border-[#e2e8f0] bg-[#f8fafc] rounded-xl text-[#94a3b8] transition-all hover:border-[#cbd5e1]">
                <p className="font-medium">No fixed locations defined yet.</p>
                <p className="text-xs mt-1">Personnel can check in from anywhere with GPS enabled.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(settings.allowed_locations || []).map((loc, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-4 p-5 bg-[#ffffff] rounded-xl border border-[#e2e8f0] shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Location Name</label>
                      <Input
                        value={loc.name}
                        onChange={(e) => updateLocation(index, "name", e.target.value)}
                        placeholder="e.g. Headquarters"
                        className="bg-[#f8fafc] border-[#e2e8f0]"
                      />
                    </div>
                    <div className="w-full md:w-36">
                      <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Latitude</label>
                      <Input
                        type="number"
                        step="any"
                        value={loc.latitude}
                        onChange={(e) => updateLocation(index, "latitude", parseFloat(e.target.value) || 0)}
                        className="bg-[#f8fafc] border-[#e2e8f0] font-mono text-xs"
                      />
                    </div>
                    <div className="w-full md:w-36">
                      <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Longitude</label>
                      <Input
                        type="number"
                        step="any"
                        value={loc.longitude}
                        onChange={(e) => updateLocation(index, "longitude", parseFloat(e.target.value) || 0)}
                        className="bg-[#f8fafc] border-[#e2e8f0] font-mono text-xs"
                      />
                    </div>
                    <div className="w-full md:w-28">
                      <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Radius (M)</label>
                      <Input
                        type="number"
                        value={loc.radius_meters || ""}
                        onChange={(e) => updateLocation(index, "radius_meters", parseInt(e.target.value) || undefined)}
                        placeholder={(settings?.radius_meters || 100).toString()}
                        className="bg-[#f8fafc] border-[#e2e8f0] font-mono text-xs"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => openPicker(index)}
                        className="border-[#e2e8f0] text-[#4f46e5] hover:bg-[#eef2ff] hover:border-[#c7d2fe]"
                      >
                        <MapPin className="w-4 h-4 mr-2" />
                        Map
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => removeLocation(index)}
                        className="text-[#ef4444] hover:bg-[#fef2f2] px-3"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-5 bg-[#f8fafc] border-t border-[#e2e8f0] flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold px-8 shadow-lg transition-all"
          >
            {saving ? "Saving Changes..." : "Save Settings"}
          </Button>
        </div>
      </div>

      <LocationPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={onLocationPicked}
        initialLocation={
          activeLocationIndex !== null
            ? {
                lat: settings.allowed_locations[activeLocationIndex].latitude,
                lng: settings.allowed_locations[activeLocationIndex].longitude,
                radius: settings.allowed_locations[activeLocationIndex].radius_meters || settings.radius_meters,
              }
            : undefined
        }
      />
    </div>
  );
}
