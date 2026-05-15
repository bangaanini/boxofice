import { randomBytes, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

import { Prisma } from "@/app/generated/prisma/client";
import {
  syncFilmboxHomeBatch,
  syncTrendingPageBatch,
  type SyncCounters,
} from "@/lib/movie-sync";
import { prisma } from "@/lib/prisma";

export type MovieSyncTarget = "home" | "trending" | "all";
export type MovieSyncJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "partial"
  | "failed";
export type MovieSyncJobPhase = "home" | "trending" | "done";

export type MovieSyncJob = {
  id: string;
  target: MovieSyncTarget;
  status: MovieSyncJobStatus;
  fromPage: number;
  toPage: number;
  perPage: number;
  homeBatchSize: number;
  movieBatchSize: number;
  currentPhase: MovieSyncJobPhase;
  currentPage: number;
  currentOffset: number;
  processedHomeMovies: number;
  totalHomeMovies: number | null;
  processedTrendingMovies: number;
  totalTrendingMovies: number | null;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  skippedUnsupported: number;
  upserted: number;
  errorCount: number;
  messages: string[];
  summary: Record<string, unknown>;
  errorMessage: string | null;
  leaseId: string | null;
  leaseExpiresAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type MovieSyncJobRow = MovieSyncJob & {
  runnerToken: string;
  summary: unknown;
  target: string;
  status: string;
  currentPhase: string;
};

type CreatedMovieSyncJob = {
  id: string;
  runnerToken: string;
};

export type JobStepResult = {
  job: MovieSyncJob | null;
  claimed: boolean;
  shouldContinue: boolean;
  done: boolean;
};

const DEFAULT_HOME_BATCH_SIZE = 9;
const DEFAULT_MOVIE_BATCH_SIZE = 9;
const MAX_BACKGROUND_BATCH_SIZE = 60;
const LEASE_SECONDS = 240;
const MAX_STORED_MESSAGES = 20;

const TERMINAL_STATUSES = new Set<MovieSyncJobStatus>([
  "succeeded",
  "partial",
  "failed",
]);
let hasWarnedRevalidationFailure = false;

function clampPositiveInteger(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), 1), max);
}

function readBatchSize(envName: string, fallback: number) {
  return clampPositiveInteger(
    Number(process.env[envName] ?? fallback),
    fallback,
    MAX_BACKGROUND_BATCH_SIZE,
  );
}

function createRunnerToken() {
  return randomBytes(32).toString("base64url");
}

function normalizeTarget(value: string): MovieSyncTarget {
  return value === "trending" || value === "all" ? value : "home";
}

function normalizeStatus(value: string): MovieSyncJobStatus {
  if (
    value === "running" ||
    value === "succeeded" ||
    value === "partial" ||
    value === "failed"
  ) {
    return value;
  }

  return "queued";
}

function normalizePhase(value: string): MovieSyncJobPhase {
  if (value === "trending" || value === "done") {
    return value;
  }

  return "home";
}

