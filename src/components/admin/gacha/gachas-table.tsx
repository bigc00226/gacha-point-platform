"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminGachaRowDto } from "@/lib/server/services/admin-gacha";
import { GACHA_STATUS_LABELS } from "@/lib/constants";
import { api, errorMessage } from "@/lib/client/api";
import { formatNumber } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState, ProgressBar } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

const STATUS_TONE: Record<AdminGachaRowDto["status"], BadgeTone> = {
  draft: "neutral",
  active: "success",
  paused: "warning",
  soldout: "danger",
};

export function GachasTable({ rows }: { rows: AdminGachaRowDto[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminGachaRowDto | null>(null);

  async function toggle(row: AdminGachaRowDto) {
    setBusy(row.id);
    try {
      const next = row.status === "active" ? "paused" : "active";
      await api.patch(`/api/admin/gachas/${row.id}/status`, { status: next });
      toast.success(next === "active" ? "公開しました" : "一時停止しました", row.title);
      router.refresh();
    } catch (err) {
      toast.error("変更できませんでした", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function duplicate(row: AdminGachaRowDto) {
    setBusy(row.id);
    try {
      const res = await api.post<{ id: string }>(`/api/admin/gachas/${row.id}/duplicate`);
      toast.success("ガチャを複製しました", "下書きとして作成されました");
      router.push(`/admin/gachas/${res.id}`);
    } catch (err) {
      toast.error("複製できませんでした", errorMessage(err));
      setBusy(null);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(deleting.id);
    try {
      await api.del(`/api/admin/gachas/${deleting.id}`);
      toast.success("ガチャを削除しました", deleting.title);
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error("削除できませんでした", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      {rows.length === 0 ? (
        <EmptyState icon="capsule" title="ガチャがありません" action={<ButtonLink href="/admin/gachas/new">新規作成</ButtonLink>} />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>ガチャ</TH>
              <TH>状態</TH>
              <TH className="text-right">1回</TH>
              <TH className="w-56">残り口数</TH>
              <TH>ラストワン賞</TH>
              <TH className="text-right">本日</TH>
              <TH>更新</TH>
              <TH className="text-right">操作</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((g) => (
              <TR key={g.id}>
                <TD>
                  <Link href={`/admin/gachas/${g.id}`} className="flex items-center gap-3 hover:underline">
                    <span className="block aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-surface-3">
                      {g.thumbnailUrl && <img src={g.thumbnailUrl} alt="" className="size-full object-cover" />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="max-w-56 truncate font-bold">{g.title}</span>
                        {g.featured && <Icon name="star" size={13} filled className="text-accent" />}
                      </span>
                      <span className="block max-w-64 truncate text-xs text-muted">{g.subtitle || g.id}</span>
                      {g.badge && (
                        <Badge size="xs" tone="primary" className="mt-1">
                          {g.badge}
                        </Badge>
                      )}
                    </span>
                  </Link>
                </TD>
                <TD>
                  <div className="flex flex-col items-start gap-1.5">
                    <Badge tone={STATUS_TONE[g.status]}>{GACHA_STATUS_LABELS[g.status]}</Badge>
                    {g.status !== "soldout" && g.status !== "draft" && (
                      <Switch checked={g.status === "active"} onChange={() => toggle(g)} disabled={busy === g.id} />
                    )}
                  </div>
                </TD>
                <TD className="tabular text-right">{g.ticketCost}枚</TD>
                <TD>
                  <p className="tabular text-xs">
                    <span className="font-bold">{formatNumber(g.remainingSlots)}</span>
                    <span className="text-muted"> / {formatNumber(g.totalSlots)}口</span>
                  </p>
                  <ProgressBar value={g.remainingSlots} max={g.totalSlots} size="sm" tone={g.remainingSlots / g.totalSlots < 0.01 ? "gold" : "primary"} className="mt-1.5" />
                </TD>
                <TD className="max-w-48">
                  {g.lastOneWinner ? (
                    <span className="text-xs">
                      <Icon name="crown" size={12} filled className="mr-1 inline text-accent" />
                      {g.lastOneWinner.nickname}さんが獲得
                    </span>
                  ) : (
                    <span className="block truncate text-xs text-muted">{g.lastOnePrizeName ?? "なし"}</span>
                  )}
                </TD>
                <TD className="tabular text-right text-xs">{formatNumber(g.slotsToday)}口</TD>
                <TD className="whitespace-nowrap text-xs text-muted">{formatDateTime(g.updatedAt)}</TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <ButtonLink href={`/admin/gachas/${g.id}`} size="xs" variant="secondary" leftIcon="edit">
                      編集
                    </ButtonLink>
                    <ButtonLink href={`/gacha/${g.id}`} target="_blank" size="xs" variant="ghost" leftIcon="external" aria-label="ユーザー画面で見る">
                      表示
                    </ButtonLink>
                    <IconButton icon="copy" label="複製" size="xs" onClick={() => duplicate(g)} disabled={busy === g.id} />
                    <IconButton icon="trash" label="削除" size="xs" onClick={() => setDeleting(g)} className="hover:text-danger" />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={!!deleting && busy === deleting.id}
        tone="danger"
        title="ガチャを削除しますか？"
        description={deleting ? `「${deleting.title}」と景品設定を削除します。会員の抽選履歴・獲得景品・ポイント履歴は保持されます。一時的に止めたい場合は「一時停止」をご利用ください。` : undefined}
        confirmLabel="削除する"
      />
    </Card>
  );
}
