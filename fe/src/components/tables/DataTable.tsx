"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Eye, EyeOff } from "lucide-react";
import { DataTablePagination } from "./DataTablePagination";
import { DataTableFilters } from "./DataTableFilters";
import { DataTableColumnVisibility } from "./DataTableColumnVisibility";
import { DataTableExport } from "./DataTableExport";
import { LoadingSpinner } from "@/components/utilities";
import { EmptyState } from "@/components/utilities";

export interface DataTableColumn<T> {
  key: string;
  title: string;
  dataIndex?: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
  align?: "left" | "center" | "right";
  render?: (value: any, row: T) => React.ReactNode;
  filterComponent?: React.ReactNode;
}

export interface PaginationConfig {
  pageSize?: number;
  pageSizeOptions?: number[];
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
}

export interface DataTableProps<T extends Record<string, any>> {
  data: T[];
  columns: DataTableColumn<T>[];
  loading?: boolean;
  pagination?: PaginationConfig;
  onRowClick?: (row: T) => void;
  onBulkAction?: (action: string, rows: T[]) => void;
  onExport?: (format: "csv" | "excel" | "pdf") => void;
  searchable?: boolean;
  filterable?: boolean;
  selectable?: boolean;
  expandable?: boolean;
  className?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
}

export const DataTable = React.memo(function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  pagination,
  onRowClick,
  onBulkAction,
  onExport,
  searchable = true,
  filterable = true,
  selectable = false,
  expandable = false,
  className,
  emptyMessage = "No data available",
  searchPlaceholder = "Search...",
}: DataTableProps<T>) {
  // Ensure data is always an array
  const safeData = React.useMemo(() => Array.isArray(data) ? data : [], [data]);
  
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Convert columns to TanStack Table format
  const tableColumns = React.useMemo<ColumnDef<T>[]>(() => {
    return columns.map((col) => ({
      id: col.key,
      accessorKey: col.dataIndex || col.key,
      header: col.title,
      cell: ({ row, getValue }) => {
        const value = getValue();
        return col.render ? col.render(value, row.original) : value;
      },
      enableSorting: col.sortable ?? true,
      enableColumnFilter: col.filterable ?? true,
      size: typeof col.width === "number" ? col.width : undefined,
    }));
  }, [columns]);

  const table = useReactTable({
    data: safeData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: pagination?.pageSize ?? 10,
      },
    },
  });

  const selectedRows = React.useMemo(() => {
    try {
      const rowModel = table.getFilteredSelectedRowModel();
      return rowModel?.rows?.map((row) => row.original) || [];
    } catch {
      return [];
    }
  }, [table]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search and Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {searchable && (
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          )}
          {filterable && (
            <DataTableFilters
              columns={columns}
              filters={columnFilters}
              onFilterChange={setColumnFilters}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectable && selectedRows.length > 0 && onBulkAction && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">
                {selectedRows.length} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAction("delete", selectedRows)}
              >
                Delete Selected
              </Button>
            </div>
          )}
          {onExport && (
            <DataTableExport
              data={data}
              columns={columns}
              onExport={onExport}
            />
          )}
          <DataTableColumnVisibility
            columns={columns}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {selectable && (
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={table.getIsAllPageRowsSelected()}
                      onChange={table.getToggleAllPageRowsSelectedHandler()}
                      className="rounded border-gray-300"
                    />
                  </TableHead>
                )}
                {headerGroup.headers.map((header) => {
                  const column = columns.find((col) => col.key === header.id);
                  return (
                    <TableHead
                      key={header.id}
                      style={{
                        width: typeof column?.width === "string" ? column.width : undefined,
                      }}
                      className={cn(
                        column?.align === "center" && "text-center",
                        column?.align === "right" && "text-right"
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            "flex items-center gap-2",
                            header.column.getCanSort() && "cursor-pointer select-none hover:text-slate-900"
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: " ↑",
                            desc: " ↓",
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {selectable && (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={row.getIsSelected()}
                        onChange={row.getToggleSelectedHandler()}
                        className="rounded border-gray-300"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                  )}
                  {row.getVisibleCells().map((cell) => {
                    const column = columns.find((col) => col.key === cell.column.id);
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          column?.align === "center" && "text-center",
                          column?.align === "right" && "text-right"
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="h-24 text-center">
                  <EmptyState
                    title="No data found"
                    description={emptyMessage}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && (
        <DataTablePagination
          table={table}
          pageSizeOptions={pagination.pageSizeOptions}
          showSizeChanger={pagination.showSizeChanger}
          showQuickJumper={pagination.showQuickJumper}
        />
      )}
    </div>
  );
}) as (<T extends Record<string, any>>(props: DataTableProps<T>) => React.ReactElement) & { displayName?: string };

DataTable.displayName = "DataTable";

