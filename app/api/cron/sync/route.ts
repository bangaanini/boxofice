import { NextResponse, type NextRequest } from "next/server";

import {
  resolveSyncPages,
  syncAllMovieFeeds,
  syncMovieFeed,
} from "@/lib/movie-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAuthorizationError(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const authorizationError = getAuthorizationError(request);

  if (authorizationError) {
    return authorizationError;
  }

  try {
    const target = request.nextUrl.searchParams.get("target");
    const pages = resolveSyncPages(request.nextUrl.searchParams.get("pages"));
    if (target === "home" || target === "popular" || target === "new") {
      const summary = await syncMovieFeed(target, { pages });

      return NextResponse.json({
        ok: summary.errors.length === 0,
        pages,
        summary,
      });
    }

    const summary = await syncAllMovieFeeds({ pages });
    const hasErrors = Object.values(summary.targets).some(
      (item) => item.errors.length > 0,
    );

    return NextResponse.json({
      ok: !hasErrors,
      pages,
      summary,
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
