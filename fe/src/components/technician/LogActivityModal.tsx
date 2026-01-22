"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTechnicianStore } from "@/stores/technicianStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { XMarkIcon, PhotoIcon } from "@heroicons/react/20/solid";

const activityTypeOptions = [
  { value: "task_start", label: "Task Start" },
  { value: "task_progress", label: "Task Progress" },
  { value: "task_complete", label: "Task Complete" },
  { value: "site_visit", label: "Site Visit" },
  { value: "equipment_check", label: "Equipment Check" },
  { value: "issue_found", label: "Issue Found" },
  { value: "issue_resolved", label: "Issue Resolved" },
  { value: "other", label: "Other" },
];

const logActivitySchema = z.object({
  activity_type: z.string().min(1, "Activity type is required"),
  description: z.string().min(1, "Description is required"),
});

type LogActivityFormValues = z.infer<typeof logActivitySchema>;

interface LogActivityModalProps {
  taskId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function LogActivityModal({ taskId, onClose, onSuccess }: LogActivityModalProps) {
  const handleClose = () => {
    // Clean up photo previews to prevent memory leaks
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPhotos([]);
    setPhotoPreviews([]);
    onClose();
  };
  const { logActivity, loading } = useTechnicianStore();
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LogActivityFormValues>({
    resolver: zodResolver(logActivitySchema),
    defaultValues: {
      activity_type: "",
      description: "",
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPhotos = [...photos, ...files].slice(0, 5); // Max 5 photos
    setPhotos(newPhotos);

    // Create previews
    const newPreviews = newPhotos.map((file) => URL.createObjectURL(file));
    setPhotoPreviews(newPreviews);
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    const newPreviews = photoPreviews.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    setPhotoPreviews(newPreviews);
    // Revoke object URLs to prevent memory leaks
    URL.revokeObjectURL(photoPreviews[index]);
  };

  const onSubmit = async (data: LogActivityFormValues) => {
    try {
      // TODO: Upload photos to storage service (S3/Cloudinary/etc) and get URLs
      // Backend expects photo_urls as array of string URLs
      // For now, if photos are selected, we'll send empty array
      // Photo upload will be implemented when backend storage is configured
      const photoUrls: string[] = [];
      
      if (photos.length > 0) {
        // Photo upload not yet implemented - backend needs file upload endpoint
        // For now, log activity without photos
        console.warn("Photo upload not yet implemented. Logging activity without photos.");
      }

      await logActivity({
        task_id: taskId,
        activity_type: data.activity_type,
        description: data.description,
        photo_urls: photoUrls,
      });

      // Clean up photo previews
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
      setPhotos([]);
      setPhotoPreviews([]);

      onSuccess();
    } catch (error) {
      console.error("Failed to log activity:", error);
      // Error handling is done in the store
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Log Activity</h2>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          {/* Activity Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Activity Type *
            </label>
            <SimpleSelect
              value={watch("activity_type")}
              onValueChange={(value) => setValue("activity_type", value)}
              className="w-full"
            >
              <option value="">Select activity type</option>
              {activityTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SimpleSelect>
            {errors.activity_type && (
              <p className="text-xs text-red-500 mt-1">{errors.activity_type.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description *
            </label>
            <textarea
              {...register("description")}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              rows={4}
              placeholder="Describe what you did..."
            />
            {errors.description && (
              <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>
            )}
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Photos (optional, max 5)
            </label>
            <div className="space-y-2">
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photoPreviews.map((preview, index) => (
                    <div key={index} className="relative">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length < 5 && (
                <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center">
                    <PhotoIcon className="h-6 w-6 text-slate-400 mb-1" />
                    <span className="text-sm text-slate-600">Add Photo</span>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Logging..." : "Log Activity"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

