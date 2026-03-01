"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ImportResult {
  success: boolean;
  created?: number;
  variants_created?: number;
  errors?: string[];
  error?: string;
}

export function ImportExportButtons() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleExport = (format: "csv" | "xlsx") => {
    window.location.href = `/api/products/export?format=${format}`;
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setDialogOpen(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/products/import", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as ImportResult;

      if (!response.ok) {
        setImportResult({
          success: false,
          error: data.error || "Import failed",
          errors: data.errors,
        });
      } else {
        setImportResult(data);
        router.refresh();
      }
    } catch {
      setImportResult({
        success: false,
        error: "Network error during import",
      });
    } finally {
      setImporting(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleFileSelected}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Import / Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Import</DropdownMenuLabel>
          <DropdownMenuItem onClick={handleImportClick}>
            <Upload className="mr-2 h-4 w-4" />
            Upload CSV or Excel
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Export</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleExport("csv")}>
            <Download className="mr-2 h-4 w-4" />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("xlsx")}>
            <Download className="mr-2 h-4 w-4" />
            Export as Excel (.xlsx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Import Progress Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {importing ? "Importing Products..." : "Import Complete"}
            </DialogTitle>
            <DialogDescription>
              {importing
                ? "Processing your file, please wait."
                : importResult?.success
                  ? "Your products have been imported successfully."
                  : "There was an issue with the import."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {importing && (
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Processing file...
                </span>
              </div>
            )}

            {!importing && importResult?.success && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Import successful</span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{importResult.created} product(s) created</p>
                  {importResult.variants_created ? (
                    <p>{importResult.variants_created} variant(s) created</p>
                  ) : null}
                </div>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="mt-2 text-sm text-amber-600">
                    <p className="font-medium">Warnings:</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!importing && importResult && !importResult.success && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Import failed</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {importResult.error}
                </p>
                {importResult.errors && (
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {!importing && (
            <div className="flex justify-end">
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
