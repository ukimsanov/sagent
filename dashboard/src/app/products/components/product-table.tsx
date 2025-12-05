"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type Row,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  CircleXIcon,
  Columns3Icon,
  EllipsisIcon,
  FilterIcon,
  ListFilterIcon,
  Package,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductWithImages } from "@/lib/db";

interface ProductTableProps {
  products: ProductWithImages[];
  categories: string[];
  onToggleStock: (productId: string, inStock: boolean) => void;
  onDelete: (productIds: string[]) => void;
  updatingId?: string | null;
}

// Custom filter function for multi-column searching
const multiColumnFilterFn: FilterFn<ProductWithImages> = (row, _columnId, filterValue) => {
  const searchableRowContent =
    `${row.original.name} ${row.original.description || ""} ${row.original.category || ""}`.toLowerCase();
  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableRowContent.includes(searchTerm);
};

const categoryFilterFn: FilterFn<ProductWithImages> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue?.length) return true;
  const category = row.getValue(columnId) as string;
  return filterValue.includes(category);
};

function getColumns(
  onToggleStock: (productId: string, inStock: boolean) => void,
  updatingId?: string | null
): ColumnDef<ProductWithImages>[] {
  return [
    {
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
        />
      ),
      enableHiding: false,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all"
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      ),
      id: "select",
      size: 40,
    },
    {
      accessorKey: "image",
      cell: ({ row }) => {
        const hasImage = row.original.image_urls.length > 0;
        const imageUrl = hasImage ? row.original.image_urls[0] : null;
        return (
          <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={row.original.name}
                fill
                className="object-cover"
                sizes="48px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Package className="h-5 w-5 text-muted-foreground/40" />
              </div>
            )}
          </div>
        );
      },
      enableHiding: false,
      enableSorting: false,
      header: "Image",
      size: 70,
    },
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <Link href={`/products/${row.original.id}`} className="group/link block">
          <div className="font-medium text-foreground group-hover/link:text-primary transition-colors">
            {row.getValue("name")}
          </div>
          {row.original.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {row.original.description}
            </p>
          )}
        </Link>
      ),
      enableHiding: false,
      filterFn: multiColumnFilterFn,
      header: "Product",
      size: 250,
    },
    {
      accessorKey: "category",
      cell: ({ row }) => {
        const category = row.getValue("category") as string | null;
        return category ? (
          <Badge variant="outline" className="font-normal">
            {category}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      filterFn: categoryFilterFn,
      header: "Category",
      size: 140,
    },
    {
      accessorKey: "price",
      cell: ({ row }) => {
        const price = row.original.price;
        if (price === null) return <span className="text-muted-foreground">—</span>;
        const formatted = new Intl.NumberFormat("en-US", {
          currency: row.original.currency,
          style: "currency",
        }).format(price);
        return <span className="font-medium">{formatted}</span>;
      },
      header: "Price",
      size: 110,
    },
    {
      accessorKey: "in_stock",
      cell: ({ row }) => {
        const isInStock = row.original.in_stock === 1;
        const isUpdating = updatingId === row.original.id;
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={isInStock}
              onCheckedChange={(checked) => onToggleStock(row.original.id, checked)}
              disabled={isUpdating}
              className="data-[state=checked]:bg-emerald-500"
            />
            <span
              className={cn(
                "text-xs",
                isInStock ? "text-emerald-600" : "text-muted-foreground"
              )}
            >
              {isInStock ? "In Stock" : "Out"}
            </span>
          </div>
        );
      },
      header: "Stock",
      size: 120,
    },
    {
      cell: ({ row }) => <RowActions row={row} />,
      enableHiding: false,
      header: () => <span className="sr-only">Actions</span>,
      id: "actions",
      size: 60,
    },
  ];
}

