"use client";

import { useState } from "react";
import type { PostbackStatus } from "@/lib/types";
import { POSTBACK_PROVIDER_LABELS, POSTBACK_STATUS_LABELS } from "@/lib/constants";
import { api, errorMessage } from "@/lib/client/api";
import { cn, formatNumber } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Notice, StatCard } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { VerificationTimeline } from "@/components/earn/verification-timeline";
import type {
  PostbackFilterDto,
  PostbackListDto,
  PostbackLogDto,
  PostbackTestKind,
  PostbackTestOptionsDto,
  PostbackTestResultDto,
  PostbackTestScenario,
  WebhookEndpointDto,
} from "./types";

const STATUS_TONE: Record<PostbackStatus, BadgeTone> = {
  granted: "success",
  duplicate: "warning",
  invalid_signature: "danger",
  expired: "danger",
  limit_reached: "warning",
  unknown_user: "danger",
  invalid_session: "danger",
  invalid_request: "danger",
};

const SOURCE_LABELS: Record<PostbackLogDto["source"], string> = {
  simulator: "デモ（シミュレーター）",
  external: "外部",
  admin_test: "テスト送信",
};

const SCENARIOS: Array<{ key: PostbackTestScenario; label: string; description: string }> = [
  { key: "valid", label: "正常な通知", description: "正しい署名で送信 → 付与されます" },
  { key: "bad_signature", label: "署名不正（改ざん）", description: "署名後にパラメータを書き換え → 401で拒否" },
  { key: "expired", label: "期限切れ（リプレイ）", description: "10分前のタイムスタンプ → 拒否" },
  { key: "duplicate", label: "重複通知", description: "同じtransaction_idを再送 → 2回目は付与なし" },
  { key: "limit", label: "上限超過", description: "1日の視聴上限を超えて送信 → 付与なし（動画のみ）" },
];

function StatusBadge({ status }: { status: PostbackStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{POSTBACK_STATUS_LABELS[status]}</Badge>;
}

function LogDetail({ log }: { log: PostbackLogDto }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p><span className="text-muted">受信日時:</span> {formatDateTime(log.receivedAt)}</p>
        <p><span className="text-muted">配信元:</span> {POSTBACK_PROVIDER_LABELS[log.provider] ?? log.provider}</p>
        <p><span className="text-muted">会員:</span> {log.userNickname ?? "—"} <span className="text-muted">({log.userId ?? "不明"})</span></p>
        <p className="truncate"><span className="text-muted">transaction_id:</span> <span className="font-mono text-xs">{log.transactionId ?? "—"}</span></p>
        <p><span className="text-muted">結果:</span> <StatusBadge status={log.status} /> <span className="ml-1 text-muted">HTTP {log.httpStatus}</span></p>
        <p><span className="text-muted">付与:</span> <span className="font-bold text-ticket">{formatNumber(log.ticketsGranted)}枚</span></p>
      </div>
      <Notice tone={log.status === "granted" ? "success" : log.status === "duplicate" || log.status === "limit_reached" ? "warning" : "danger"}>{log.message}</Notice>
      <div className="rounded-xl border border-line p-4">
        <p className="mb-3 text-sm font-bold">検証ステップ</p>
        <VerificationTimeline steps={log.steps} dense />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-sm font-bold">受信したパラメータ</p>
          <CopyButton text={JSON.stringify(log.params, null, 2)} label="JSONをコピー" />
        </div>
        <pre className="max-h-64 overflow-auto rounded-xl bg-[#0f1424] p-4 font-mono text-xs leading-relaxed text-[#cfe3ff]">
          {Object.entries(log.params).map(([k, v]) => `${k}=${v}`).join("\n")}
        </pre>
      </div>
    </div>
  );
}

