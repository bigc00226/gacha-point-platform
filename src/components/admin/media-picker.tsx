"use client";

import type { MediaKind } from "@/lib/types";

/**
 * STUB — implemented by the media module.
 *
 * Form control for choosing a file from the media library (with inline upload):
 * shows the current selection (image thumbnail / video / Lottie badge), a
 * "選択" button that opens a library modal filtered by `kinds`, and "解除".
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
}

export function MediaPicker(props: MediaPickerProps) {
  void props;
  return null;
}