export function ProductTable({
  products,
  categories,
  onToggleStock,
  onDelete,
  updatingId,
}: ProductTableProps) {
  const id = useId();
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [rowSelection, setRowSelection] = useState({});

  const [sorting, setSorting] = useState<SortingState>([
    {
      desc: true,
      id: "name",
    },
  ]);

  const columns = useMemo(
    () => getColumns(onToggleStock, updatingId),
    [onToggleStock, updatingId]
  );

  const table = useReactTable({
    columns,
    data: products,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      columnFilters,
      columnVisibility,
      pagination,
      rowSelection,
      sorting,
    },
  });

  const handleDeleteRows = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const ids = selectedRows.map((row) => row.original.id);
    onDelete(ids);
    table.resetRowSelection();
  };

  // Get unique category values
  const uniqueCategoryValues = useMemo(() => {
    return categories.sort();
  }, [categories]);

  // Get counts for each category
  const categoryCounts = useMemo(() => {
    const categoryColumn = table.getColumn("category");
    if (!categoryColumn) return new Map();
    return categoryColumn.getFacetedUniqueValues();
  }, [table]);

  const selectedCategories = useMemo(() => {
    const filterValue = table.getColumn("category")?.getFilterValue() as string[];
    return filterValue ?? [];
  }, [table]);

  const handleCategoryChange = (checked: boolean, value: string) => {
    const filterValue = table.getColumn("category")?.getFilterValue() as string[];
    const newFilterValue = filterValue ? [...filterValue] : [];

    if (checked) {
      newFilterValue.push(value);
    } else {
      const index = newFilterValue.indexOf(value);
      if (index > -1) {
        newFilterValue.splice(index, 1);
      }
    }

    table
      .getColumn("category")
      ?.setFilterValue(newFilterValue.length ? newFilterValue : undefined);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Filter by name */}
          <div className="relative">
            <Input
              aria-label="Filter by name or description"
              className={cn(
                "peer min-w-60 ps-9",
                Boolean(table.getColumn("name")?.getFilterValue()) && "pe-9",
              )}
              id={`${id}-input`}
              onChange={(e) =>
                table.getColumn("name")?.setFilterValue(e.target.value)
              }
              placeholder="Search products..."
              ref={inputRef}
              type="text"
              value={
                (table.getColumn("name")?.getFilterValue() ?? "") as string
              }
            />
            <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-muted-foreground/80 peer-disabled:opacity-50">
              <ListFilterIcon aria-hidden="true" size={16} />
            </div>
            {Boolean(table.getColumn("name")?.getFilterValue()) && (
              <button
                aria-label="Clear filter"
                className="absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md text-muted-foreground/80 outline-none transition-[color,box-shadow] hover:text-foreground focus:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  table.getColumn("name")?.setFilterValue("");
                  if (inputRef.current) {
                    inputRef.current.focus();
                  }
                }}
                type="button"
              >
                <CircleXIcon aria-hidden="true" size={16} />
              </button>
            )}
          </div>
          {/* Filter by category */}
          {uniqueCategoryValues.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <FilterIcon
                    aria-hidden="true"
                    className="-ms-1 opacity-60"
                    size={16}
                  />
                  Category
                  {selectedCategories.length > 0 && (
                    <span className="-me-1 inline-flex h-5 max-h-full items-center rounded border bg-background px-1 font-[inherit] font-medium text-[0.625rem] text-muted-foreground/70">
                      {selectedCategories.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto min-w-36 p-3">
                <div className="space-y-3">
                  <div className="font-medium text-muted-foreground text-xs">
                    Filter by category
                  </div>
                  <div className="space-y-3">
                    {uniqueCategoryValues.map((value, i) => (
                      <div className="flex items-center gap-2" key={value}>
                        <Checkbox
                          checked={selectedCategories.includes(value)}
                          id={`${id}-cat-${i}`}
                          onCheckedChange={(checked: boolean) =>
                            handleCategoryChange(checked, value)
                          }
                        />
                        <Label
                          className="flex grow justify-between gap-2 font-normal"
                          htmlFor={`${id}-cat-${i}`}
                        >
                          {value}
                          <span className="ms-2 text-muted-foreground text-xs">
                            {categoryCounts.get(value) || 0}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          {/* Toggle columns visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Columns3Icon
                  aria-hidden="true"
                  className="-ms-1 opacity-60"
                  size={16}
                />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      checked={column.getIsVisible()}
                      className="capitalize"
                      key={column.id}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                      onSelect={(event) => event.preventDefault()}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-3">
          {/* Delete button */}
          {table.getSelectedRowModel().rows.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="ml-auto" variant="outline">
                  <TrashIcon
                    aria-hidden="true"
                    className="-ms-1 opacity-60"
                    size={16}
                  />
                  Delete
                  <span className="-me-1 inline-flex h-5 max-h-full items-center rounded border bg-background px-1 font-[inherit] font-medium text-[0.625rem] text-muted-foreground/70">
                    {table.getSelectedRowModel().rows.length}
                  </span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <div className="flex flex-col gap-2 max-sm:items-center sm:flex-row sm:gap-4">
                  <div
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border"
                  >
                    <CircleAlertIcon className="opacity-80" size={16} />
                  </div>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete {table.getSelectedRowModel().rows.length} product{table.getSelectedRowModel().rows.length === 1 ? "" : "s"}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the selected products from your catalog.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteRows}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {/* Add product button */}
          <Button asChild>
            <Link href="/products/new">
              <PlusIcon
                aria-hidden="true"
                className="-ms-1 opacity-60"
                size={16}
              />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-background">
        <Table className="table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow className="hover:bg-transparent" key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      className="h-11"
                      key={header.id}
                      style={{ width: `${header.getSize()}px` }}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <div
                          className={cn(
                            header.column.getCanSort() &&
                              "flex h-full cursor-pointer select-none items-center justify-between gap-2",
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                          onKeyDown={(e) => {
                            if (
                              header.column.getCanSort() &&
                              (e.key === "Enter" || e.key === " ")
                            ) {
                              e.preventDefault();
                              header.column.getToggleSortingHandler()?.(e);
                            }
                          }}
                          tabIndex={header.column.getCanSort() ? 0 : undefined}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {{
                            asc: (
                              <ChevronUpIcon
                                aria-hidden="true"
                                className="shrink-0 opacity-60"
                                size={16}
                              />
                            ),
                            desc: (
                              <ChevronDownIcon
                                aria-hidden="true"
                                className="shrink-0 opacity-60"
                                size={16}
                              />
                            ),
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
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
                  data-state={row.getIsSelected() && "selected"}
                  key={row.id}
                  className="group"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell className="last:py-0" key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-32 text-center"
                  colSpan={columns.length}
                >
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="h-8 w-8 opacity-50" />
                    <p>No products found</p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/products/new">Add your first product</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-8">
        {/* Results per page */}
        <div className="flex items-center gap-3">
          <Label className="max-sm:sr-only" htmlFor={id}>
            Rows per page
          </Label>
          <Select
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
            value={table.getState().pagination.pageSize.toString()}
          >
            <SelectTrigger className="w-fit whitespace-nowrap" id={id}>
              <SelectValue placeholder="Select number of results" />
            </SelectTrigger>
            <SelectContent className="[&_*[role=option]>span]:start-auto [&_*[role=option]>span]:end-2 [&_*[role=option]]:ps-2 [&_*[role=option]]:pe-8">
              {[10, 25, 50, 100].map((pageSize) => (
                <SelectItem key={pageSize} value={pageSize.toString()}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Page number information */}
        <div className="flex grow justify-end whitespace-nowrap text-muted-foreground text-sm">
          <p
            aria-live="polite"
            className="whitespace-nowrap text-muted-foreground text-sm"
          >
            <span className="text-foreground">
              {table.getRowCount() === 0 ? 0 : table.getState().pagination.pageIndex *
                table.getState().pagination.pageSize +
                1}
              -
              {Math.min(
                Math.max(
                  table.getState().pagination.pageIndex *
                    table.getState().pagination.pageSize +
                    table.getState().pagination.pageSize,
                  0,
                ),
                table.getRowCount(),
              )}
            </span>{" "}
            of{" "}
            <span className="text-foreground">
              {table.getRowCount().toString()}
            </span>
          </p>
        </div>

        {/* Pagination buttons */}
        <div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  aria-label="Go to first page"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.firstPage()}
                  size="icon"
                  variant="outline"
                >
                  <ChevronFirstIcon aria-hidden="true" size={16} />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  aria-label="Go to previous page"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                  size="icon"
                  variant="outline"
                >
                  <ChevronLeftIcon aria-hidden="true" size={16} />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  aria-label="Go to next page"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                  size="icon"
                  variant="outline"
                >
                  <ChevronRightIcon aria-hidden="true" size={16} />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  aria-label="Go to last page"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.lastPage()}
                  size="icon"
                  variant="outline"
                >
                  <ChevronLastIcon aria-hidden="true" size={16} />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  );
}

function RowActions({ row }: { row: Row<ProductWithImages> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex justify-end">
          <Button
            aria-label="Product actions"
            className="shadow-none opacity-0 group-hover:opacity-100 transition-opacity"
            size="icon"
            variant="ghost"
          >
            <EllipsisIcon aria-hidden="true" size={16} />
          </Button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={`/products/${row.original.id}`} className="cursor-pointer">
              <PencilIcon className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer">
          <TrashIcon className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
