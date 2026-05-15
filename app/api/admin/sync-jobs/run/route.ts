import { after, NextResponse } from "next/server";

import {
  runMovieSyncJobStep,
  triggerMovieSyncJob,
} from "@/lib/movie-sync-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Payload runner tidak valid" },
      { status: 400 },
    );
  }

  const body =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : {};
  const jobId = readString(body.jobId);
  const runnerToken = readString(body.runnerToken);

  if (!jobId || !runnerToken) {
    return NextResponse.json(
      { ok: false, error: "Job atau token runner kosong" },
      { status: 400 },
    );
  }

  const result = await runMovieSyncJobStep({ jobId, runnerToken });

  if (result.shouldContinue) {
    after(() =>
      triggerMovieSyncJob({
        jobId,
        runnerToken,
        origin: new URL(request.url).origin,
      }),
    );
  }

  return NextResponse.json({
    ok: Boolean(result.job),
    claimed: result.claimed,
    done: result.done,
    shouldContinue: result.shouldContinue,
    job: result.job
      ? {
          id: result.job.id,
          target: result.job.target,
          status: result.job.status,
          currentPhase: result.job.currentPhase,
          currentPage: result.job.currentPage,
          currentOffset: result.job.currentOffset,
          processedHomeMovies: result.job.processedHomeMovies,
          totalHomeMovies: result.job.totalHomeMovies,
          processedTrendingMovies: result.job.processedTrendingMovies,
          totalTrendingMovies: result.job.totalTrendingMovies,
          errorCount: result.job.errorCount,
        }
      : null,
  });
}
