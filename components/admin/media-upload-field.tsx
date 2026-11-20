"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/format";

export function MediaUploadField({
  name,
  kind,
  defaultValue = "",
  placeholder,
  hint,
}: {
  name: string;
  kind: "VIDEO" | "IMAGE";
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const accept = kind === "VIDEO" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp";

  async function upload(file: File) {
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("kind", kind);
      const res = await fetch("/api/admin/media", { method: "POST", body });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        toast(json.error ?? "Upload failed.", "error");
        return;
      }
      setUrl(json.url);
      toast(`${kind === "VIDEO" ? "Video" : "Image"} uploaded.`);
    } catch {
      toast("Upload failed. Check your connection and try again.", "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name={name}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={placeholder ?? (kind === "VIDEO" ? "https://… .mp4 or upload" : "https://… image or upload")}
          className="flex-1"
        />
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-[12.5px] font-semibold text-ink transition hover:bg-surface disabled:opacity-60",
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? "Uploading…" : `Upload ${kind === "VIDEO" ? "video" : "image"}`}
        </button>
      </div>
      {hint ? <p className="text-[11.5px] text-muted">{hint}</p> : null}
      {url ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface p-2.5">
          {kind === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-16 w-24 rounded-lg object-cover" />
          ) : (
            <video src={url} className="h-16 w-24 rounded-lg bg-navy object-cover" muted preload="metadata" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[10.5px] text-muted">{url}</p>
            <button
              type="button"
              onClick={() => setUrl("")}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-danger hover:underline"
            >
              <X className="h-3 w-3" /> Remove reference
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-[11.5px] text-muted">
          <ImageIcon className="h-4 w-4" /> No {kind === "VIDEO" ? "video" : "image"} selected yet.
        </div>
      )}
    </div>
  );
}
