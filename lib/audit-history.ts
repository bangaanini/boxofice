import { prisma } from "@/lib/prisma";

export type AuditHistoryTarget = "all" | "home" | "popular" | "new";
export type AuditRunStatus = "completed" | "failed" | "running" | "stopped";

export type AuditHistoryTotals = {
  broken: number;
  checked: number;
  errorCount: number;
  hidden: number;
  playable: number;
  refreshed: number;
};

export type AuditHistoryTargetSummary = AuditHistoryTotals & {
  messages: string[];
};

export type AuditHistorySummary = {
  messages: string[];
  targets: Record<"home" | "popular" | "new", AuditHistoryTargetSummary>;
  totals: AuditHistoryTotals;
};

export type AuditHistoryEntry = {
  autoHide: boolean;
  batchSize: number;
  completedBatches: number;
  finishedAt: string | null;
  id: string;
  messages: string[];
  processedMovies: number;
  startedAt: string;
  status: AuditRunStatus;
  summary: AuditHistorySummary;
  target: AuditHistoryTarget;
  totalMovies: number;
  updatedAt: string;
};

type AuditHistoryResult = {
  runs: AuditHistoryEntry[];
  schemaIssue: string | null;
  schemaReady: boolean;
};

type SingleAuditHistoryResult = {
  run: AuditHistoryEntry | null;
  schemaIssue: string | null;
  schemaReady: boolean;
};

type PersistAuditBatchInput = {
  autoHide: boolean;
  batchCount: number;
  batchSize: number;
  runId?: string | null;
  status: AuditRunStatus;
  summary: AuditHistorySummary;
  target: AuditHistoryTarget;
  totalMovies: number;
};

const AUDIT_HISTORY_SCHEMA_ISSUE =
  "Riwayat audit belum aktif di database runtime. Jalankan migration terbaru agar laporan audit tersimpan permanen.";
const MAX_AUDIT_MESSAGES = 12;

function createEmptyTotals(): AuditHistoryTotals {
  return {
    broken: 0,
    checked: 0,
    errorCount: 0,
    hidden: 0,
    playable: 0,
    refreshed: 0,
  };
}

function createEmptyTargetSummary(): AuditHistoryTargetSummary {
  return {
    ...createEmptyTotals(),
    messages: [],
  };
}

function createEmptySummary(): AuditHistorySummary {
  return {
    messages: [],
    targets: {
      home: createEmptyTargetSummary(),
      new: createEmptyTargetSummary(),
      popular: createEmptyTargetSummary(),
    },
    totals: createEmptyTotals(),
  };
}

function mergeTotals(
  current: AuditHistoryTotals,
  incoming: AuditHistoryTotals,
): AuditHistoryTotals {
  return {
    broken: current.broken + incoming.broken,
    checked: current.checked + incoming.checked,
    errorCount: current.errorCount + incoming.errorCount,
    hidden: current.hidden + incoming.hidden,
    playable: current.playable + incoming.playable,
    refreshed: current.refreshed + incoming.refreshed,
  };
}

