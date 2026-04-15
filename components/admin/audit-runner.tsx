"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AuditHistoryEntry } from "@/lib/audit-history";
import { cn } from "@/lib/utils";

type AuditTarget = "all" | "home" | "popular" | "new";

type AuditTotals = {
  broken: number;
  checked: number;
  errorCount: number;
  hidden: number;
  playable: number;
  refreshed: number;
};

type AuditTargetBlock = AuditTotals & {
  messages: string[];
};

type AuditBatchPayload = {
  batchCount: number;
  hasMore: boolean;
  history: AuditHistoryEntry | null;
  messages: string[];
  nextCursor: string | null;
  runId: string | null;
  schemaIssue?: string | null;
  schemaReady?: boolean;
  target: AuditTarget;
  targets: Record<"home" | "popular" | "new", AuditTargetBlock>;
  total: number;
  totals: AuditTotals;
};

type AuditFinalizePayload = {
  history: AuditHistoryEntry | null;
  runId: string | null;
  schemaIssue?: string | null;
  schemaReady?: boolean;
  status: "fail" | "stop";
};

type AuditReportState = {
  autoHide: boolean;
  batchSize: number;
  currentBatch: number;
  error: string | null;
  finished: boolean;
  logs: string[];
  processed: number;
  running: boolean;
  runId: string | null;
  target: AuditTarget;
  targets: Record<"home" | "popular" | "new", AuditTotals>;
  total: number;
  totals: AuditTotals;
};

const TARGET_BUTTONS: Array<{ label: string; target: AuditTarget }> = [
  { label: "Audit All", target: "all" },
  { label: "Audit Home", target: "home" },
  { label: "Audit Populer", target: "popular" },
  { label: "Audit New", target: "new" },
];

function createEmptyTotals(): AuditTotals {
  return {
    broken: 0,
    checked: 0,
    errorCount: 0,
    hidden: 0,
    playable: 0,
    refreshed: 0,
  };
}

function createInitialReport(batchSize = 12): AuditReportState {
  return {
    autoHide: true,
    batchSize,
    currentBatch: 0,
    error: null,
    finished: false,
    logs: [],
    processed: 0,
    running: false,
    runId: null,
    target: "all",
    targets: {
      home: createEmptyTotals(),
      new: createEmptyTotals(),
      popular: createEmptyTotals(),
    },
    total: 0,
    totals: createEmptyTotals(),
  };
}

function mergeTotals(current: AuditTotals, incoming: AuditTotals): AuditTotals {
  return {
    broken: current.broken + incoming.broken,
    checked: current.checked + incoming.checked,
    errorCount: current.errorCount + incoming.errorCount,
    hidden: current.hidden + incoming.hidden,
    playable: current.playable + incoming.playable,
    refreshed: current.refreshed + incoming.refreshed,
  };
}

function clampProgress(processed: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
}

function prettyTargetName(target: AuditTarget) {
  switch (target) {
    case "home":
      return "home";
    case "popular":
      return "populer";
    case "new":
      return "new";
    default:
      return "semua katalog";
  }
}

function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function upsertAuditHistory(
  history: AuditHistoryEntry[],
  nextEntry: AuditHistoryEntry,
) {
  return [nextEntry, ...history.filter((item) => item.id !== nextEntry.id)]
    .sort(
      (left, right) =>
        new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
    )
    .slice(0, 8);
}

function ReportMiniCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/25 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function RunStatusBadge({ status }: { status: AuditHistoryEntry["status"] }) {
  const className =
    status === "completed"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
      : status === "failed"
        ? "border-red-400/20 bg-red-500/10 text-red-100"
        : status === "stopped"
          ? "border-yellow-400/20 bg-yellow-500/10 text-yellow-100"
          : "border-orange-400/20 bg-orange-500/10 text-orange-100";

  const label =
    status === "completed"
      ? "Selesai"
      : status === "failed"
        ? "Gagal"
        : status === "stopped"
          ? "Dihentikan"
          : "Berjalan";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase",
        className,
      )}
    >
      {label}
    </span>
  );
}

