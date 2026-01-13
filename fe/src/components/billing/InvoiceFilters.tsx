"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/select";
import { useBillingStore } from "@/stores/billingStore";
import { useEffect, useState } from "react";
import clientGroupService, { ClientGroup } from "@/lib/api/clientGroupService";

export function InvoiceFilters() {
  const { invoiceFilters, setInvoiceFilters, fetchInvoices } = useBillingStore();
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, [invoiceFilters, fetchInvoices]);

  useEffect(() => {
    const loadGroups = async () => {
      setLoadingGroups(true);
      try {
        const groups = await clientGroupService.list();
        setClientGroups(groups || []);
      } catch (error) {
        console.error("Failed to load client groups:", error);
      } finally {
        setLoadingGroups(false);
      }
    };
    loadGroups();
  }, []);

  return (
    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
      <Input
        placeholder="Client Name (optional)"
        value={invoiceFilters.client_name || ""}
        onChange={(e) => setInvoiceFilters({ client_name: e.target.value || undefined })}
        className="w-full sm:max-w-xs"
      />
      <Input
        placeholder="Contact / Phone (optional)"
        value={invoiceFilters.phone || ""}
        onChange={(e) => setInvoiceFilters({ phone: e.target.value || undefined })}
        className="w-full sm:max-w-xs"
      />
      <Input
        placeholder="Alamat (optional)"
        value={invoiceFilters.address || ""}
        onChange={(e) => setInvoiceFilters({ address: e.target.value || undefined })}
        className="w-full sm:max-w-xs"
      />
      <SimpleSelect
        value={invoiceFilters.group_id || ""}
        onValueChange={(value) => setInvoiceFilters({ group_id: value || undefined })}
        placeholder="Filter by Group"
        className="w-full sm:max-w-[180px]"
        disabled={loadingGroups}
      >
        <option value="">All Groups</option>
        {clientGroups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </SimpleSelect>
      <SimpleSelect
        value={invoiceFilters.status || ""}
        onValueChange={(value) => setInvoiceFilters({ status: value || undefined })}
        placeholder="Filter by Status"
        className="w-full sm:max-w-[180px]"
      >
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="pending">Pending</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
        <option value="cancelled">Cancelled</option>
      </SimpleSelect>
      <Button onClick={() => setInvoiceFilters({})} variant="outline">
        Reset Filters
      </Button>
    </div>
  );
}

