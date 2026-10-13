"use client";

import { useRef, useState, type DragEvent } from "react";
import type { MediaKind } from "@/lib/types";
import { MEDIA_KIND_LABELS } from "@/lib/constants";
import { errorMessage } from "@/lib/client/api";
import { cn, formatBytes } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Notice } from "@/components/ui/misc";
import { LoadingBlock } from "@/components/ui/spinner";
import { MediaThumb } from "./media-thumb";
import type { MediaAssetDto } from "./types";
import { uploadMediaFiles, useMediaLibrary } from "./use-media-library";

const ACCEPT: Record<MediaKind, string> = {
  image: ".png,.jpg,.jpeg,.webp,.gif,.svg,image/png,image/jpeg,image/webp,image/gif,image/svg+xml",
  video: ".mp4,.webm,video/mp4,video/webm",
  lottie: ".json,application/json",
};

/**
 * Media grid with kind filter, search and drag & drop upload.
 * mode "pick": click selects (MediaPicker). mode "manage": click opens details.
 */
export function MediaLibrary({
  mode,
  kinds = ["image", "video", "lottie"],
  selectedUrl,
  onSelect,
  onOpen,
}: {
  mode: "pick" | "manage";
  kinds?: MediaKind[];
  selectedUrl?: string | null;
  onSelect?: (asset: MediaAssetDto) => void;
  onOpen?: (asset: MediaAssetDto) => void;
}) {
  const library = useMediaLibrary();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<MediaKind | "all">(kinds.length === 1 ? kinds[0] : "all");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [messages, setMessages] = useState<Array<{ tone: "success" | "danger"; text: string }>>([]);

  const assets = (library?.assets ?? [])
    .filter((a) => kinds.includes(a.kind))
    .filter((a) => filter === "all" || a.kind === filter)
    .filter((a) => !query.trim() || a.name.toLowerCase().includes(query.trim().toLowerCase()));

  async function upload(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setMessages([]);
    try {
      const result = await uploadMediaFiles(files);
      const next: Array<{ tone: "success" | "danger"; text: string }> = [];
      if (result.assets.length > 0) next.push({ tone: "success", text: `${result.assets.length}件のファイルをアップロードしました` });
      for (const e of result.errors) next.push({ tone: "danger", text: e.message });
      setMessages(next);
      if (mode === "pick" && result.assets.length === 1 && onSelect) {
        const asset = result.assets[0];
        if (kinds.includes(asset.kind)) onSelect({ ...asset, usages: [] });
      }
    } catch (err) {
      setMessages([{ tone: "danger", text: errorMessage(err) }]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void upload([...e.dataTransfer.files]);
  }

  const accept = kinds.map((k) => ACCEPT[k]).join(",");

  return (
    <div
      className="space-y-4"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {kinds.length > 1 &&
            (["all", ...kinds] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={cn(
                  "h-8 rounded-lg px-3 text-sm font-bold transition-colors",
                  filter === k ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted hover:text-fg",
                )}
              >
                {k === "all" ? "すべて" : MEDIA_KIND_LABELS[k]}
              </button>
            ))}
        </div>
        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ファイル名で検索" className="h-9 sm:w-56" aria-label="ファイル名で検索" />
          <Button size="sm" leftIcon="upload" onClick={() => inputRef.current?.click()} loading={uploading}>
            アップロード
          </Button>
          <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={(e) => upload([...(e.target.files ?? [])])} />
        </div>
      </div>

      <div
        className={cn(
          "rounded-2xl border-2 border-dashed px-4 py-3 text-center text-xs transition-colors",
          dragOver ? "border-primary bg-primary/5 text-primary" : "border-line text-muted",
        )}
      >
        <Icon name="upload" size={14} className="mr-1 inline" />
        ここにファイルをドラッグ＆ドロップでもアップロードできます（{kinds.map((k) => MEDIA_KIND_LABELS[k]).join("・")}／1ファイル最大
        {library?.maxUploadMb ?? 4}MB）。本番環境ではS3等へ直接アップロードし、大容量の動画にも対応します。
      </div>

      {messages.map((m) => (
        <Notice key={m.text} tone={m.tone}>
          {m.text}
        </Notice>
      ))}

      {!library ? (
        <LoadingBlock />
      ) : assets.length === 0 ? (
        <EmptyState icon="image" title="ファイルがありません" description="右上の「アップロード」から追加できます。" />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {assets.map((asset) => {
            const selected = selectedUrl === asset.url;
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => (mode === "pick" ? onSelect?.(asset) : onOpen?.(asset))}
                  className={cn(
                    "group w-full overflow-hidden rounded-xl border bg-surface text-left transition hover:shadow-md",
                    selected ? "border-primary ring-2 ring-primary/40" : "border-line hover:border-line-strong",
                  )}
                  aria-pressed={mode === "pick" ? selected : undefined}
                >
                  <div className="relative">
                    <MediaThumb kind={asset.kind} url={asset.url} name={asset.name} className="aspect-square w-full" />
                    {selected && (
                      <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-white shadow">
                        <Icon name="check" size={14} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 p-2.5">
                    <p className="truncate text-xs font-bold text-fg" title={asset.name}>
                      {asset.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge size="xs" tone={asset.kind === "image" ? "info" : asset.kind === "video" ? "primary" : "gold"}>
                        {MEDIA_KIND_LABELS[asset.kind]}
                      </Badge>
                      {asset.source === "builtin" && (
                        <Badge size="xs" tone="neutral">
                          サンプル
                        </Badge>
                      )}
                      {asset.usages.length > 0 && (
                        <Badge size="xs" tone="success">
                          使用中 {asset.usages.length}
                        </Badge>
                      )}
                      <span className="ml-auto text-[10px] text-subtle">{formatBytes(asset.size)}</span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
