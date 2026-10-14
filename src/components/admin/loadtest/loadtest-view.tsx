"use client";

import { useState } from "react";
import type { IdempotencyReportDto, InvariantDto, RaceReportDto } from "@/lib/server/services/loadtest";
import { api, errorMessage } from "@/lib/client/api";
import { cn, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Notice, StatCard } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";

function ModeSwitch({ value, onChange }: { value: "lock" | "nolock"; onChange: (v: "lock" | "nolock") => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {(
        [
          ["lock", "排他制御あり（本番の設計）", "shieldCheck", "ロック＋トランザクションで直列化"],
          ["nolock", "排他制御なし（比較用）", "alert", "同時更新の不整合を再現"],
        ] as const
      ).map(([key, label, icon, note]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
            value === key ? (key === "lock" ? "border-success bg-success/5 ring-1 ring-success/40" : "border-danger bg-danger/5 ring-1 ring-danger/40") : "border-line hover:bg-surface-2",
          )}
        >
          <Icon name={icon} size={18} className={key === "lock" ? "text-success" : "text-danger"} />
          <span>
            <span className="block text-sm font-bold">{label}</span>
            <span className="block text-xs text-muted">{note}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function ResultBanner({ ok, title, sub }: { ok: boolean; title: string; sub: string }) {
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border p-5", ok ? "border-success/40 bg-success/8" : "border-danger/40 bg-danger/8")}>
      <span className={cn("grid size-14 shrink-0 place-items-center rounded-2xl text-white", ok ? "bg-success" : "bg-danger")}>
        <Icon name={ok ? "checkCircle" : "xCircle"} size={30} />
      </span>
      <div>
        <p className={cn("text-xl font-black", ok ? "text-success" : "text-danger")}>{title}</p>
        <p className="mt-0.5 text-sm text-muted">{sub}</p>
      </div>
    </div>
  );
}

function InvariantList({ items }: { items: InvariantDto[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
      {items.map((v) => (
        <li key={v.key} className="flex items-start gap-3 px-4 py-3">
          <Icon name={v.ok ? "checkCircle" : "xCircle"} size={20} className={cn("mt-0.5 shrink-0", v.ok ? "text-success" : "text-danger")} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{v.label}</p>
            <p className="text-xs text-muted">{v.note}</p>
          </div>
          <div className="shrink-0 text-right text-xs">
            <p className="text-muted">期待値 {v.expected}</p>
            <p className={cn("tabular font-black", v.ok ? "text-success" : "text-danger")}>結果 {v.actual}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Histogram({ data }: { data: RaceReportDto["histogram"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="flex h-32 items-end gap-1">
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end" title={`${d.label}: ${d.count}件`}>
            <span className="tabular mb-1 text-[10px] text-muted">{d.count > 0 ? d.count : ""}</span>
            <div className="w-full rounded-t bg-primary/70" style={{ height: `${(d.count / max) * 85}%`, minHeight: d.count > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-subtle">
        <span>{data[0]?.label.split("〜")[0]}ms</span>
        <span>応答時間の分布</span>
        <span>{data[data.length - 1]?.label.split("〜")[1]}</span>
      </div>
    </div>
  );
}

export function LoadTestView() {
  const toast = useToast();
  const [race, setRace] = useState({ users: "1000", slots: "300", draws: "random", latencyMs: "1", jitterMs: "200", mode: "lock" as "lock" | "nolock" });
  const [raceRunning, setRaceRunning] = useState(false);
  const [raceReport, setRaceReport] = useState<RaceReportDto | null>(null);
  const [idem, setIdem] = useState({ repeats: "20", mode: "lock" as "lock" | "nolock" });
  const [idemRunning, setIdemRunning] = useState(false);
  const [idemReport, setIdemReport] = useState<IdempotencyReportDto | null>(null);

  async function runRace() {
    setRaceRunning(true);
    setRaceReport(null);
    try {
      setRaceReport(
        await api.post<RaceReportDto>("/api/admin/loadtest/race", {
          users: Number(race.users),
          slots: Number(race.slots),
          draws: race.draws,
          latencyMs: Number(race.latencyMs),
          jitterMs: Number(race.jitterMs),
          mode: race.mode,
        }),
      );
    } catch (err) {
      toast.error("テストを実行できませんでした", errorMessage(err));
    } finally {
      setRaceRunning(false);
    }
  }

  async function runIdem() {
    setIdemRunning(true);
    setIdemReport(null);
    try {
      setIdemReport(await api.post<IdempotencyReportDto>("/api/admin/loadtest/idempotency", { repeats: Number(idem.repeats), mode: idem.mode, latencyMs: 1 }));
    } catch (err) {
      toast.error("テストを実行できませんでした", errorMessage(err));
    } finally {
      setIdemRunning(false);
    }
  }

  const r = raceReport;
  return (
    <div className="space-y-6">
      <Notice tone="info" title="このテストについて">
        本番と同じ抽選処理（1リクエストで最大100回の抽選・チケット消費・残り口数の更新・ラストワン賞の判定）を、テスト用の非公開ガチャと仮想ユーザーに対して同時に実行し、データに矛盾がないかを自動で検証します。テスト後、仮想ユーザーとテスト用ガチャのデータはすべて削除されます。「排他制御なし」を選ぶと、ロックがない場合に起きる不整合（売り越し・ラストワン賞の重複など）を再現できます。
      </Notice>

      <Card>
        <CardHeader icon="flask" title="① ラストワン争奪 同時アクセステスト" description="残りわずかの口を、大量の会員が同時に引き合う状況（SNSイベント時・ラストワン終盤）を再現します。" />
        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="仮想ユーザー数" htmlFor="lt-users" hint="同時接続 100〜2,000">
              <Input id="lt-users" type="number" min={10} max={2000} value={race.users} onChange={(e) => setRace({ ...race, users: e.target.value })} />
            </Field>
            <Field label="テスト用ガチャの総口数" htmlFor="lt-slots">
              <Input id="lt-slots" type="number" min={10} max={10000} value={race.slots} onChange={(e) => setRace({ ...race, slots: e.target.value })} />
            </Field>
            <Field label="1リクエストの回数" htmlFor="lt-draws">
              <Select id="lt-draws" value={race.draws} onChange={(e) => setRace({ ...race, draws: e.target.value })}>
                <option value="1">1回引き</option>
                <option value="10">10回引き</option>
                <option value="random">ランダム（1〜10回）</option>
              </Select>
            </Field>
            <Field label="擬似DB遅延" htmlFor="lt-latency" hint="読み取り〜更新の間">
              <Select id="lt-latency" value={race.latencyMs} onChange={(e) => setRace({ ...race, latencyMs: e.target.value })}>
                {[0, 1, 2, 5].map((v) => (
                  <option key={v} value={v}>
                    {v}ms
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="アクセスの集中度" htmlFor="lt-jitter" hint="小さいほど同時">
              <Select id="lt-jitter" value={race.jitterMs} onChange={(e) => setRace({ ...race, jitterMs: e.target.value })}>
                <option value="0">完全に同時</option>
                <option value="200">0.2秒以内</option>
                <option value="1000">1秒以内</option>
              </Select>
            </Field>
          </div>
          <ModeSwitch value={race.mode} onChange={(mode) => setRace({ ...race, mode })} />
          <Button size="lg" leftIcon="play" onClick={runRace} loading={raceRunning}>
            {raceRunning ? "実行中…" : "テストを実行"}
          </Button>

          {r && (
            <div className="space-y-5 border-t border-line pt-5">
              <ResultBanner
                ok={r.ok}
                title={r.ok ? "整合性OK：すべての検証を通過しました" : "不整合を検出しました"}
                sub={`${r.mode === "lock" ? "排他制御あり" : "排他制御なし（比較用）"} ／ 仮想ユーザー ${formatNumber(r.requests)}名 ／ 総口数 ${formatNumber(r.totalSlots)}口 ／ ${formatNumber(r.durationMs)}ms`}
              />
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard label="処理時間" value={`${formatNumber(r.durationMs)}ms`} sub={`${formatNumber(r.throughput)} リクエスト/秒`} icon="zap" tone="info" />
                <StatCard label="抽選成功" value={`${formatNumber(r.succeeded)}件`} sub={`完売で受付終了 ${formatNumber(r.rejected.soldOut)}件・残り不足 ${formatNumber(r.rejected.insufficientSlots)}件`} icon="checkCircle" tone="success" />
                <StatCard label="販売口数 / 総口数" value={`${formatNumber(r.slotsSold)} / ${formatNumber(r.totalSlots)}`} sub={`記録上の残り ${formatNumber(r.finalRemaining)}口`} icon="capsule" tone={r.slotsSold > r.totalSlots ? "danger" : "primary"} />
                <StatCard label="ラストワン賞" value={`${r.lastOneWinners.length}名`} sub={r.lastOneWinners.map((w) => w.nickname).join("、") || "—"} icon="crown" tone={r.lastOneWinners.length === 1 ? "success" : "danger"} />
              </div>
              <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                <InvariantList items={r.invariants} />
                <div className="rounded-xl border border-line p-4">
                  <Histogram data={r.histogram} />
                  <p className="mt-3 text-xs text-muted">
                    平均 {r.latency.avg}ms ／ 中央値 {r.latency.p50}ms ／ 95% {r.latency.p95}ms ／ 最大 {r.latency.max}ms
                  </p>
                  <p className="mt-1 text-[11px] text-subtle">
                    後片付け: 抽選 {formatNumber(r.cleanup.draws)}件・台帳 {formatNumber(r.cleanup.ledger)}件・仮想ユーザー {formatNumber(r.cleanup.users)}名を削除
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon="refresh" title="② 二重送信（冪等性）テスト" description="通信の再送やボタンの連打で、同じ抽選リクエストが同時に何度も届く状況を再現します。" />
        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <Field label="同時送信回数" htmlFor="id-repeats">
              <Input id="id-repeats" type="number" min={2} max={50} value={idem.repeats} onChange={(e) => setIdem({ ...idem, repeats: e.target.value })} />
            </Field>
            <ModeSwitch value={idem.mode} onChange={(mode) => setIdem({ ...idem, mode })} />
          </div>
          <Button size="lg" leftIcon="play" onClick={runIdem} loading={idemRunning}>
            テストを実行
          </Button>
          {idemReport && (
            <div className="space-y-4 border-t border-line pt-5">
              <ResultBanner
                ok={idemReport.ok}
                title={idemReport.ok ? "整合性OK：二重課金は発生しませんでした" : "二重課金を検出しました"}
                sub={`同じリクエストを${idemReport.repeats}回同時に送信 ／ 抽選 ${idemReport.drawRecords}件 ／ 保存済み結果の返却 ${idemReport.replayed}件 ／ チケット消費 ${idemReport.ticketsCharged}枚`}
              />
              <InvariantList items={idemReport.invariants} />
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon="database" title="本番環境での実装方針" />
        <CardBody>
          <ul className="grid gap-3 text-sm md:grid-cols-2">
            {[
              ["排他制御", "ガチャ行・会員行を SELECT … FOR UPDATE でロックし、残り口数・チケット残高の確認から更新までを1トランザクションで実行します（このデモのロックと同じ役割）。"],
              ["売り越し防止", "UPDATE gachas SET remaining = remaining - n WHERE id = ? AND remaining >= n のような条件付き更新で、口数がマイナスにならないことをDBレベルでも保証します。"],
              ["ラストワン賞", "残り口数が0になった更新を行ったトランザクションだけが当選者を記録するため、同時アクセスでも当選者は必ず1名です。"],
              ["二重送信", "(user_id, request_id) にユニーク制約を設定し、同じリクエストは保存済みの結果を返します。通信エラー時の再送でも二重課金になりません。"],
            ].map(([title, body]) => (
              <li key={title} className="rounded-xl bg-surface-2 p-4">
                <p className="font-bold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
