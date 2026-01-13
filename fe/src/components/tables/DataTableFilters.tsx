"use client";

import * as React from "react";
import { ColumnFiltersState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataTableColumn } from "./DataTable";

interface DataTableFiltersProps<T> {
  columns: DataTableColumn<T>[];
  filters: ColumnFiltersState;
  onFilterChange: (filters: ColumnFiltersState) => void;
}

export function DataTableFilters<T>({
  columns,
  filters,
  onFilterChange,
}: DataTableFiltersProps<T>) {
  const [isOpen, setIsOpen] = React.useState(false);
  const filterableColumns = columns.filter((col) => col.filterable);

  const handleFilterChange = (columnId: string, value: string) => {
    const newFilters = filters.filter((f) => f.id !== columnId);
    if (value) {
      newFilters.push({ id: columnId, value });
    }
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    onFilterChange([]);
  };

  const activeFiltersCount = filters.length;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Filter className="h-4 w-4 mr-2" />
        Filters
        {activeFiltersCount > 0 && (
          <span className="ml-2 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs">
            {activeFiltersCount}
          </span>
        )}
      </Button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-background border rounded-md shadow-lg z-50 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Filters</h3>
            <div className="flex items-center gap-2">
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-8"
                >
                  Clear all
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {filterableColumns.map((column) => {
              const filter = filters.find((f) => f.id === column.key);
              return (
                <div key={column.key} className="space-y-2">
                  <label className="text-sm font-medium">{column.title}</label>
                  {column.filterComponent ? (
                    column.filterComponent
                  ) : (
                    <Input
                      placeholder={`Filter ${column.title.toLowerCase()}...`}
                      value={(filter?.value as string) || ""}
                      onChange={(e) => handleFilterChange(column.key, e.target.value)}
                      className="h-9"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

