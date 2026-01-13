"use client";

import { useEffect, useMemo, useState } from "react";
import { billingService } from "@/lib/api/billingService";
import type { PaymentMatrixCellStatus, PaymentMatrixEntry } from "@/lib/api/types";
import clientGroupService, { ClientGroup } from "@/lib/api/clientGroupService";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";

const MONTH_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

function cellStyle(status: PaymentMatrixCellStatus) {
  switch (status) {
    case "paid_on_time":
      return "bg-lime-400 text-slate-900";
    case "paid_late":
      return "bg-lime-200 text-slate-900";
    case "pending":
      return "bg-yellow-300 text-slate-900";
    case "overdue":
      return "bg-red-400 text-white";
    case "cancelled":
      return "bg-slate-300 text-slate-700";
    case "empty":
    default:
      return "bg-slate-100 text-slate-400";
  }
}

function showCheck(status: PaymentMatrixCellStatus) {
  return status === "paid_on_time" || status === "paid_late";
}

export function PaymentsMatrixView() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<PaymentMatrixEntry[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const showYearFilter = availableYears.length > 1;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await clientGroupService.list();
        if (!alive) return;
        setGroups(list || []);
      } catch (e) {
        // ignore - optional filter
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const queryParams = useMemo(() => {
    return {
      year,
      q: q || undefined,
      group_id: groupId || undefined,
      status: status || undefined,
    };
  }, [year, q, groupId, status]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await billingService.getPaymentMatrix(queryParams);
        if (!alive) return;
        setEntries(res.data || []);
        setAvailableYears(res.available_years || [res.year ?? year]);
        if (res.year && res.year !== year) setYear(res.year);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load payment matrix");
        setEntries([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [queryParams]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500">Error loading matrix: {error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        {showYearFilter && (
          <SimpleSelect
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
            className="w-full sm:max-w-[140px]"
          >
            {availableYears.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </SimpleSelect>
        )}
        <Input
          placeholder="Search client (name/phone/code)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <SimpleSelect
          value={groupId}
          onValueChange={(v) => setGroupId(v)}
          placeholder="Filter by Group"
          className="w-full sm:max-w-[200px]"
        >
          <option value="">All Groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </SimpleSelect>
        <SimpleSelect
          value={status}
          onValueChange={(v) => setStatus(v)}
          placeholder="Filter by Status"
          className="w-full sm:max-w-[200px]"
        >
          <option value="">All Status</option>
          <option value="paid">Paid (any)</option>
          <option value="paid_on_time">Paid on time</option>
          <option value="paid_late">Paid late</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
          <option value="empty">No invoice</option>
        </SimpleSelect>
        <Button
          variant="outline"
          onClick={() => {
            setQ("");
            setGroupId("");
            setStatus("");
          }}
        >
          Reset
        </Button>
      </div>

      {/* Matrix table */}
      {!entries || entries.length === 0 ? (
        <div className="text-center py-8 text-slate-500">No data found for this year/filter.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-auto">
          <table className="min-w-[980px] w-full">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Harga</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Paket</th>
                {MONTH_LABELS.map((m) => (
                  <th key={m} className="px-2 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {entries.map((row) => (
                <tr key={row.client_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-slate-900">{row.client_name}</div>
                    <div className="text-xs text-slate-500">{row.client_group_name || "-"}</div>
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(
                      row.amount || 0
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate" title={row.package_name || undefined}>
                    {row.package_name || "-"}
                  </td>
                  {MONTH_LABELS.map((_, idx) => {
                    const cell = row.months?.[idx];
                    const st = (cell?.status || "empty") as PaymentMatrixCellStatus;
                    return (
                      <td key={idx} className="px-2 py-3">
                        <div
                          className={[
                            "w-8 h-8 rounded flex items-center justify-center text-sm font-semibold",
                            cellStyle(st),
                          ].join(" ")}
                          title={st}
                        >
                          {showCheck(st) ? "✓" : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className={`w-4 h-4 rounded ${cellStyle("paid_on_time")}`} /> Paid (on time)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className={`w-4 h-4 rounded ${cellStyle("paid_late")}`} /> Paid (late)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className={`w-4 h-4 rounded ${cellStyle("pending")}`} /> Pending
        </span>
        <span className="inline-flex items-center gap-2">
          <span className={`w-4 h-4 rounded ${cellStyle("overdue")}`} /> Overdue
        </span>
      </div>
    </div>
  );
}