function PerTargetRow({
  label,
  totals,
}: {
  label: string;
  totals: AuditTotals;
}) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-2 text-xs leading-6 text-neutral-300">
        Dicek: <strong>{totals.checked}</strong> · Playable:{" "}
        <strong>{totals.playable}</strong> · Broken:{" "}
        <strong>{totals.broken}</strong>
      </p>
      <p className="text-xs leading-6 text-neutral-400">
        Disembunyikan: {totals.hidden} · Error audit: {totals.errorCount}
      </p>
    </div>
  );
}

export function AuditRunner({
  historySchemaIssue: initialHistorySchemaIssue = null,
  historySchemaReady: initialHistorySchemaReady = true,
  initialHistory = [],
}: {
  historySchemaIssue?: string | null;
  historySchemaReady?: boolean;
  initialHistory?: AuditHistoryEntry[];
}) {
  const [report, setReport] = React.useState<AuditReportState>(() =>
    createInitialReport(),
  );
  const [history, setHistory] = React.useState<AuditHistoryEntry[]>(initialHistory);
  const [historySchemaIssue, setHistorySchemaIssue] = React.useState<string | null>(
    initialHistorySchemaIssue,
  );
  const [historySchemaReady, setHistorySchemaReady] = React.useState(
    initialHistorySchemaReady,
  );
  const activeRunIdRef = React.useRef<string | null>(null);
  const stopRequestedRef = React.useRef(false);

  function syncHistoryAvailability(payload: {
    schemaIssue?: string | null;
    schemaReady?: boolean;
  }) {
    if (typeof payload.schemaReady === "boolean") {
      setHistorySchemaReady(payload.schemaReady);
    }

    if ("schemaIssue" in payload) {
      setHistorySchemaIssue(payload.schemaIssue ?? null);
    }
  }

  async function finalizeRun(intent: "fail" | "stop", message: string) {
    if (!activeRunIdRef.current) {
      return null;
    }

    const response = await fetch("/admin/api/audit", {
      body: JSON.stringify({
        intent,
        message,
        runId: activeRunIdRef.current,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as AuditFinalizePayload;
    syncHistoryAvailability(payload);

    if (payload.history) {
      setHistory((current) => upsertAuditHistory(current, payload.history!));
      activeRunIdRef.current = payload.history.id;
    }

    return payload.history;
  }

  async function runAudit(target: AuditTarget) {
    stopRequestedRef.current = false;
    activeRunIdRef.current = null;
    const initialBatchSize = report.batchSize;
    const initialAutoHide = report.autoHide;

    setReport({
      ...createInitialReport(initialBatchSize),
      autoHide: initialAutoHide,
      batchSize: initialBatchSize,
      running: true,
      target,
    });

    let cursor: string | null = null;
    let batchIndex = 0;
    let currentTotal = 0;

    try {
      while (!stopRequestedRef.current) {
        const response = await fetch("/admin/api/audit", {
          body: JSON.stringify({
            autoHide: initialAutoHide,
            batchSize: initialBatchSize,
            cursor,
            runId: activeRunIdRef.current,
            target,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(`Audit berhenti di batch ${batchIndex + 1} (${response.status}).`);
        }

        const payload = (await response.json()) as AuditBatchPayload;
        batchIndex += 1;
        currentTotal = currentTotal || payload.total;
        cursor = payload.nextCursor;
        activeRunIdRef.current = payload.runId;
        syncHistoryAvailability(payload);

        if (payload.history) {
          setHistory((current) => upsertAuditHistory(current, payload.history!));
        }

        setReport((current) => {
          const nextLogs = Array.from(
            new Set([...current.logs, ...payload.messages]),
          ).slice(-8);

          return {
            ...current,
            currentBatch: batchIndex,
            finished: !payload.hasMore,
            logs: nextLogs,
            processed: current.processed + payload.batchCount,
            running: payload.hasMore,
            runId: payload.runId,
            target,
            total: current.total || payload.total,
            targets: {
              home: mergeTotals(current.targets.home, payload.targets.home),
              new: mergeTotals(current.targets.new, payload.targets.new),
              popular: mergeTotals(current.targets.popular, payload.targets.popular),
            },
            totals: mergeTotals(current.totals, payload.totals),
          };
        });

        if (!payload.hasMore) {
          return;
        }
      }

      const stopMessage =
        "Audit dihentikan manual. Progress sampai batch terakhir tetap tersimpan di riwayat audit.";
      const stoppedHistory = await finalizeRun("stop", stopMessage);

      setReport((current) => ({
        ...current,
        error: stopMessage,
        finished: true,
        running: false,
        runId: stoppedHistory?.id ?? current.runId,
        total: current.total || currentTotal,
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Audit berhenti karena kesalahan yang tidak dikenal.";

      await finalizeRun("fail", message);
      setReport((current) => ({
        ...current,
        error: message,
        finished: true,
        running: false,
      }));
    }
  }

  const progress = clampProgress(report.processed, report.total);

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={report.autoHide}
            onChange={(event) =>
              setReport((current) => ({
                ...current,
                autoHide: event.target.checked,
              }))
            }
            className="mt-1 size-4 rounded border-white/15 bg-black/30"
          />
          <span>
            <strong className="block text-white">Auto hide film yang broken</strong>
            Judul yang benar-benar mati akan langsung hilang dari katalog saat audit selesai memeriksa batch-nya.
          </span>
        </label>

        <label className="rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-300">
          <span className="block text-sm font-semibold text-white">Ukuran batch</span>
          <input
            type="number"
            min={1}
            max={50}
            value={report.batchSize}
            onChange={(event) =>
              setReport((current) => ({
                ...current,
                batchSize: Math.min(
                  50,
                  Math.max(1, Number(event.target.value) || 12),
                ),
              }))
            }
            className="mt-2 h-11 w-full rounded-[14px] border border-white/10 bg-black/30 px-3 text-base text-white outline-none focus:border-orange-300"
          />
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            Batch kecil lebih aman untuk upstream. Default yang enak dipakai: `12`.
          </p>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TARGET_BUTTONS.map((item) => (
          <Button
            key={item.target}
            type="button"
            variant="secondary"
            disabled={report.running}
            onClick={() => void runAudit(item.target)}
            className="h-12 border border-white/10 bg-white/10 text-white hover:bg-white/15"
          >
            {report.running && report.target === item.target ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            {item.label}
          </Button>
        ))}
      </div>

      <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">
              Progress audit {prettyTargetName(report.target)}
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-400">
              {report.running
                ? `Batch ${report.currentBatch || 1} sedang diproses.`
                : report.finished
                  ? "Audit berhenti di laporan terakhir di bawah."
                  : "Belum ada audit yang sedang berjalan."}
            </p>
          </div>

          {report.running ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                stopRequestedRef.current = true;
              }}
              className="h-10 border border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              Hentikan audit
            </Button>
          ) : null}
        </div>

        <div className="mt-4 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn(
              "h-3 rounded-full bg-[linear-gradient(90deg,#ff5f1f,#ff8a3d)] transition-[width] duration-500",
              report.running && "animate-pulse",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-300">
          <span>
            Progress: <strong className="text-white">{progress}%</strong>
          </span>
          <span>
            Diproses: <strong className="text-white">{report.processed}</strong> /{" "}
            <strong className="text-white">{report.total}</strong>
          </span>
          <span>
            Batch selesai: <strong className="text-white">{report.currentBatch}</strong>
          </span>
        </div>

        {report.error ? (
          <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{report.error}</p>
          </div>
        ) : report.finished && report.processed > 0 ? (
          <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <p>
              Audit selesai. Panel ini menyimpan ringkasan batch terakhir sampai kamu menjalankan audit baru.
            </p>
          </div>
        ) : report.running ? (
          <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-orange-400/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
            <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" />
            <p>
              Audit berjalan bertahap agar tidak menembak semua judul sekaligus. Ini lebih aman untuk upstream dan lebih ringan untuk server.
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ReportMiniCard label="Dicek" value={report.totals.checked} />
        <ReportMiniCard label="Playable" value={report.totals.playable} />
        <ReportMiniCard label="Broken" value={report.totals.broken} />
        <ReportMiniCard label="Disembunyikan" value={report.totals.hidden} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <PerTargetRow label="Audit home" totals={report.targets.home} />
        <PerTargetRow label="Audit populer" totals={report.targets.popular} />
        <PerTargetRow label="Audit new" totals={report.targets.new} />
      </div>

      <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-orange-200" />
          <p className="text-sm font-semibold text-white">Laporan audit</p>
        </div>
        <p className="mt-2 text-xs leading-5 text-neutral-400">
          Daftar ini menampilkan error audit paling baru. Kalau kosong, berarti batch yang sudah lewat tidak menemukan error teknis selain sumber upstream yang memang sudah mati.
        </p>

        {report.logs.length ? (
          <div className="mt-4 space-y-2">
            {report.logs.map((message) => (
              <div
                key={message}
                className="rounded-[16px] border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-neutral-200"
              >
                {message}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[16px] border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm text-neutral-500">
            Belum ada laporan audit. Jalankan audit untuk mulai mengecek katalog.
          </div>
        )}
      </div>

      <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Riwayat audit</p>
            <p className="mt-2 text-xs leading-5 text-neutral-400">
              Batch yang baru selesai otomatis masuk ke daftar ini. Jadi admin
              bisa lihat audit terakhir tanpa menunggu audit berikutnya.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-neutral-300">
            {history.length} run terakhir
          </span>
        </div>

        {historySchemaIssue ? (
          <div className="mt-4 rounded-[18px] border border-yellow-400/20 bg-yellow-500/10 px-4 py-3 text-sm leading-6 text-yellow-100">
            {historySchemaIssue}
          </div>
        ) : null}

        {history.length ? (
          <div className="mt-4 space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-[18px] border border-white/10 bg-black/25 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">
                      Audit {prettyTargetName(item.target)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-neutral-400">
                      Mulai {formatAuditDate(item.startedAt)}
                      {item.finishedAt
                        ? ` · Selesai ${formatAuditDate(item.finishedAt)}`
                        : ""}
                    </p>
                  </div>
                  <RunStatusBadge status={item.status} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <ReportMiniCard label="Diproses" value={`${item.processedMovies}/${item.totalMovies}`} />
                  <ReportMiniCard label="Batch" value={item.completedBatches} />
                  <ReportMiniCard label="Playable" value={item.summary.totals.playable} />
                  <ReportMiniCard label="Broken" value={item.summary.totals.broken} />
                  <ReportMiniCard label="Disembunyikan" value={item.summary.totals.hidden} />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                  <span>Batch size: {item.batchSize}</span>
                  <span>Auto hide: {item.autoHide ? "aktif" : "mati"}</span>
                  <span>Error audit: {item.summary.totals.errorCount}</span>
                  {!historySchemaReady ? <span>Mode fallback aktif</span> : null}
                </div>

                {item.messages.length ? (
                  <div className="mt-4 space-y-2">
                    {item.messages.slice(-2).map((message) => (
                      <div
                        key={`${item.id}-${message}`}
                        className="rounded-[14px] border border-white/10 bg-black/30 px-3 py-2 text-xs leading-5 text-neutral-300"
                      >
                        {message}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[16px] border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm text-neutral-500">
            Belum ada riwayat audit yang tersimpan. Jalankan audit sekali, lalu
            hasilnya akan muncul permanen di sini.
          </div>
        )}
      </div>
    </div>
  );
}
