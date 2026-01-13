"use client";

import * as React from "react";
import { VisibilityState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye } from "lucide-react";
import { DataTableColumn } from "./DataTable";

interface DataTableColumnVisibilityProps<T> {
  columns: DataTableColumn<T>[];
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (visibility: VisibilityState) => void;
}

export function DataTableColumnVisibility<T>({
  columns,
  columnVisibility,
  onColumnVisibilityChange,
}: DataTableColumnVisibilityProps<T>) {
  const handleToggleColumn = (columnKey: string, visible: boolean) => {
    onColumnVisibilityChange({
      ...columnVisibility,
      [columnKey]: visible,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-white">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={columnVisibility[column.key] !== false}
            onCheckedChange={(checked) => handleToggleColumn(column.key, checked)}
          >
            {column.title}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

