"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { PaymentMethod, RecordPaymentRequest } from "@/lib/api/types";

const paymentFormSchema = z.object({
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  method: z.enum(["cash", "bank_transfer", "e_wallet", "qris", "virtual_account", "collector"]),
  reference: z.string().optional(),
  collector_id: z.string().optional(),
  notes: z.string().optional(),
  received_at: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface PaymentFormProps {
  invoiceId: string;
  maxAmount?: number;
  onSubmit: (data: RecordPaymentRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function PaymentForm({ invoiceId, maxAmount, onSubmit, onCancel, isLoading }: PaymentFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      method: "cash",
      received_at: new Date().toISOString().slice(0, 16),
    },
  });

  const method = watch("method");

  const handleFormSubmit = async (data: PaymentFormValues) => {
    const paymentData: RecordPaymentRequest = {
      invoice_id: invoiceId,
      amount: data.amount,
      method: data.method as PaymentMethod,
      reference: data.reference || undefined,
      collector_id: data.collector_id || undefined,
      notes: data.notes || undefined,
      received_at: data.received_at || undefined,
    };
    await onSubmit(paymentData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700">Amount</label>
        <Input
          type="number"
          step="0.01"
          {...register("amount")}
          error={errors.amount?.message}
          placeholder={maxAmount ? `Max: ${maxAmount.toLocaleString()}` : "Enter amount"}
        />
        {maxAmount && (
          <p className="text-xs text-slate-500 mt-1">Maximum: {maxAmount.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Payment Method</label>
        <SimpleSelect
          value={method}
          onValueChange={(value) => setValue("method", value as PaymentMethod)}
        >
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="e_wallet">E-Wallet</option>
          <option value="qris">QRIS</option>
          <option value="virtual_account">Virtual Account</option>
          <option value="collector">Collector</option>
        </SimpleSelect>
        {errors.method && <p className="text-xs text-red-500 mt-1">{errors.method.message}</p>}
      </div>

      {method === "collector" && (
        <div>
          <label className="text-sm font-medium text-slate-700">Collector ID</label>
          <Input
            {...register("collector_id")}
            error={errors.collector_id?.message}
            placeholder="Enter collector user ID"
          />
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-slate-700">Reference Number (optional)</label>
        <Input
          {...register("reference")}
          error={errors.reference?.message}
          placeholder="Transaction reference"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Received At</label>
        <Input
          type="datetime-local"
          {...register("received_at")}
          error={errors.received_at?.message}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Notes (optional)</label>
        <textarea
          {...register("notes")}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          rows={3}
          placeholder="Additional notes"
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Recording..." : "Record Payment"}
        </Button>
      </div>
    </form>
  );
}

