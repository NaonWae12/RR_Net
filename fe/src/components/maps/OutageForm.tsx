"use client";

import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { ReportOutageRequest, NodeType } from "@/lib/api/types";

const outageFormSchema = z.object({
  node_type: z.enum(["odc", "odp", "client"]),
  node_id: z.string().min(1, "Node ID is required"),
  reason: z.string().min(1, "Reason is required"),
});

type OutageFormValues = z.infer<typeof outageFormSchema>;

interface OutageFormProps {
  nodeType?: NodeType;
  nodeId?: string;
  onSubmit: (data: ReportOutageRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function OutageForm({ nodeType, nodeId, onSubmit, onCancel, isLoading }: OutageFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OutageFormValues>({
    resolver: zodResolver(outageFormSchema),
    defaultValues: {
      node_type: nodeType || "client",
      node_id: nodeId || "",
      reason: "",
    },
  });

  useEffect(() => {
    if (nodeType) setValue("node_type", nodeType);
    if (nodeId) setValue("node_id", nodeId);
  }, [nodeType, nodeId, setValue]);

  const handleFormSubmit = async (data: OutageFormValues) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <SimpleSelect
        value={watch("node_type")}
        onValueChange={(value) => setValue("node_type", value as NodeType)}
        className="w-full"
      >
        <option value="odc">ODC</option>
        <option value="odp">ODP</option>
        <option value="client">Client</option>
      </SimpleSelect>
      {errors.node_type && <p className="text-xs text-red-500">{errors.node_type.message}</p>}

      <Input
        label="Node ID"
        {...register("node_id")}
        error={errors.node_id?.message}
        disabled={!!nodeId}
      />

      <div>
        <label className="text-sm font-medium text-slate-700">Reason</label>
        <textarea
          {...register("reason")}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          rows={3}
          placeholder="Describe the outage reason..."
        />
        {errors.reason && <p className="text-xs text-red-500 mt-1">{errors.reason.message}</p>}
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} variant="destructive">
          {isLoading ? "Reporting..." : "Report Outage"}
        </Button>
      </div>
    </form>
  );
}