function normalizeSummary(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return normalizeSummary(parsed);
    } catch {
      return {};
    }
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function normalizeMessages(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function normalizeJob(row: MovieSyncJobRow): MovieSyncJob {
  return {
    ...row,
    target: normalizeTarget(row.target),
    status: normalizeStatus(row.status),
    currentPhase: normalizePhase(row.currentPhase),
    messages: normalizeMessages(row.messages),
    summary: normalizeSummary(row.summary),
  };
}

function appendMessages(existing: string[], next: string[]) {
  return [...existing, ...next]
    .filter(Boolean)
    .slice(-MAX_STORED_MESSAGES);
}

function messagesSql(messages: string[]) {
  if (!messages.length) {
    return Prisma.sql`ARRAY[]::TEXT[]`;
  }

  return Prisma.sql`ARRAY[${Prisma.join(messages)}]::TEXT[]`;
}

function mergeSummary(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  return {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

function buildStatusAfterStep(
  isFinished: boolean,
  errorCount: number,
): MovieSyncJobStatus {
  if (!isFinished) {
    return "running";
  }

  return errorCount > 0 ? "partial" : "succeeded";
}

function safeRevalidatePath(path: string, type?: "layout" | "page") {
  if (process.env.MOVIE_SYNC_WORKER === "1") {
    return;
  }

  try {
    if (type) {
      revalidatePath(path, type);
    } else {
      revalidatePath(path);
    }
  } catch (error) {
    if (!hasWarnedRevalidationFailure) {
      hasWarnedRevalidationFailure = true;
      console.warn(
        "Movie sync cache revalidation skipped outside a Next.js request context.",
        error,
      );
    }
  }
}

function revalidateCatalogPages() {
  safeRevalidatePath("/");
  safeRevalidatePath("/admin");
  safeRevalidatePath("/admin/sync");
  safeRevalidatePath("/admin/users");
  safeRevalidatePath("/admin/settings");
  safeRevalidatePath("/search");
  safeRevalidatePath("/library");
  safeRevalidatePath("/browse/[slug]", "page");
  safeRevalidatePath("/movie/[id]", "page");
}

export function isActiveMovieSyncJob(job: Pick<MovieSyncJob, "status">) {
  return !TERMINAL_STATUSES.has(job.status);
}

export async function createMovieSyncJob(input: {
  target: MovieSyncTarget;
  fromPage: number;
  toPage: number;
  perPage: number;
}): Promise<CreatedMovieSyncJob> {
  const id = randomUUID();
  const runnerToken = createRunnerToken();
  const target = normalizeTarget(input.target);
  const fromPage = Math.max(0, Math.trunc(input.fromPage));
  const toPage = Math.max(fromPage, Math.trunc(input.toPage));
  const perPage = clampPositiveInteger(input.perPage, 18, 60);
  const homeBatchSize = readBatchSize(
    "SYNC_BACKGROUND_HOME_BATCH_SIZE",
    DEFAULT_HOME_BATCH_SIZE,
  );
  const movieBatchSize = readBatchSize(
    "SYNC_BACKGROUND_MOVIE_BATCH_SIZE",
    DEFAULT_MOVIE_BATCH_SIZE,
  );
  const currentPhase: MovieSyncJobPhase =
    target === "trending" ? "trending" : "home";
  const initialSummary = JSON.stringify({
    target,
    fromPage,
    toPage,
    perPage,
    homeBatchSize,
    movieBatchSize,
  });

  await prisma.$executeRaw`
    INSERT INTO "MovieSyncJob" (
      "id",
      "runnerToken",
      "target",
      "fromPage",
      "toPage",
      "perPage",
      "homeBatchSize",
      "movieBatchSize",
      "currentPhase",
      "currentPage",
      "summary",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${runnerToken},
      ${target},
      ${fromPage},
      ${toPage},
      ${perPage},
      ${homeBatchSize},
      ${movieBatchSize},
      ${currentPhase},
      ${fromPage},
      ${initialSummary}::jsonb,
      NOW(),
      NOW()
    )
  `;

  return { id, runnerToken };
}

export async function listRecentMovieSyncJobs(take = 6) {
  const safeTake = clampPositiveInteger(take, 6, 20);
  const rows = await prisma.$queryRaw<MovieSyncJobRow[]>`
    SELECT *
    FROM "MovieSyncJob"
    ORDER BY "createdAt" DESC
    LIMIT ${safeTake}
  `;

  return rows.map(normalizeJob);
}

export async function getMovieSyncJobRunner(jobId: string) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; runnerToken: string; status: string }>
  >`
    SELECT "id", "runnerToken", "status"
    FROM "MovieSyncJob"
    WHERE "id" = ${jobId}
    LIMIT 1
  `;
  const row = rows[0];

  if (!row || TERMINAL_STATUSES.has(normalizeStatus(row.status))) {
    return null;
  }

  return {
    id: row.id,
    runnerToken: row.runnerToken,
  };
}

export async function getNextMovieSyncJobRunner() {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; runnerToken: string; status: string }>
  >`
    SELECT "id", "runnerToken", "status"
    FROM "MovieSyncJob"
    WHERE "status" IN ('queued', 'running')
      AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" < NOW())
    ORDER BY
      CASE WHEN "status" = 'running' THEN 0 ELSE 1 END,
      "createdAt" ASC
    LIMIT 1
  `;
  const row = rows[0];

  if (!row || TERMINAL_STATUSES.has(normalizeStatus(row.status))) {
    return null;
  }

  return {
    id: row.id,
    runnerToken: row.runnerToken,
  };
}

async function getMovieSyncJobById(jobId: string) {
  const rows = await prisma.$queryRaw<MovieSyncJobRow[]>`
    SELECT *
    FROM "MovieSyncJob"
    WHERE "id" = ${jobId}
    LIMIT 1
  `;
  const row = rows[0];

  return row ? normalizeJob(row) : null;
}

async function claimMovieSyncJob(jobId: string, runnerToken: string) {
  const leaseId = randomUUID();
  const rows = await prisma.$queryRaw<MovieSyncJobRow[]>`
    UPDATE "MovieSyncJob"
    SET
      "status" = CASE
        WHEN "status" = 'queued' THEN 'running'
        ELSE "status"
      END,
      "startedAt" = COALESCE("startedAt", NOW()),
      "leaseId" = ${leaseId},
      "leaseExpiresAt" = NOW() + (${LEASE_SECONDS} * INTERVAL '1 second'),
      "updatedAt" = NOW()
    WHERE "id" = ${jobId}
      AND "runnerToken" = ${runnerToken}
      AND "status" IN ('queued', 'running')
      AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" < NOW())
    RETURNING *
  `;
  const row = rows[0];

  return row ? normalizeJob(row) : null;
}

