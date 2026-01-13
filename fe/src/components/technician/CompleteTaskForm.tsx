"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompleteTaskRequest } from "@/lib/api/types";

const completeTaskFormSchema = z.object({
  actual_hours: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type CompleteTaskFormValues = z.infer<typeof completeTaskFormSchema>;

interface CompleteTaskFormProps {
  onSubmit: (data: CompleteTaskRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function CompleteTaskForm({ onSubmit, onCancel, isLoading }: CompleteTaskFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompleteTaskFormValues>({
    resolver: zodResolver(completeTaskFormSchema),
    defaultValues: {
      actual_hours: undefined,
      notes: "",
    },
  });

  const handleFormSubmit = async (data: CompleteTaskFormValues) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Input
        label="Actual Hours"
        type="number"
        step="0.1"
        {...register("actual_hours")}
        error={errors.actual_hours?.message}
      />

      <div>
        <label className="text-sm font-medium text-slate-700">Completion Notes</label>
        <textarea
          {...register("notes")}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          rows={4}
          placeholder="Add any notes about task completion..."
        />
        {errors.notes && <p className="text-xs text-red-500 mt-1">{errors.notes.message}</p>}
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} variant="default">
          {isLoading ? "Completing..." : "Complete Task"}
        </Button>
      </div>
    </form>
  );
}

