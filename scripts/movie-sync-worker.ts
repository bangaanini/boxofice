import { existsSync } from "fs";
import path from "path";
import { setTimeout as sleep } from "timers/promises";

import { config } from "dotenv";

for (const envFile of [".env.local", ".env"]) {
  const envPath = path.resolve(process.cwd(), envFile);

  if (existsSync(envPath)) {
    config({ override: false, path: envPath, quiet: true });
  }
}

process.env.MOVIE_SYNC_WORKER = "1";

const DEFAULT_IDLE_DELAY_MS = 5000;
const DEFAULT_STEP_DELAY_MS = 750;
const DEFAULT_ERROR_DELAY_MS = 10000;

function readIntegerEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(process.env[name] ?? fallback);
  const safeValue = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;

  return Math.min(Math.max(safeValue, min), max);
}

const idleDelayMs = readIntegerEnv(
  "SYNC_WORKER_IDLE_DELAY_MS",
  DEFAULT_IDLE_DELAY_MS,
  1000,
  60000,
);
const stepDelayMs = readIntegerEnv(
  "SYNC_WORKER_STEP_DELAY_MS",
  DEFAULT_STEP_DELAY_MS,
  0,
  10000,
);
const errorDelayMs = readIntegerEnv(
  "SYNC_WORKER_ERROR_DELAY_MS",
  DEFAULT_ERROR_DELAY_MS,
  1000,
  120000,
);
const runOnce = process.argv.includes("--once");

let shouldStop = false;
let lastIdleLogAt = 0;

function log(message: string, meta?: Record<string, unknown>) {
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";

  console.log(`[movie-sync-worker] ${new Date().toISOString()} ${message}${suffix}`);
}

function requestStop(signal: NodeJS.Signals) {
  shouldStop = true;
  log(`received ${signal}, stopping after current step`);
}

process.once("SIGINT", requestStop);
process.once("SIGTERM", requestStop);

async function main() {
  const [{ prisma }, movieSyncJobs] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/movie-sync-jobs"),
  ]);

  async function runAvailableStep() {
    const runner = await movieSyncJobs.getNextMovieSyncJobRunner();

    if (!runner) {
      const now = Date.now();

      if (now - lastIdleLogAt >= Math.max(idleDelayMs * 6, 30000)) {
        lastIdleLogAt = now;
        log("idle, waiting for queued jobs");
      }

      return false;
    }

    const startedAt = Date.now();
    const result = await movieSyncJobs.runMovieSyncJobStep({
      jobId: runner.id,
      runnerToken: runner.runnerToken,
    });
    const job = result.job;

    log("step finished", {
      claimed: result.claimed,
      currentOffset: job?.currentOffset,
      currentPage: job?.currentPage,
      done: result.done,
      durationMs: Date.now() - startedAt,
      jobId: runner.id,
      phase: job?.currentPhase,
      processedHomeMovies: job?.processedHomeMovies,
      processedTrendingMovies: job?.processedTrendingMovies,
      shouldContinue: result.shouldContinue,
      status: job?.status,
    });

    return result.claimed || result.shouldContinue;
  }

  log("started", {
    idleDelayMs,
    once: runOnce,
    stepDelayMs,
  });

  while (!shouldStop) {
    try {
      const worked = await runAvailableStep();

      if (runOnce) {
        break;
      }

      await sleep(worked ? stepDelayMs : idleDelayMs);
    } catch (error) {
      console.error("[movie-sync-worker] step failed", error);

      if (runOnce) {
        process.exitCode = 1;
        break;
      }

      await sleep(errorDelayMs);
    }
  }

  await prisma.$disconnect();
  log("stopped");
}

void main().catch((error) => {
  console.error("[movie-sync-worker] fatal error", error);
  process.exitCode = 1;
});
