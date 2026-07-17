"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { api, ApiError, getApiUrl } from "@/lib/api";

function resolvePreview(url: string) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${getApiUrl()}${url}`;
  return url;
}

type Props = {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
  hint?: string;
};

export function CoverImageField({
  label = "Cover image",
  value,
  onChange,
  required = false,
  hint,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function onFile(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("cover", files[0]);
      const res = await api<{ url?: string; cover?: string }>(
        "/api/uploads/cover",
        { method: "POST", body: form }
      );
      const url = res.url || res.cover || "";
      if (!url) throw new Error("Upload returned no URL");
      onChange(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const preview = resolvePreview(value);

  return (
    <div className="space-y-md">
      <Input
        label={`${label}${required ? "" : " (optional)"}`}
        type="text"
        placeholder="https://… or /uploads/covers/…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        hint={
          hint ||
          "Paste an image URL, or upload a PNG/JPG/WEBP (max 5 MB). Uploaded files use a /uploads/… path."
        }
      />
      <div className="flex flex-wrap items-center gap-sm">
        <label className="inline-flex">
          <span className="sr-only">Upload cover file</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            className="block w-full max-w-xs text-sm text-on-surface-variant file:mr-md file:py-sm file:px-md file:rounded-md file:border-0 file:bg-primary-container file:text-on-primary file:font-semibold"
            disabled={uploading}
            onChange={(e) => {
              onFile(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {uploading ? (
          <span className="font-body-dense text-on-surface-variant">
            Uploading…
          </span>
        ) : null}
        {value && !required ? (
          <Button
            type="button"
            variant="ghost"
            className="!py-sm !px-md text-sm"
            onClick={() => onChange("")}
          >
            Clear
          </Button>
        ) : null}
      </div>
      {error ? <p className="font-body-dense text-error">{error}</p> : null}
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Cover preview"
          className="w-full max-w-sm h-40 object-cover rounded-md border border-outline-variant bg-surface-container"
        />
      ) : null}
    </div>
  );
}
