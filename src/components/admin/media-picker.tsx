"use client";

import { useState } from "react";
import type { MediaKind } from "@/lib/types";
import { MEDIA_KIND_LABELS } from "@/lib/constants";
import { cn } from "@/lib/format";
import { Button, IconButton } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { MediaLibrary } from "./media/media-library";
import { MediaThumb } from "./media/media-thumb";
import { useMediaLibrary } from "./media/use-media-library";

/**
 * Form control for choosing a file from the media library (with inline upload).
 * Value is the media URL ("/demo/..." or "/api/media/<id>") or null.
 */
export interface MediaPickerProps {
  value: string | null;
  onChange: (url: string | null) => void;
  kinds: MediaKind[];
  label?: string;
  /** Preview box aspect, e.g. "16/9" for thumbnails, "1/1" for prizes. */
  aspect?: string;
  disabled?: boolean;
  /** Small square button (for dense rows such as prize lists). */
  compact?: boolean;
}

function kindOfUrl(url: string, fallback: MediaKind): MediaKind {
  const lower = url.toLowerCase();
  if (/\.(mp4|webm)(\?|#|$)/.test(lower)) return "video";
  if (/\.json(\?|#|$)/.test(lower)) return "lottie";
  if (/\.(png|jpe?g|webp|gif|svg)(\?|#|$)/.test(lower)) return "image";
  return fallback;
}

export function MediaPicker({ value, onChange, kinds, label, aspect = "16/9", disabled = false, compact = false }: MediaPickerProps) {
  const library = useMediaLibrary();
  const [open, setOpen] = useState(false);
  const asset = value ? library?.assets.find((a) => a.url === value) : undefined;
  const kind = asset?.kind ?? (value ? kindOfUrl(value, kinds[0]) : kinds[0]);
  const name = asset?.name ?? (value ? decodeURIComponent(value.split("/").pop() ?? value) : null);

  const modal = (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={label ? `${label}を選択` : "ファイルを選択"}
      description={`${kinds.map((k) => MEDIA_KIND_LABELS[k]).join("・")}から選択、または新しくアップロードできます。`}
      size="xl"
    >
      <MediaLibrary
        mode="pick"
        kinds={kinds}
        selectedUrl={value}
        onSelect={(a) => {
          onChange(a.url);
          setOpen(false);
        }}
      />
    </Modal>
  );

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className={cn(
            "group relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border transition-colors",
            value ? "border-line" : "border-dashed border-line-strong text-subtle hover:border-primary hover:text-primary",
          )}
          aria-label={label ? `${label}を選択` : "画像を選択"}
          title={name ?? "画像を選択"}
        >
          {value ? (
            <MediaThumb kind={kind} url={value} name={name ?? ""} className="size-full" />
          ) : (
            <Icon name="image" size={20} />
          )}
          <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
            変更
          </span>
        </button>
        {modal}
      </>
    );
  }

  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2">
        <div className="w-28 shrink-0 overflow-hidden rounded-lg border border-line bg-surface" style={{ aspectRatio: aspect }}>
          {value ? (
            <MediaThumb kind={kind} url={value} name={name ?? ""} className="size-full" />
          ) : (
            <div className="grid size-full place-items-center text-subtle">
              <Icon name={kinds[0] === "image" ? "image" : kinds[0] === "video" ? "video" : "sparkles"} size={20} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm", value ? "font-bold text-fg" : "text-muted")}>{value ? name : "未設定"}</p>
          <p className="truncate text-xs text-subtle">{value ? MEDIA_KIND_LABELS[kind] : kinds.map((k) => MEDIA_KIND_LABELS[k]).join("・")}</p>
        </div>
        <Button size="sm" variant="secondary" leftIcon="image" onClick={() => setOpen(true)} disabled={disabled}>
          ライブラリから選択
        </Button>
        {value && <IconButton icon="x" label="解除" size="sm" onClick={() => onChange(null)} disabled={disabled} />}
      </div>
      {modal}
    </div>
  );
}
