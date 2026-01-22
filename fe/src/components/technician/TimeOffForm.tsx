"use client";

import React, { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { CreateTimeOffRequest, TimeOffType } from "@/lib/api/types";
import { format, differenceInDays, parseISO } from "date-fns";
import { PhotoIcon, TrashIcon } from "@heroicons/react/20/solid";

const timeOffFormSchema = z.object({
  type: z.enum(["leave", "sick", "emergency"]),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  reason: z.string().min(1, "Reason is required"),
}).refine((data) => {
  const start = parseISO(data.start_date);
  const end = parseISO(data.end_date);
  return end >= start;
}, {
  message: "End date must be after or equal to start date",
  path: ["end_date"],
});

type TimeOffFormValues = z.infer<typeof timeOffFormSchema>;

interface TimeOffFormProps {
  onSubmit: (data: CreateTimeOffRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

const timeOffTypes: TimeOffType[] = ["leave", "sick", "emergency"];

export function TimeOffForm({ onSubmit, onCancel, isLoading }: TimeOffFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [daysCount, setDaysCount] = useState<number>(0);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TimeOffFormValues>({
    resolver: zodResolver(timeOffFormSchema),
    defaultValues: {
      type: "leave",
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: format(new Date(), "yyyy-MM-dd"),
      reason: "",
    },
  });

  const startDate = watch("start_date");
  const endDate = watch("end_date");

  useEffect(() => {
    if (startDate && endDate) {
      try {
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        const days = differenceInDays(end, start) + 1; // Inclusive
        setDaysCount(days > 0 ? days : 0);
      } catch {
        setDaysCount(0);
      }
    }
  }, [startDate, endDate]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB");
        return;
      }
      setSelectedFile(file);
      const preview = URL.createObjectURL(file);
      setFilePreview(preview);
    }
  };

  const handleRemoveFile = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(null);
    setFilePreview(null);
  };

  const handleFormSubmit = async (data: TimeOffFormValues) => {
    const submitData: CreateTimeOffRequest = {
      ...data,
      attachment: selectedFile || undefined,
    };
    await onSubmit(submitData);
    // Reset file after submit
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(null);
    setFilePreview(null);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700">Type</label>
        <SimpleSelect
          value={watch("type")}
          onValueChange={(value) => setValue("type", value as TimeOffType)}
          className="w-full"
        >
          <option value="leave">Leave (Cuti)</option>
          <option value="sick">Sick (Sakit)</option>
          <option value="emergency">Emergency (Darurat)</option>
        </SimpleSelect>
        <p className="text-xs text-slate-500 mt-1">
          <span className="font-medium">Note:</span> Leave = Cuti, Sick = Sakit, Emergency = Darurat
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Start Date</label>
          <Input type="date" {...register("start_date")} error={errors.start_date?.message} className="w-full" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">End Date</label>
          <Input type="date" {...register("end_date")} error={errors.end_date?.message} className="w-full" />
        </div>
      </div>

      {daysCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Days requested:</span> {daysCount} day{daysCount > 1 ? "s" : ""}
          </p>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-slate-700">Reason</label>
        <textarea
          {...register("reason")}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          rows={4}
          placeholder="Explain the reason for your time off request..."
        />
        {errors.reason && <p className="text-xs text-red-500 mt-1">{errors.reason.message}</p>}
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Attachment (Optional, Max 5MB)
          <span className="text-xs text-slate-500 ml-1">
            (e.g., medical certificate for sick leave)
          </span>
        </label>
        {!selectedFile ? (
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md hover:border-slate-400 transition-colors">
            <div className="space-y-1 text-center">
              <PhotoIcon className="mx-auto h-12 w-12 text-slate-400" />
              <div className="flex text-sm text-slate-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500"
                >
                  <span>Upload a file</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-slate-500">PNG, JPG, PDF up to 5MB</p>
            </div>
          </div>
        ) : (
          <div className="mt-1 relative">
            {filePreview && filePreview.startsWith("blob:") ? (
              <div className="relative w-full h-48 rounded-md overflow-hidden border border-slate-200">
                <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-200">
                <span className="text-sm text-slate-700">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="text-red-600 hover:text-red-700"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} variant="default">
          {isLoading ? "Submitting..." : "Submit Request"}
        </Button>
      </div>
    </form>
  );
}


