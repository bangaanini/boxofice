import { NextResponse, type NextRequest } from "next/server";

import { getCatalogPage } from "@/lib/movie-feeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeQueryValue(value: string | null) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "12");
  const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
  const genre = normalizeQueryValue(request.nextUrl.searchParams.get("genre"));
  const year = normalizeQueryValue(request.nextUrl.searchParams.get("year"));

  const page = await getCatalogPage({
    genre,
    limit: Number.isFinite(limit) ? limit : 12,
    offset: Number.isFinite(offset) ? offset : 0,
    year,
  });

  return NextResponse.json(page, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
