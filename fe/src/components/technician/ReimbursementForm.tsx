"use client";

import React, { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { CreateReimbursementRequest, ReimbursementCategory } from "@/lib/api/types";
import { format } from "date-fns";
import { PhotoIcon, TrashIcon } from "@heroicons/react/20/solid";

const reimbursementFormSchema = z.object({
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  category: z.enum(["transport", "meal", "accommodation", "equipment", "other"]),
  description: z.string().min(1, "Description is required"),
  date: z.string().min(1, "Date is required"),
});

type ReimbursementFormValues = z.infer<typeof reimbursementFormSchema>;

interface ReimbursementFormProps {
  onSubmit: (data: CreateReimbursementRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

const categories: ReimbursementCategory[] = [
  "transport",
  "meal",
  "accommodation",
  "equipment",
  "other",
];

export function ReimbursementForm({ onSubmit, onCancel, isLoading }: ReimbursementFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReimbursementFormValues>({
    resolver: zodResolver(reimbursementFormSchema),
    defaultValues: {
      amount: 0,
      category: "transport",
      description: "",
      date: format(new Date(), "yyyy-MM-dd"),
    },
  });

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

  const handleFormSubmit = async (data: ReimbursementFormValues) => {
    const submitData: CreateReimbursementRequest = {
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Amount</label>
          <Input
            type="number"
            step="0.01"
            {...register("amount")}
            error={errors.amount?.message}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Category</label>
          <SimpleSelect
            value={watch("category")}
            onValueChange={(value) => setValue("category", value as ReimbursementCategory)}
            className="w-full"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " ")}
              </option>
            ))}
          </SimpleSelect>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Date</label>
        <Input type="date" {...register("date")} error={errors.date?.message} className="w-full" />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Description</label>
        <textarea
          {...register("description")}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          rows={4}
          placeholder="Describe the expense..."
        />
        {errors.description && (
          <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>
        )}
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Attachment (Optional, Max 5MB)
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


