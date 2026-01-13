"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet, File } from "lucide-react";
import { DataTableColumn } from "./DataTable";

interface DataTableExportProps<T extends Record<string, any>> {
  data: T[];
  columns: DataTableColumn<T>[];
  onExport?: (format: "csv" | "excel" | "pdf") => void;
}

export function DataTableExport<T extends Record<string, any>>({
  data,
  columns,
  onExport,
}: DataTableExportProps<T>) {
  const exportToCSV = () => {
    const headers = columns.map((col) => col.title).join(",");
    const rows = data.map((row) =>
      columns
        .map((col) => {
          const value = col.dataIndex
            ? row[col.dataIndex]
            : row[col.key];
          return `"${String(value || "").replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `export_${new Date().getTime()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onExport?.("csv");
  };

  const exportToExcel = () => {
    // For Excel export, we'll use CSV format (can be enhanced with xlsx library)
    exportToCSV();
    onExport?.("excel");
  };

  const exportToPDF = () => {
    // PDF export would require a library like jsPDF
    // For now, we'll just call the callback
    onExport?.("pdf");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF}>
          <File className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

