import type { MediaAsset } from "@/lib/types";

/** A media library entry with the places it is used (client-safe). */
export interface MediaAssetDto extends MediaAsset {
  usages: string[];
}

export interface MediaLibraryDto {
  assets: MediaAssetDto[];
  maxUploadMb: number;
}

export interface MediaUploadResultDto {
  assets: MediaAsset[];
  errors: Array<{ name: string; message: string }>;
}
