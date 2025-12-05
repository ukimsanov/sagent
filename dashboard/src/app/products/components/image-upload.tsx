"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { AlertCircleIcon, ImageIcon, UploadIcon, XIcon, Loader2 } from "lucide-react";
import { useFileUpload, type FileMetadata, type FileWithPreview } from "@/hooks/use-file-upload";
import { Button } from "@/components/ui/button";

interface ImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  disabled?: boolean;
}

export function ImageUpload({
  value = [],
  onChange,
  maxFiles = 6,
  maxSizeMB = 5,
  disabled = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Convert existing URLs to FileMetadata format
  const initialFiles: FileMetadata[] = value.map((url, index) => ({
    id: `existing-${index}-${Date.now()}`,
    name: `image-${index + 1}.jpg`,
    size: 0,
    type: "image/jpeg",
    url,
  }));

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/products/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = (await response.json()) as { error?: string };
      throw new Error(error.error || "Upload failed");
    }

    const data = (await response.json()) as { url: string };
    return data.url;
  }, []);

  const handleFilesAdded = useCallback(
    async (addedFiles: FileWithPreview[]) => {
      setUploading(true);
      setUploadError(null);

      try {
        const uploadPromises = addedFiles
          .filter((f) => f.file instanceof File)
          .map((f) => uploadFile(f.file as File));

        const uploadedUrls = await Promise.all(uploadPromises);

        // Combine existing URLs with new uploads
        const newUrls = [...value, ...uploadedUrls];
        onChange(newUrls);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [value, onChange, uploadFile]
  );

  const handleFilesChange = useCallback(
    (files: FileWithPreview[]) => {
      // Extract URLs from files (only those that have already been uploaded)
      const urls = files
        .filter((f) => !(f.file instanceof File))
        .map((f) => (f.file as FileMetadata).url);

      // Only update if the count has decreased (file was removed)
      if (urls.length < value.length) {
        onChange(urls);
      }
    },
    [value, onChange]
  );

  const maxSize = maxSizeMB * 1024 * 1024;

  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      getInputProps,
    },
  ] = useFileUpload({
    accept: "image/png,image/jpeg,image/jpg,image/gif,image/webp",
    initialFiles,
    maxFiles,
    maxSize,
    multiple: true,
    onFilesAdded: handleFilesAdded,
    onFilesChange: handleFilesChange,
  });

  const handleRemove = (id: string) => {
    const fileToRemove = files.find((f) => f.id === id);
    if (fileToRemove && !(fileToRemove.file instanceof File)) {
      // Remove from value array
      const urlToRemove = (fileToRemove.file as FileMetadata).url;
      onChange(value.filter((url) => url !== urlToRemove));
    }
    removeFile(id);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Drop area */}
      <div
        className={`relative flex min-h-52 flex-col items-center overflow-hidden rounded-xl border border-dashed p-4 transition-colors
          ${isDragging ? "border-primary bg-accent/50" : "border-input"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${files.length === 0 ? "justify-center" : ""}
          focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50`}
        data-dragging={isDragging || undefined}
        data-files={files.length > 0 || undefined}
        onDragEnter={disabled ? undefined : handleDragEnter}
        onDragLeave={disabled ? undefined : handleDragLeave}
        onDragOver={disabled ? undefined : handleDragOver}
        onDrop={disabled ? undefined : handleDrop}
      >
        <input
          {...getInputProps({ disabled })}
          aria-label="Upload product images"
          className="sr-only"
        />

        {files.length > 0 ? (
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate font-medium text-sm">
                Product Images ({files.length})
              </h3>
              <Button
                type="button"
                disabled={files.length >= maxFiles || uploading || disabled}
                onClick={openFileDialog}
                size="sm"
                variant="outline"
              >
                {uploading ? (
                  <Loader2 className="-ms-0.5 size-3.5 animate-spin" />
                ) : (
                  <UploadIcon
                    aria-hidden="true"
                    className="-ms-0.5 size-3.5 opacity-60"
                  />
                )}
                Add more
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {files.map((file) => (
                <div
                  className="relative aspect-square rounded-lg bg-muted overflow-hidden"
                  key={file.id}
                >
                  {file.preview ? (
                    <Image
                      alt={file.file instanceof File ? file.file.name : file.file.name}
                      src={file.preview}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <Button
                    type="button"
                    aria-label="Remove image"
                    className="-top-1 -right-1 absolute size-6 rounded-full border-2 border-background shadow-sm"
                    onClick={() => handleRemove(file.id)}
                    size="icon"
                    variant="destructive"
                    disabled={uploading || disabled}
                  >
                    <XIcon className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-3 text-center">
            <div
              aria-hidden="true"
              className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border bg-background"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImageIcon className="size-4 opacity-60" />
              )}
            </div>
            <p className="mb-1.5 font-medium text-sm">
              {uploading ? "Uploading..." : "Drop your images here"}
            </p>
            <p className="text-muted-foreground text-xs">
              PNG, JPG, GIF or WebP (max. {maxSizeMB}MB)
            </p>
            <Button
              type="button"
              className="mt-4"
              onClick={openFileDialog}
              variant="outline"
              disabled={uploading || disabled}
            >
              <UploadIcon aria-hidden="true" className="-ms-1 opacity-60" />
              Select images
            </Button>
          </div>
        )}
      </div>

      {/* Errors */}
      {(errors.length > 0 || uploadError) && (
        <div
          className="flex items-center gap-1 text-destructive text-xs"
          role="alert"
        >
          <AlertCircleIcon className="size-3 shrink-0" />
          <span>{uploadError || errors[0]}</span>
        </div>
      )}
    </div>
  );
}