function mergeMessages(current: string[], incoming: string[]) {
  return Array.from(new Set([...current, ...incoming])).slice(-MAX_AUDIT_MESSAGES);
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : 0;
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeTargetSummary(value: unknown): AuditHistoryTargetSummary {
  if (typeof value !== "object" || value === null) {
    return createEmptyTargetSummary();
  }

  const target = value as Record<string, unknown>;

  return {
    broken: toNumber(target.broken),
    checked: toNumber(target.checked),
    errorCount: toNumber(target.errorCount),
    hidden: toNumber(target.hidden),
    messages: toStringArray(target.messages),
    playable: toNumber(target.playable),
    refreshed: toNumber(target.refreshed),
  };
}

function normalizeSummary(value: unknown): AuditHistorySummary {
  if (typeof value !== "object" || value === null) {
    return createEmptySummary();
  }

  const raw = value as Record<string, unknown>;
  const targets =
    typeof raw.targets === "object" && raw.targets !== null
      ? (raw.targets as Record<string, unknown>)
      : {};

  return {
    messages: toStringArray(raw.messages),
    targets: {
      home: normalizeTargetSummary(targets.home),
      new: normalizeTargetSummary(targets.new),
      popular: normalizeTargetSummary(targets.popular),
    },
    totals: {
      broken: toNumber((raw.totals as Record<string, unknown> | undefined)?.broken),
      checked: toNumber((raw.totals as Record<string, unknown> | undefined)?.checked),
      errorCount: toNumber(
        (raw.totals as Record<string, unknown> | undefined)?.errorCount,
      ),
      hidden: toNumber((raw.totals as Record<string, unknown> | undefined)?.hidden),
      playable: toNumber(
        (raw.totals as Record<string, unknown> | undefined)?.playable,
      ),
      refreshed: toNumber(
        (raw.totals as Record<string, unknown> | undefined)?.refreshed,
      ),
    },
  };
}

function mergeSummary(
  current: AuditHistorySummary,
  incoming: AuditHistorySummary,
): AuditHistorySummary {
  return {
    messages: mergeMessages(current.messages, incoming.messages),
    targets: {
      home: {
        ...mergeTotals(current.targets.home, incoming.targets.home),
        messages: mergeMessages(
          current.targets.home.messages,
          incoming.targets.home.messages,
        ),
      },
      new: {
        ...mergeTotals(current.targets.new, incoming.targets.new),
        messages: mergeMessages(
          current.targets.new.messages,
          incoming.targets.new.messages,
        ),
      },
      popular: {
        ...mergeTotals(current.targets.popular, incoming.targets.popular),
        messages: mergeMessages(
          current.targets.popular.messages,
          incoming.targets.popular.messages,
        ),
      },
    },
    totals: mergeTotals(current.totals, incoming.totals),
  };
}

function isRecordWithCode(
  error: unknown,
): error is { code?: string; message?: string } {
  return typeof error === "object" && error !== null;
}

function isMissingAuditHistorySchemaError(error: unknown) {
  if (!isRecordWithCode(error)) {
    return false;
  }

  if (error.code !== "P2021" && error.code !== "P2022") {
    return false;
  }

  const message = typeof error.message === "string" ? error.message : "";

  return (
    message.includes("CatalogAuditRun") ||
    message.includes("completedBatches") ||
    message.includes("summary")
  );
}

function normalizeTarget(value: string): AuditHistoryTarget {
  return value === "home" || value === "popular" || value === "new" || value === "all"
    ? value
    : "all";
}

function normalizeStatus(value: string): AuditRunStatus {
  return value === "completed" ||
    value === "failed" ||
    value === "running" ||
    value === "stopped"
    ? value
    : "running";
}

function serializeRun(
  run: {
    autoHide: boolean;
    batchSize: number;
    completedBatches: number;
    finishedAt: Date | null;
    id: string;
    messages: string[];
    processedMovies: number;
    startedAt: Date;
    status: string;
    summary: unknown;
    target: string;
    totalMovies: number;
    updatedAt: Date;
  },
): AuditHistoryEntry {
  return {
    autoHide: run.autoHide,
    batchSize: run.batchSize,
    completedBatches: run.completedBatches,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    id: run.id,
    messages: toStringArray(run.messages),
    processedMovies: run.processedMovies,
    startedAt: run.startedAt.toISOString(),
    status: normalizeStatus(run.status),
    summary: normalizeSummary(run.summary),
    target: normalizeTarget(run.target),
    totalMovies: run.totalMovies,
    updatedAt: run.updatedAt.toISOString(),
  };
}

export async function getRecentCatalogAuditRunsSafe(
  limit = 8,
): Promise<AuditHistoryResult> {
  try {
    const runs = await prisma.catalogAuditRun.findMany({
      orderBy: { startedAt: "desc" },
      take: Math.max(1, Math.min(limit, 20)),
    });

    return {
      runs: runs.map(serializeRun),
      schemaIssue: null,
      schemaReady: true,
    };
  } catch (error) {
    if (!isMissingAuditHistorySchemaError(error)) {
      throw error;
    }

    return {
      runs: [],
      schemaIssue: AUDIT_HISTORY_SCHEMA_ISSUE,
      schemaReady: false,
    };
  }
}

export async function persistCatalogAuditBatchSafe(
  input: PersistAuditBatchInput,
): Promise<SingleAuditHistoryResult> {
  try {
    const incomingSummary = normalizeSummary(input.summary);

    if (!input.runId) {
      const created = await prisma.catalogAuditRun.create({
        data: {
          autoHide: input.autoHide,
          batchSize: input.batchSize,
          broken: incomingSummary.totals.broken,
          checked: incomingSummary.totals.checked,
          completedBatches: input.batchCount > 0 ? 1 : 0,
          errorCount: incomingSummary.totals.errorCount,
          finishedAt:
            input.status === "completed" ||
            input.status === "failed" ||
            input.status === "stopped"
              ? new Date()
              : null,
          hidden: incomingSummary.totals.hidden,
          messages: incomingSummary.messages,
          playable: incomingSummary.totals.playable,
          processedMovies: input.batchCount,
          refreshed: incomingSummary.totals.refreshed,
          status: input.status,
          summary: incomingSummary,
          target: input.target,
          totalMovies: input.totalMovies,
        },
      });

      return {
        run: serializeRun(created),
        schemaIssue: null,
        schemaReady: true,
      };
    }

    const existing = await prisma.catalogAuditRun.findUnique({
      where: { id: input.runId },
    });

    if (!existing) {
      return persistCatalogAuditBatchSafe({ ...input, runId: null });
    }

    const mergedSummary = mergeSummary(
      normalizeSummary(existing.summary),
      incomingSummary,
    );
    const updated = await prisma.catalogAuditRun.update({
      where: { id: existing.id },
      data: {
        broken: mergedSummary.totals.broken,
        checked: mergedSummary.totals.checked,
        completedBatches: existing.completedBatches + (input.batchCount > 0 ? 1 : 0),
        errorCount: mergedSummary.totals.errorCount,
        finishedAt:
          input.status === "completed" ||
          input.status === "failed" ||
          input.status === "stopped"
            ? new Date()
            : null,
        hidden: mergedSummary.totals.hidden,
        messages: mergedSummary.messages,
        playable: mergedSummary.totals.playable,
        processedMovies: existing.processedMovies + input.batchCount,
        refreshed: mergedSummary.totals.refreshed,
        status: input.status,
        summary: mergedSummary,
        totalMovies: input.totalMovies || existing.totalMovies,
      },
    });

    return {
      run: serializeRun(updated),
      schemaIssue: null,
      schemaReady: true,
    };
  } catch (error) {
    if (!isMissingAuditHistorySchemaError(error)) {
      throw error;
    }

    return {
      run: null,
      schemaIssue: AUDIT_HISTORY_SCHEMA_ISSUE,
      schemaReady: false,
    };
  }
}

export async function markCatalogAuditRunStatusSafe(input: {
  message?: string | null;
  runId: string;
  status: Exclude<AuditRunStatus, "running">;
}): Promise<SingleAuditHistoryResult> {
  try {
    const existing = await prisma.catalogAuditRun.findUnique({
      where: { id: input.runId },
    });

    if (!existing) {
      return {
        run: null,
        schemaIssue: null,
        schemaReady: true,
      };
    }

    const existingSummary = normalizeSummary(existing.summary);
    const nextMessages = input.message
      ? mergeMessages(existingSummary.messages, [input.message])
      : existingSummary.messages;
    const updated = await prisma.catalogAuditRun.update({
      where: { id: existing.id },
      data: {
        finishedAt: new Date(),
        messages: nextMessages,
        status: input.status,
        summary: {
          ...existingSummary,
          messages: nextMessages,
        },
      },
    });

    return {
      run: serializeRun(updated),
      schemaIssue: null,
      schemaReady: true,
    };
  } catch (error) {
    if (!isMissingAuditHistorySchemaError(error)) {
      throw error;
    }

    return {
      run: null,
      schemaIssue: AUDIT_HISTORY_SCHEMA_ISSUE,
      schemaReady: false,
    };
  }
}
