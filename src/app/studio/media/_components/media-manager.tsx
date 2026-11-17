"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DemoNotice, EmptyState, FormMessage, Panel } from "@/components/studio/ui";
import { describeDetails, studioFetch } from "@/components/studio/client-api";
import { formatBytes } from "@/lib/utils/format";
import type { AssetType, MediaAsset } from "@/types";

const ACCEPT: Record<Exclude<AssetType, "other">, string[]> = {
  image: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  audio: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/flac"],
  video: ["video/mp4", "video/webm"],
  font: ["font/woff2", "font/woff", "font/ttf", "font/otf"],
  model3d: ["model/gltf-binary", "model/gltf+json"],
};
const EXT_MIME: Record<string, string> = { glb: "model/gltf-binary", gltf: "model/gltf+json", woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf" };
const PREVIEW_MAX_BYTES = 512 * 1024;

function classify(file: File): { type: Exclude<AssetType, "other">; mimeType: string } | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = file.type || EXT_MIME[ext] || "";
  for (const [type, mimes] of Object.entries(ACCEPT)) {
    if (mimes.includes(mimeType)) return { type: type as Exclude<AssetType, "other">, mimeType };
  }
  return null;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function MediaManager({ initialAssets, canDelete }: { initialAssets: MediaAsset[]; canDelete: boolean }) {
  const [assets, setAssets] = useState(initialAssets);
  const [filter, setFilter] = useState<AssetType | "all">("all");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => (filter === "all" ? assets : assets.filter((a) => a.type === filter)), [assets, filter]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setResult(null);
    const added: MediaAsset[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const kind = classify(file);
      if (!kind) {
        errors.push(`${file.name}: unsupported file type`);
        continue;
      }
      const previewDataUrl = kind.type === "image" && file.size <= PREVIEW_MAX_BYTES ? await readAsDataUrl(file) : undefined;
      const res = await studioFetch<{ asset: MediaAsset }>("/api/studio/media", "POST", {
        type: kind.type,
        filename: file.name,
        mimeType: kind.mimeType,
        sizeBytes: file.size,
        ...(previewDataUrl ? { previewDataUrl } : {}),
      });
      if (res.ok) added.push(res.data.asset);
      else errors.push(`${file.name}: ${res.message}${describeDetails(res.details).length ? ` (${describeDetails(res.details).join("; ")})` : ""}`);
    }
    setAssets((a) => [...added, ...a]);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    setResult(
      errors.length
        ? { ok: false, message: `${added.length} added, ${errors.length} failed`, details: errors }
        : { ok: true, message: `${added.length} file${added.length === 1 ? "" : "s"} added` }
    );
  }

  async function remove(asset: MediaAsset) {
    if (!window.confirm(`Delete ${asset.filename}?`)) return;
    const res = await studioFetch(`/api/studio/media/${asset.id}`, "DELETE");
    if (res.ok) setAssets((a) => a.filter((x) => x.id !== asset.id));
    else setResult({ ok: false, message: res.message });
  }

  const filters: (AssetType | "all")[] = ["all", "image", "audio", "video", "font", "model3d"];

  return (
    <div className="flex flex-col gap-6">
      <DemoNotice>DEMO — files never leave your browser. Only file details (and a small preview for images under 512 KB) are kept in server memory until restart.</DemoNotice>
      <Panel
        title="Upload"
        actions={
          <Button type="button" size="sm" onClick={() => inputRef.current?.click()} loading={busy}>
            Choose files
          </Button>
        }
      >
        <label htmlFor="media-upload" className="sr-only">Upload media files</label>
        <input
          ref={inputRef}
          id="media-upload"
          type="file"
          multiple
          accept={[...Object.values(ACCEPT).flat(), ".glb", ".gltf", ".woff2", ".woff", ".ttf", ".otf"].join(",")}
          onChange={(e) => void upload(e.target.files)}
          className="block w-full text-sm text-[var(--color-fg-muted)] file:mr-4 file:border-0 file:bg-[var(--color-bg)] file:px-3 file:py-2 file:text-[var(--color-fg)]"
        />
        <p className="mt-2 text-xs text-[var(--color-fg-muted)]">PNG, JPEG, WebP, GIF, MP3, WAV, OGG, FLAC, MP4, WebM, fonts, GLB/glTF · up to 50 MB each</p>
        <div className="mt-3"><FormMessage result={result} /></div>
      </Panel>

      <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Filter by type">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 text-xs font-mono uppercase border ${filter === f ? "border-[var(--color-fg)] text-[var(--color-fg)]" : "border-[var(--color-border)] text-[var(--color-fg-muted)]"}`}
          >
            {f} {f === "all" ? assets.length : assets.filter((a) => a.type === f).length}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No media here yet" />
      ) : (
        <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visible.map((a) => (
            <li key={a.id} className="border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="aspect-video bg-black/40 flex items-center justify-center overflow-hidden">
                {a.thumbnailUrl?.startsWith("data:image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- in-memory data URL preview
                  <img src={a.thumbnailUrl} alt={a.altText ?? a.filename} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xs font-mono uppercase text-[var(--color-fg-muted)]">{a.type}</span>
                )}
              </div>
              <div className="p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm" title={a.filename}>{a.filename}</p>
                  <p className="text-xs text-[var(--color-fg-muted)] font-mono">{a.mimeType} · {formatBytes(a.sizeBytes)}</p>
                </div>
                {canDelete && (
                  <Button type="button" variant="ghost" size="sm" aria-label={`Delete ${a.filename}`} onClick={() => void remove(a)}>
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
