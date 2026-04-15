import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentAdminSession } from "@/lib/admin-session";
import {
  markCatalogAuditRunStatusSafe,
  persistCatalogAuditBatchSafe,
  type AuditHistorySummary,
} from "@/lib/audit-history";
import {
  auditMovieCatalogBatch,
  type CombinedAuditSummary,
  type FeedAuditSummary,
  type MovieAuditTarget,
} from "@/lib/movie-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BatchSummaryBlock = {
  broken: number;
  checked: number;
  errorCount: number;
  hidden: number;
  messages: string[];
  playable: number;
  refreshed: number;
};

type AuditIntent = "batch" | "fail" | "stop";

function resolveTarget(value: unknown): MovieAuditTarget {
  return value === "home" ||
    value === "popular" ||
    value === "new" ||
    value === "all"
    ? value
    : "all";
}

function resolveBatchSize(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 12;
  const safeValue = Number.isFinite(parsed) ? Math.trunc(parsed) : 12;

  return Math.min(Math.max(safeValue, 1), 50);
}

function resolveIntent(value: unknown): AuditIntent {
  return value === "stop" || value === "fail" ? value : "batch";
}

function resolveFinalStatus(intent: Exclude<AuditIntent, "batch">) {
  return intent === "stop" ? "stopped" : "failed";
}

function normalizeFeedSummary(summary: FeedAuditSummary): BatchSummaryBlock {
  return {
    broken: summary.broken,
    checked: summary.checked,
    errorCount: summary.errors.length,
    hidden: summary.hidden,
    messages: summary.errors,
    playable: summary.playable,
    refreshed: summary.refreshed,
  };
}

function normalizeSummary(
  target: MovieAuditTarget,
  summary: FeedAuditSummary | CombinedAuditSummary,
) {
  if (target === "all") {
    const combined = summary as CombinedAuditSummary;

    return {
      messages: combined.errors,
      targets: {
        home: normalizeFeedSummary(combined.targets.home),
        new: normalizeFeedSummary(combined.targets.new),
        popular: normalizeFeedSummary(combined.targets.popular),
      },
      totals: {
        broken: combined.totalBroken,
        checked: combined.totalChecked,
        errorCount: combined.totalErrors,
        hidden: combined.totalHidden,
        playable: combined.totalPlayable,
        refreshed: combined.totalRefreshed,
      },
    };
  }

  const feedSummary = summary as FeedAuditSummary;
  const emptyBlock = {
    broken: 0,
    checked: 0,
    errorCount: 0,
    hidden: 0,
    messages: [],
    playable: 0,
    refreshed: 0,
  };
  const activeBlock = normalizeFeedSummary(feedSummary);

  return {
    messages: feedSummary.errors,
    targets: {
      home: target === "home" ? activeBlock : emptyBlock,
      new: target === "new" ? activeBlock : emptyBlock,
      popular: target === "popular" ? activeBlock : emptyBlock,
    },
    totals: {
      broken: feedSummary.broken,
      checked: feedSummary.checked,
      errorCount: feedSummary.errors.length,
      hidden: feedSummary.hidden,
      playable: feedSummary.playable,
      refreshed: feedSummary.refreshed,
    },
  };
}

export async function POST(request: NextRequest) {
  const adminSession = await getCurrentAdminSession();

  if (!adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    autoHide?: boolean;
    batchSize?: number | string;
    cursor?: string | null;
    intent?: string;
    message?: string;
    runId?: string | null;
    target?: string;
  };
  const target = resolveTarget(body.target);
  const batchSize = resolveBatchSize(body.batchSize);
  const cursor = typeof body.cursor === "string" ? body.cursor : null;
  const autoHide = body.autoHide !== false;
  const runId = typeof body.runId === "string" ? body.runId : null;
  const intent = resolveIntent(body.intent);

  if (intent !== "batch") {
    const finalized = runId
      ? await markCatalogAuditRunStatusSafe({
          message:
            typeof body.message === "string" && body.message.trim().length
              ? body.message.trim()
              : null,
          runId,
          status: resolveFinalStatus(intent),
        })
      : {
          run: null,
          schemaIssue: null,
          schemaReady: true,
        };

    revalidatePath("/admin");
    revalidatePath("/admin/sync");
    revalidatePath("/");
    revalidatePath("/browse/home");
    revalidatePath("/browse/populer");
    revalidatePath("/browse/new");

    return NextResponse.json({
      history: finalized.run,
      runId: finalized.run?.id ?? runId,
      schemaIssue: finalized.schemaIssue,
      schemaReady: finalized.schemaReady,
      status: intent,
    });
  }

  try {
    const result = await auditMovieCatalogBatch(target, {
      autoHide,
      batchSize,
      cursor,
    });
    const normalized = normalizeSummary(target, result.summary);
    const persisted = await persistCatalogAuditBatchSafe({
      autoHide,
      batchCount: result.batchCount,
      batchSize,
      runId,
      status: result.hasMore ? "running" : "completed",
      summary: normalized as AuditHistorySummary,
      target,
      totalMovies: result.total,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/sync");

    if (!result.hasMore) {
      revalidatePath("/");
      revalidatePath("/browse/home");
      revalidatePath("/browse/populer");
      revalidatePath("/browse/new");
    }

    return NextResponse.json({
      ...normalized,
      batchCount: result.batchCount,
      hasMore: result.hasMore,
      history: persisted.run,
      nextCursor: result.nextCursor,
      runId: persisted.run?.id ?? runId,
      schemaIssue: persisted.schemaIssue,
      schemaReady: persisted.schemaReady,
      target,
      total: result.total,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Audit gagal dijalankan karena kesalahan yang tidak dikenal.";

    if (runId) {
      await markCatalogAuditRunStatusSafe({
        message,
        runId,
        status: "failed",
      });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