async function updateJobAfterStep(
  job: MovieSyncJob,
  update: {
    status: MovieSyncJobStatus;
    currentPhase: MovieSyncJobPhase;
    currentPage: number;
    currentOffset: number;
    totalHomeMovies: number | null;
    totalTrendingMovies: number | null;
    processedHomeIncrement: number;
    processedTrendingIncrement: number;
    counters: SyncCounters;
    messages: string[];
    summary: Record<string, unknown>;
    finished: boolean;
  },
) {
  const summaryJson = JSON.stringify(update.summary);
  const rows = await prisma.$queryRaw<MovieSyncJobRow[]>`
    UPDATE "MovieSyncJob"
    SET
      "status" = ${update.status},
      "currentPhase" = ${update.currentPhase},
      "currentPage" = ${update.currentPage},
      "currentOffset" = ${update.currentOffset},
      "processedHomeMovies" =
        "processedHomeMovies" + ${update.processedHomeIncrement},
      "totalHomeMovies" = ${update.totalHomeMovies},
      "processedTrendingMovies" =
        "processedTrendingMovies" + ${update.processedTrendingIncrement},
      "totalTrendingMovies" = ${update.totalTrendingMovies},
      "fetched" = "fetched" + ${update.counters.fetched},
      "created" = "created" + ${update.counters.created},
      "updated" = "updated" + ${update.counters.updated},
      "unchanged" = "unchanged" + ${update.counters.unchanged},
      "skippedUnsupported" =
        "skippedUnsupported" + ${update.counters.skippedUnsupported},
      "upserted" = "upserted" + ${update.counters.upserted},
      "errorCount" = "errorCount" + ${update.counters.errors.length},
      "messages" = ${messagesSql(update.messages)},
      "summary" = ${summaryJson}::jsonb,
      "leaseId" = NULL,
      "leaseExpiresAt" = NULL,
      "finishedAt" = CASE
        WHEN ${update.finished} THEN NOW()
        ELSE "finishedAt"
      END,
      "updatedAt" = NOW()
    WHERE "id" = ${job.id}
      AND "leaseId" = ${job.leaseId}
    RETURNING *
  `;
  const row = rows[0];

  return row ? normalizeJob(row) : null;
}

async function failMovieSyncJob(job: MovieSyncJob, error: unknown) {
  const message = error instanceof Error ? error.message : "Sync job failed";
  const nextMessages = appendMessages(job.messages, [message]);
  const summaryJson = JSON.stringify(
    mergeSummary(job.summary, {
      failedAt: new Date().toISOString(),
      error: message,
    }),
  );
  const rows = await prisma.$queryRaw<MovieSyncJobRow[]>`
    UPDATE "MovieSyncJob"
    SET
      "status" = 'failed',
      "errorMessage" = ${message},
      "errorCount" = "errorCount" + 1,
      "messages" = ${messagesSql(nextMessages)},
      "summary" = ${summaryJson}::jsonb,
      "leaseId" = NULL,
      "leaseExpiresAt" = NULL,
      "finishedAt" = NOW(),
      "updatedAt" = NOW()
    WHERE "id" = ${job.id}
      AND "leaseId" = ${job.leaseId}
    RETURNING *
  `;
  const row = rows[0];

  return row ? normalizeJob(row) : null;
}

async function runHomeStep(job: MovieSyncJob) {
  const summary = await syncFilmboxHomeBatch({
    offset: job.currentOffset,
    limit: job.homeBatchSize,
  });
  const errorCount = job.errorCount + summary.errors.length;
  const shouldMoveToTrending = summary.done && job.target !== "home";
  const finished = summary.done && job.target === "home";
  const currentPhase = finished
    ? "done"
    : shouldMoveToTrending
      ? "trending"
      : "home";
  const currentPage = shouldMoveToTrending ? job.fromPage : job.currentPage;
  const currentOffset =
    finished || shouldMoveToTrending ? 0 : summary.nextOffset;
  const nextMessages = appendMessages(job.messages, summary.errors);
  const nextSummary = mergeSummary(job.summary, {
    home: {
      heroBanners: summary.heroBanners,
      sectionCount: summary.sections.length,
      totalMovies: summary.totalMovies,
      processedMovies: job.processedHomeMovies + summary.processed,
      lastOffset: summary.offset,
      batchSize: summary.limit,
      done: summary.done,
    },
  });

  return updateJobAfterStep(job, {
    status: buildStatusAfterStep(finished, errorCount),
    currentPhase,
    currentPage,
    currentOffset,
    totalHomeMovies: summary.totalMovies,
    totalTrendingMovies: job.totalTrendingMovies,
    processedHomeIncrement: summary.processed,
    processedTrendingIncrement: 0,
    counters: summary,
    messages: nextMessages,
    summary: nextSummary,
    finished,
  });
}