export function PostbacksViewer({
  initial,
  endpoints,
  testOptions,
}: {
  initial: PostbackListDto;
  endpoints: WebhookEndpointDto[];
  testOptions: PostbackTestOptionsDto;
}) {
  const toast = useToast();
  const [list, setList] = useState(initial);
  const [filter, setFilter] = useState<PostbackFilterDto>(initial.filter);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<PostbackLogDto | null>(null);
  const [test, setTest] = useState<{ kind: PostbackTestKind; scenario: PostbackTestScenario; userId: string; offerId: string }>({
    kind: "video",
    scenario: "valid",
    userId: testOptions.users[0]?.id ?? "u_demo",
    offerId: testOptions.offers.find((o) => o.active)?.id ?? "",
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<PostbackTestResultDto | null>(null);

  async function load(next: PostbackFilterDto, page = 1) {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ ...next, page: String(page), pageSize: String(list.pageSize) } as Record<string, string>);
      setList(await api.get<PostbackListDto>(`/api/admin/postbacks?${qs.toString()}`));
    } catch (err) {
      toast.error("ログを取得できませんでした", errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function changeFilter<K extends keyof PostbackFilterDto>(key: K, value: PostbackFilterDto[K]) {
    const next = { ...filter, [key]: value };
    setFilter(next);
    if (key !== "q") void load(next);
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<PostbackTestResultDto>("/api/admin/postbacks/test", {
        kind: test.kind,
        scenario: test.scenario,
        userId: test.userId,
        offerId: test.kind === "offer" ? test.offerId : undefined,
      });
      setTestResult(res);
      await load(filter, 1);
    } catch (err) {
      toast.error("テスト送信に失敗しました", errorMessage(err));
    } finally {
      setTesting(false);
    }
  }

  const k = list.kpis;
  const scenarioOptions = SCENARIOS.filter((s) => test.kind === "video" || s.key !== "limit");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="本日の受信" value={formatNumber(k.todayReceived)} sub={`累計 ${formatNumber(k.total)}件`} icon="signal" tone="info" />
        <StatCard label="本日の付与" value={`${formatNumber(k.todayGranted)}件`} sub={`${formatNumber(k.todayTickets)}枚を付与`} icon="checkCircle" tone="success" />
        <StatCard label="本日の拒否" value={`${formatNumber(k.todayRejected)}件`} sub="署名不正・期限切れなど" icon="shield" tone="danger" />
        <StatCard label="本日の重複・上限" value={`${formatNumber(k.todayDuplicates)}件`} sub="二重付与を防止" icon="ban" tone="warning" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader icon="link" title="成果通知（Webhook）の受信URL" description="各配信会社の管理画面に登録するURLです。" />
          <CardBody className="space-y-3">
            {endpoints.map((ep) => (
              <div key={ep.key} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{ep.label}</p>
                  <Badge tone="neutral">{ep.method}</Badge>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-xs">{ep.url}</code>
                  <CopyButton text={ep.url} />
                </div>
                <p className="mt-1.5 text-xs text-muted">{ep.note}</p>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon="send" title="テスト送信" description="サーバーから実際のWebhook URLへ通知を送り、検証の結果を確認できます。" />
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="通知の種類" htmlFor="t-kind">
                <Select
                  id="t-kind"
                  value={test.kind}
                  onChange={(e) => {
                    const kind = e.target.value as PostbackTestKind;
                    setTest((t) => ({ ...t, kind, scenario: kind === "offer" && t.scenario === "limit" ? "valid" : t.scenario }));
                  }}
                >
                  <option value="video">リワード動画（AdMob SSV）</option>
                  <option value="offer">案件達成（オファーウォール）</option>
                </Select>
              </Field>
              <Field label="シナリオ" htmlFor="t-scenario" hint={SCENARIOS.find((s) => s.key === test.scenario)?.description}>
                <Select id="t-scenario" value={test.scenario} onChange={(e) => setTest((t) => ({ ...t, scenario: e.target.value as PostbackTestScenario }))}>
                  {scenarioOptions.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="対象の会員" htmlFor="t-user">
                <Select id="t-user" value={test.userId} onChange={(e) => setTest((t) => ({ ...t, userId: e.target.value }))}>
                  {testOptions.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}（本日動画 {u.videoToday}/{testOptions.videoDailyLimit}）
                    </option>
                  ))}
                </Select>
              </Field>
              {test.kind === "offer" && (
                <Field label="案件" htmlFor="t-offer">
                  <Select id="t-offer" value={test.offerId} onChange={(e) => setTest((t) => ({ ...t, offerId: e.target.value }))}>
                    {testOptions.offers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title}
                        {o.repeatable ? "（毎日）" : ""}
                        {o.active ? "" : "（停止中）"}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
            <Button leftIcon="send" onClick={runTest} loading={testing}>
              テスト送信する
            </Button>
            {testResult && (
              <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">結果:</span>
                  {testResult.log ? <StatusBadge status={testResult.log.status} /> : <Badge>ログなし</Badge>}
                  <span className="text-muted">HTTP {testResult.response.httpStatus}</span>
                  <Badge tone="neutral">{testResult.transport === "http" ? "実際のHTTPリクエスト" : "サーバー内で実行"}</Badge>
                </div>
                {testResult.notes.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">
                    {testResult.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
                <code className="block break-all rounded-lg bg-[#0f1424] p-3 font-mono text-[11px] leading-relaxed text-[#cfe3ff]">
                  {testResult.request.method} {testResult.request.url}
                </code>
                {testResult.log && (
                  <Button size="sm" variant="secondary" leftIcon="eye" onClick={() => setDetail(testResult.log)}>
                    検証ステップを見る
                  </Button>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-end">
          <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="種類" htmlFor="f-kind">
              <Select id="f-kind" value={filter.kind} onChange={(e) => changeFilter("kind", e.target.value as PostbackFilterDto["kind"])}>
                <option value="">すべて</option>
                <option value="video">リワード動画</option>
                <option value="offer">案件達成</option>
              </Select>
            </Field>
            <Field label="結果" htmlFor="f-status">
              <Select id="f-status" value={filter.status} onChange={(e) => changeFilter("status", e.target.value as PostbackFilterDto["status"])}>
                <option value="">すべて</option>
                {(Object.keys(POSTBACK_STATUS_LABELS) as PostbackStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {POSTBACK_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="配信元" htmlFor="f-provider">
              <Select id="f-provider" value={filter.provider} onChange={(e) => changeFilter("provider", e.target.value)}>
                <option value="">すべて</option>
                <option value="admob">AdMob</option>
                <option value="skyflag">skyflag</option>
                <option value="tapjoy">Tapjoy</option>
              </Select>
            </Field>
            <Field label="送信元" htmlFor="f-source">
              <Select id="f-source" value={filter.source} onChange={(e) => changeFilter("source", e.target.value as PostbackFilterDto["source"])}>
                <option value="">すべて</option>
                {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void load(filter);
            }}
          >
            <Input
              placeholder="会員ID・ニックネーム・transaction_id"
              value={filter.q}
              onChange={(e) => changeFilter("q", e.target.value)}
              className="lg:w-72"
              aria-label="検索"
            />
            <Button type="submit" variant="secondary" leftIcon="search" loading={loading}>
              検索
            </Button>
          </form>
        </div>
        {list.rows.length === 0 ? (
          <EmptyState icon="signal" title="該当する通知はありません" className="py-12" />
        ) : (
          <div className={cn(loading && "opacity-60")}>
            <Table>
              <THead>
                <tr>
                  <TH>受信日時</TH>
                  <TH>種類 / 配信元</TH>
                  <TH>会員</TH>
                  <TH>transaction_id</TH>
                  <TH>結果</TH>
                  <TH className="text-right">付与</TH>
                  <TH>送信元</TH>
                  <TH />
                </tr>
              </THead>
              <TBody>
                {list.rows.map((log) => (
                  <TR key={log.id} className="cursor-pointer @max-4xl:relative" onClick={() => setDetail(log)}>
                    <TD label="受信日時" className="tabular whitespace-nowrap text-xs">{formatDateTime(log.receivedAt)}</TD>
                    <TD mobile="title" className="@max-4xl:pr-8 @max-4xl:font-bold">
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <Icon name={log.kind === "video" ? "tv" : "smartphone"} size={14} className="text-muted" />
                        {log.kind === "video" ? "動画" : "案件"}
                        <span className="text-xs text-muted">/ {log.provider}</span>
                      </span>
                    </TD>
                    <TD label="会員" className="text-sm">{log.userNickname ?? <span className="text-muted">{log.userId ?? "—"}</span>}</TD>
                    <TD label="transaction_id" mobile="hide" className="max-w-[180px] truncate font-mono text-xs text-muted">{log.transactionId ?? "—"}</TD>
                    <TD label="結果">
                      <StatusBadge status={log.status} />
                    </TD>
                    <TD label="付与" className="tabular text-right font-bold text-ticket">{log.ticketsGranted > 0 ? `+${formatNumber(log.ticketsGranted)}` : "—"}</TD>
                    <TD label="送信元" className="text-xs text-muted">{SOURCE_LABELS[log.source]}</TD>
                    <TD className="@max-4xl:absolute @max-4xl:right-3 @max-4xl:top-3 @max-4xl:w-auto @max-4xl:p-0">
                      <Icon name="chevronRight" size={16} className="text-subtle" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
        <div className="border-t border-line px-4 py-3">
          <Pagination page={list.page} pageCount={list.pageCount} total={list.total} onChange={(p) => load(filter, p)} />
        </div>
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="成果通知の詳細" size="lg">
        {detail && <LogDetail log={detail} />}
      </Modal>
    </div>
  );
}
