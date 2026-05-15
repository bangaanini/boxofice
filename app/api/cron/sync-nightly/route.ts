import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { getCronAuthorizationError } from "@/lib/cron-route";
import {
  resolveSyncPage,
  syncFilmboxHome,
  syncTrendingPages,
  type FilmboxHomeSyncSummary,
  type FilmboxTrendingSyncSummary,
} from "@/lib/movie-sync";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_BATCH_PAGES = 5;
const MAX_TRENDING_PAGE = 200;
const DEFAULT_PER_PAGE = 18;
const DEFAULT_CURSOR_SLUG = "movie-sync-nightly";

type CursorState = {
  currentPage: number;
  syncedHomeAt?: string;
};

function clampPerPage(value: string | null) {
  if (!value) {
    return DEFAULT_PER_PAGE;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? Math.min(Math.max(Math.trunc(parsed), 1), 60)
    : DEFAULT_PER_PAGE;
}

function clampBatchPages(value: string | null) {
  if (!value) {
    return DEFAULT_BATCH_PAGES;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? Math.min(Math.max(Math.trunc(parsed), 1), 20)
    : DEFAULT_BATCH_PAGES;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCursorState(value: unknown): CursorState {
  if (!isRecord(value)) {
    return { currentPage: 0 };
  }

  const rawCurrentPage = Number(value.currentPage);
  const currentPage = Number.isFinite(rawCurrentPage)
    ? Math.max(0, Math.trunc(rawCurrentPage))
    : 0;
  const syncedHomeAt =
    typeof value.syncedHomeAt === "string" ? value.syncedHomeAt : undefined;

  return { currentPage, syncedHomeAt };
}

async function readCursorState(slug: string): Promise<CursorState> {
  const rows = await prisma.$queryRaw<Array<{ state: unknown }>>`
    SELECT "state"
    FROM "CronJobCursor"
    WHERE "slug" = ${slug}
    LIMIT 1
  `;

  return normalizeCursorState(rows[0]?.state ?? null);
}

async function writeCursorState(slug: string, state: CursorState) {
  const payload = JSON.stringify(state);

  await prisma.$executeRaw`
    INSERT INTO "CronJobCursor" (
      "id",
      "slug",
      "state",
      "lastRunAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${slug},
      ${payload}::jsonb,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT ("slug")
    DO UPDATE SET
      "state" = ${payload}::jsonb,
      "lastRunAt" = NOW(),
      "updatedAt" = NOW()
  `;
}

function revalidateCatalogPages() {
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/library");
  revalidatePath("/browse/[slug]", "page");
  revalidatePath("/movie/[id]", "page");
  revalidatePath("/admin");
  revalidatePath("/admin/sync");
}

function shouldRunHomeSync(state: CursorState, force: boolean) {
  if (force) {
    return true;
  }

  if (!state.syncedHomeAt) {
    return true;
  }

  const lastRun = new Date(state.syncedHomeAt).getTime();

  if (!Number.isFinite(lastRun)) {
    return true;
  }

  const sixHoursMs = 6 * 60 * 60 * 1000;
  return Date.now() - lastRun > sixHoursMs;
}

export async function GET(request: NextRequest) {
  const authorizationError = getCronAuthorizationError(request);

  if (authorizationError) {
    return authorizationError;
  }

  const slug = (request.nextUrl.searchParams.get("slug")?.trim() ||
    DEFAULT_CURSOR_SLUG)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const cursorSlug = slug || DEFAULT_CURSOR_SLUG;
  const target = request.nextUrl.searchParams.get("target") ?? "all";
  const batchPages = clampBatchPages(
    request.nextUrl.searchParams.get("batchPages"),
  );
  const perPage = clampPerPage(request.nextUrl.searchParams.get("perPage"));
  const fromPageOverride = request.nextUrl.searchParams.get("fromPage");
  const toPageOverride = request.nextUrl.searchParams.get("toPage");
  const force = request.nextUrl.searchParams.get("force") === "1";

  try {
    const state = await readCursorState(cursorSlug);
    let homeSummary: FilmboxHomeSyncSummary | null = null;
    let trendingSummary: FilmboxTrendingSyncSummary | null = null;
    let nextState: CursorState = state;

    if (target === "home" || target === "all") {
      if (shouldRunHomeSync(state, force)) {
        homeSummary = await syncFilmboxHome();
        nextState = {
          ...nextState,
          syncedHomeAt: new Date().toISOString(),
        };
      }
    }

    if (target === "trending" || target === "all") {
      const explicitFrom =
        fromPageOverride !== null ? resolveSyncPage(fromPageOverride) : null;
      const explicitTo =
        toPageOverride !== null ? resolveSyncPage(toPageOverride) : null;
      const fromPage = explicitFrom ?? state.currentPage;
      const toPage = explicitTo ?? fromPage + batchPages - 1;

      trendingSummary = await syncTrendingPages({
        fromPage,
        toPage,
        perPage,
      });

      const nextPage = trendingSummary.fetched > 0 ? toPage + 1 : 0;
      nextState = {
        ...nextState,
        currentPage:
          nextPage > MAX_TRENDING_PAGE ? 0 : Math.max(0, nextPage),
      };
    }

    await writeCursorState(cursorSlug, nextState);
    revalidateCatalogPages();

    return NextResponse.json({
      ok:
        (homeSummary?.errors.length ?? 0) === 0 &&
        (trendingSummary?.errors.length ?? 0) === 0,
      slug: cursorSlug,
      state: nextState,
      target,
      summary: {
        home: homeSummary,
        trending: trendingSummary,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Nightly sync failed",
      },
      { status: 502 },
    );
  }
}