async function finishTrendingJob(job: MovieSyncJob) {
  const status = buildStatusAfterStep(true, job.errorCount);
  const summary = mergeSummary(job.summary, {
    trending: {
      ...(normalizeSummary(job.summary.trending) as Record<string, unknown>),
      done: true,
      fromPage: job.fromPage,
      toPage: job.toPage,
      perPage: job.perPage,
      processedMovies: job.processedTrendingMovies,
      totalMovies: job.totalTrendingMovies,
    },
  });

  return updateJobAfterStep(job, {
    status,
    currentPhase: "done",
    currentPage: job.currentPage,
    currentOffset: 0,
    totalHomeMovies: job.totalHomeMovies,
    totalTrendingMovies: job.totalTrendingMovies,
    processedHomeIncrement: 0,
    processedTrendingIncrement: 0,
    counters: {
      fetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      skippedUnsupported: 0,
      upserted: 0,
      errors: [],
    },
    messages: job.messages,
    summary,
    finished: true,
  });
}

async function runTrendingStep(job: MovieSyncJob) {
  if (job.currentPage > job.toPage) {
    return finishTrendingJob(job);
  }

  const summary = await syncTrendingPageBatch({
    page: job.currentPage,
    perPage: job.perPage,
    offset: job.currentOffset,
    limit: job.movieBatchSize,
  });
  const pageStarted = job.currentOffset === 0;
  const totalTrendingMovies =
    (job.totalTrendingMovies ?? 0) +
    (pageStarted ? summary.totalMovies : 0);
  const processedTrendingMovies =
    job.processedTrendingMovies + summary.processed;
  const errorCount = job.errorCount + summary.errors.length;
  const stopEarly = summary.pageFailed || summary.totalMovies === 0;
  const completedPage = summary.done || stopEarly;
  const finished =
    stopEarly || (completedPage && job.currentPage >= job.toPage);
  const currentPhase = finished ? "done" : "trending";
  const currentPage = completedPage ? job.currentPage + 1 : job.currentPage;
  const currentOffset = completedPage ? 0 : summary.nextOffset;
  const nextMessages = appendMessages(job.messages, summary.errors);
  const nextSummary = mergeSummary(job.summary, {
    trending: {
      fromPage: job.fromPage,
      toPage: job.toPage,
      perPage: job.perPage,
      currentPage: summary.page,
      totalMovies: totalTrendingMovies,
      processedMovies: processedTrendingMovies,
      lastOffset: summary.offset,
      batchSize: summary.limit,
      done: finished,
      stoppedEarly: stopEarly,
    },
  });

  return updateJobAfterStep(job, {
    status: buildStatusAfterStep(finished, errorCount),
    currentPhase,
    currentPage,
    currentOffset,
    totalHomeMovies: job.totalHomeMovies,
    totalTrendingMovies,
    processedHomeIncrement: 0,
    processedTrendingIncrement: summary.processed,
    counters: summary,
    messages: nextMessages,
    summary: nextSummary,
    finished,
  });
}

export async function runMovieSyncJobStep(input: {
  jobId: string;
  runnerToken: string;
}): Promise<JobStepResult> {
  const claimedJob = await claimMovieSyncJob(input.jobId, input.runnerToken);

  if (!claimedJob) {
    const job = await getMovieSyncJobById(input.jobId);

    return {
      job,
      claimed: false,
      shouldContinue: false,
      done: job ? !isActiveMovieSyncJob(job) : true,
    };
  }

  try {
    const updatedJob =
      claimedJob.currentPhase === "home"
        ? await runHomeStep(claimedJob)
        : claimedJob.currentPhase === "trending"
          ? await runTrendingStep(claimedJob)
          : await finishTrendingJob(claimedJob);

    revalidateCatalogPages();

    return {
      job: updatedJob,
      claimed: true,
      shouldContinue: updatedJob ? isActiveMovieSyncJob(updatedJob) : false,
      done: updatedJob ? !isActiveMovieSyncJob(updatedJob) : true,
    };
  } catch (error) {
    const failedJob = await failMovieSyncJob(claimedJob, error);
    revalidateCatalogPages();

    return {
      job: failedJob,
      claimed: true,
      shouldContinue: false,
      done: true,
    };
  }
}

export async function triggerMovieSyncJob(input: {
  jobId: string;
  runnerToken: string;
  origin: string;
}) {
  const url = new URL("/api/admin/sync-jobs/run", input.origin);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId: input.jobId,
        runnerToken: input.runnerToken,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        `Movie sync runner returned ${response.status} for job ${input.jobId}`,
      );
    }
  } catch (error) {
    console.error(`Failed to trigger movie sync job ${input.jobId}`, error);
  }
}
