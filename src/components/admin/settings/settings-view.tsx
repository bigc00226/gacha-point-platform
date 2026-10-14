"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SettingsPageDto } from "@/lib/server/services/admin-settings";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { formatNumber } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { DescriptionList, Notice } from "@/components/ui/misc";
import { Pagination, usePaged } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

export function SettingsView({ data }: { data: SettingsPageDto }) {
  const router = useRouter();
  const toast = useToast();
  const [site, setSite] = useState(data.site);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string | null; message: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { pageItems, page, pageCount, setPage, total } = usePaged(data.audits, 15);

  async function save() {
    setSaving(true);
    setFieldError(null);
    try {
      await api.put("/api/admin/settings", site);
      toast.success("サイト設定を保存しました", "ユーザー画面のヘッダー・お知らせに反映されます");
      router.refresh();
    } catch (err) {
      const field = err instanceof ApiClientError ? ((err.details as { field?: string } | undefined)?.field ?? null) : null;
      setFieldError({ field, message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setResetting(true);
    try {
      await api.post("/api/demo/reset");
      toast.success("デモデータを初期化しました");
      setConfirmReset(false);
      router.refresh();
    } catch (err) {
      toast.error("初期化できませんでした", errorMessage(err));
    } finally {
      setResetting(false);
    }
  }

  const errorFor = (f: string) => (fieldError?.field === f ? fieldError.message : null);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader icon="server" title="サイト設定" description="ユーザー画面のサイト名とお知らせバーを設定します。" />
          <CardBody className="space-y-4">
            {fieldError && !fieldError.field && <Notice tone="danger">{fieldError.message}</Notice>}
            <Field label="サイト名" htmlFor="st-name" required error={errorFor("siteName")}>
              <Input id="st-name" value={site.siteName} onChange={(e) => setSite({ ...site, siteName: e.target.value })} invalid={!!errorFor("siteName")} />
            </Field>
            <Field label="キャッチコピー" htmlFor="st-tag" error={errorFor("tagline")}>
              <Input id="st-tag" value={site.tagline} onChange={(e) => setSite({ ...site, tagline: e.target.value })} />
            </Field>
            <Field label="お知らせバー" htmlFor="st-ann" error={errorFor("announcement")} hint="空欄にするとユーザー画面のお知らせバーを非表示にします">
              <Input id="st-ann" value={site.announcement} onChange={(e) => setSite({ ...site, announcement: e.target.value })} />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted">最終更新: {formatDateTime(data.site.updatedAt)}</p>
              <Button leftIcon="check" onClick={save} loading={saving}>
                保存する
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon="database"
            title="デモ環境"
            description={
              data.env.state.shared
                ? "データベースは使わず、メモリ上のデータを共有キャッシュ経由で全サーバーインスタンスにそろえています。"
                : "このデモはデータベースを使わず、サーバーのメモリ上でデータを管理しています。"
            }
          />
          <CardBody className="space-y-4">
            <DescriptionList
              items={[
                { label: "Next.js", value: data.env.next },
                { label: "Node.js", value: data.env.node },
                { label: "データの保存先", value: data.env.state.label },
                ...(data.env.state.shared
                  ? [
                      {
                        label: "共有データ",
                        value: data.env.state.version
                          ? `v${formatNumber(data.env.state.version)}（${data.env.state.savedAt ? formatDateTime(data.env.state.savedAt) : "—"} 保存）`
                          : "未同期",
                      },
                    ]
                  : []),
                ...(data.env.state.lastError
                  ? [
                      {
                        label: "直近のエラー",
                        value: (
                          <span className="text-xs text-danger">
                            {data.env.state.lastError}
                            {data.env.state.lastErrorAt && `（${formatDateTime(data.env.state.lastErrorAt)}）`}
                          </span>
                        ),
                      },
                    ]
                  : []),
                { label: data.env.state.shared ? "このインスタンスの起動" : "サーバー起動", value: formatDateTime(data.env.serverStartedAt) },
                { label: "データ初期化", value: formatDateTime(data.env.seededAt) },
                { label: "アップロード上限", value: `${data.env.maxUploadMb}MB / ファイル` },
                { label: "デモ用ツール", value: data.env.demoTools ? <Badge tone="success">有効</Badge> : <Badge tone="neutral">無効</Badge> },
              ]}
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {data.counts.map((c) => (
                <div key={c.label} className="rounded-xl bg-surface-2 px-3 py-2">
                  <p className="text-[11px] text-muted">{c.label}</p>
                  <p className="tabular text-sm font-black">{formatNumber(c.value)}</p>
                </div>
              ))}
            </div>
            <Notice tone="warning" title="デモデータの初期化">
              会員・ガチャ・履歴・設定などすべてのデータを初期状態に戻します（デモアカウントのログイン状態は維持されます）。
              <div className="mt-2">
                <Button size="sm" variant="danger" leftIcon="refresh" onClick={() => setConfirmReset(true)} disabled={!data.env.demoTools}>
                  デモデータを初期化
                </Button>
              </div>
            </Notice>
          </CardBody>
        </Card>
      </div>

      <Card id="audit" className="scroll-mt-20 overflow-hidden">
        <CardHeader icon="history" title="操作ログ" description="管理者による設定変更・発行・発送などの操作をすべて記録しています。" />
        <Table>
          <THead>
            <tr>
              <TH>日時</TH>
              <TH>管理者</TH>
              <TH>操作</TH>
              <TH>対象</TH>
              <TH>詳細</TH>
            </tr>
          </THead>
          <TBody>
            {pageItems.map((a) => (
              <TR key={a.id}>
                <TD label="日時" className="whitespace-nowrap text-xs">{formatDateTime(a.createdAt)}</TD>
                <TD label="管理者" className="text-sm">{a.actorName}</TD>
                <TD mobile="title" className="text-sm font-bold">{a.action}</TD>
                <TD label="対象" className="max-w-60 truncate text-sm">{a.target}</TD>
                <TD label="詳細" mobile="stack" className="max-w-96 truncate text-xs text-muted">{a.detail}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <div className="border-t border-line px-4 py-3">
          <Pagination page={page} pageCount={pageCount} onChange={setPage} total={total} />
        </div>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={reset}
        loading={resetting}
        tone="danger"
        title="デモデータを初期化しますか？"
        description="すべてのデータが初期状態に戻ります。この操作は取り消せません。"
        confirmLabel="初期化する"
      />
    </div>
  );
}
