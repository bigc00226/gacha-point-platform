"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/client/api";
import type { MediaLibraryDto, MediaUploadResultDto } from "./types";

// One shared copy of the library per page, so every MediaPicker shows names without refetching.
let cache: MediaLibraryDto | null = null;
let inflight: Promise<MediaLibraryDto> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function refreshMediaLibrary(): Promise<MediaLibraryDto> {
  inflight ??= api
    .get<MediaLibraryDto>("/api/admin/media")
    .then((data) => {
      cache = data;
      listeners.forEach((l) => l());
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useMediaLibrary(): MediaLibraryDto | null {
  const data = useSyncExternalStore(subscribe, () => cache, () => null);
  useEffect(() => {
    if (!cache) void refreshMediaLibrary().catch(() => {});
  }, []);
  return data;
}

export async function uploadMediaFiles(files: File[]): Promise<MediaUploadResultDto> {
  const form = new FormData();
  for (const file of files) form.append("file", file);
  const result = await api.upload<MediaUploadResultDto>("/api/admin/media", form);
  await refreshMediaLibrary();
  return result;
}
