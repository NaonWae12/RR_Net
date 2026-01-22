"use client";

import React from "react";
import { Reimbursement } from "@/lib/api/types";
import { format } from "date-fns";
import { PhotoIcon } from "@heroicons/react/20/solid";

interface ReimbursementCardProps {
  reimbursement: Reimbursement;
  onView?: (id: string) => void;
}

export function ReimbursementCard({ reimbursement, onView }: ReimbursementCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "submitted":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return "Approved";
      case "rejected":
        return "Rejected";
      case "submitted":
        return "Pending Approval";
      default:
        return status;
    }
  };

  return (
    <div
      className={`bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow ${
        onView ? "cursor-pointer" : ""
      }`}
      onClick={() => onView?.(reimbursement.id)}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-slate-900">
            {new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: "IDR",
              minimumFractionDigits: 0,
            }).format(reimbursement.amount)}
          </h3>
          <p className="text-sm text-slate-600 mt-1 capitalize">
            {reimbursement.category.replace(/_/g, " ")}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getStatusColor(
            reimbursement.status
          )}`}
        >
          {getStatusLabel(reimbursement.status)}
        </span>
      </div>

      <p className="text-sm text-slate-700 line-clamp-2 mb-2">{reimbursement.description}</p>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{format(new Date(reimbursement.date), "PP")}</span>
        {reimbursement.attachment_url && (
          <div className="flex items-center gap-1 text-indigo-600">
            <PhotoIcon className="h-4 w-4" />
            <span>Has attachment</span>
          </div>
        )}
      </div>

      {reimbursement.rejection_reason && reimbursement.status === "rejected" && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs text-red-600">
            <span className="font-medium">Rejection reason:</span> {reimbursement.rejection_reason}
          </p>
        </div>
      )}
    </div>
  );
}


