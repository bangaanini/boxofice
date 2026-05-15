import { NextResponse, type NextRequest } from "next/server";

import { getCronAuthorizationError } from "@/lib/cron-route";
import {
  resolveSyncPage,
  syncFilmboxHome,
  syncTrendingPages,
  type FilmboxHomeSyncSummary,
  type FilmboxTrendingSyncSummary,
} from "@/lib/movie-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function clampPerPage(value: string | null): number {
  if (!value) {
    return 18;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 18;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 60);
}

export async function GET(request: NextRequest) {
  const authorizationError = getCronAuthorizationError(request);

  if (authorizationError) {
    return authorizationError;
  }

  const target = request.nextUrl.searchParams.get("target") ?? "all";
  const fromPage = resolveSyncPage(
    request.nextUrl.searchParams.get("fromPage") ??
      request.nextUrl.searchParams.get("page") ??
      0,
  );
  const toPage = resolveSyncPage(
    request.nextUrl.searchParams.get("toPage") ?? fromPage,
  );
  const perPage = clampPerPage(request.nextUrl.searchParams.get("perPage"));

  try {
    if (target === "home") {
      const summary = await syncFilmboxHome();
      return NextResponse.json({
        ok: summary.errors.length === 0,
        target: "home",
        summary,
      });
    }

    if (target === "trending") {
      const summary = await syncTrendingPages({ fromPage, toPage, perPage });
      return NextResponse.json({
        ok: summary.errors.length === 0,
        target: "trending",
        summary,
      });
    }

    const home: FilmboxHomeSyncSummary = await syncFilmboxHome();
    const trending: FilmboxTrendingSyncSummary = await syncTrendingPages({
      fromPage,
      toPage,
      perPage,
    });

    return NextResponse.json({
      ok: home.errors.length === 0 && trending.errors.length === 0,
      target: "all",
      summary: { home, trending },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 502 },
    );
  }
}
