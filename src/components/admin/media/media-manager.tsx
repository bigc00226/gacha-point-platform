"use client";

import { useState } from "react";
import { MEDIA_KIND_LABELS } from "@/lib/constants";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { formatBytes } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { DescriptionList, Notice } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { LottiePreview } from "./lottie-preview";
import { MediaLibrary } from "./media-library";
import { CHECKERBOARD } from "./media-thumb";
import type { MediaAssetDto } from "./types";
import { refreshMediaLibrary } from "./use-media-library";

/** /admin/media — browse, upload, inspect and delete files. */
export function MediaManager() {
  const toast = useToast();
  const [open, setOpen] = useState<MediaAssetDto | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [blocked, setBlocked] = useState<string[] | null>(null);

  async function remove() {
    if (!open) return;
    setDeleting(true);
    try {
      await api.del(`/api/admin/media/${open.id}`);
      toast.success("ファイルを削除しました", open.name);
      setConfirming(false);
      setOpen(null);
      await refreshMediaLibrary();
    } catch (err) {
      setConfirming(false);
      if (err instanceof ApiClientError && err.code === "MEDIA_IN_USE") {
        setBlocked((err.details as { usages?: string[] } | undefined)?.usages ?? []);
      } else {
        toast.error("削除できませんでした", errorMessage(err));
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card>
        <CardBody>
          <MediaLibrary
            mode="manage"
            onOpen={(asset) => {
              setBlocked(null);
              setOpen(asset);
            }}
          />
        </CardBody>
      </Card>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.name} size="lg">
        {open && (
          <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
            <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl border border-line" style={open.kind === "image" ? CHECKERBOARD : { background: "#0b0a1a" }}>
              {open.kind === "image" && <img src={open.url} alt={open.name} className="size-full object-contain" />}
              {open.kind === "video" && <video src={open.url} controls playsInline className="size-full object-contain" />}
              {open.kind === "lottie" && <LottiePreview url={open.url} className="size-full" />}
            </div>
            <div className="space-y-4">
              <DescriptionList
                items={[
                  { label: "種類", value: `${MEDIA_KIND_LABELS[open.kind]}（${open.mime}）` },
                  { label: "サイズ", value: formatBytes(open.size) },
                  { label: "登録日時", value: formatDateTime(open.createdAt) },
                  { label: "登録者", value: open.uploadedBy ?? "—" },
                  { label: "区分", value: open.source === "builtin" ? "サンプル素材" : "アップロード" },
                ]}
              />
              <div>
                <p className="mb-1.5 text-xs font-bold text-muted">URL</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-xs">{open.url}</code>
                  <CopyButton text={open.url} />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-bold text-muted">使用箇所（{open.usages.length}）</p>
                {open.usages.length === 0 ? (
                  <p className="text-sm text-muted">どこにも使用されていません</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {open.usages.map((u) => (
                      <li key={u} className="rounded-lg bg-surface-2 px-2.5 py-1.5">
                        {u}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {blocked && (
                <Notice tone="danger" title="使用中のため削除できません">
                  先に上記の設定から別のファイルに差し替えてください。
                </Notice>
              )}
              {open.source === "builtin" ? (
                <Notice tone="neutral">サンプル素材は削除できません。</Notice>
              ) : (
                <Button variant="danger" leftIcon="trash" onClick={() => setConfirming(true)} disabled={open.usages.length > 0}>
                  削除する
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
        loading={deleting}
        tone="danger"
        title="ファイルを削除しますか？"
        description={open ? `「${open.name}」を削除します。この操作は取り消せません。` : undefined}
        confirmLabel="削除する"
      />
    </>
  );
}
