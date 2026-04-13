import { NextResponse, type NextRequest } from "next/server";

import { fetchPlayableStream, MovieApiError } from "@/lib/movie-api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveSourceUrl(request: NextRequest) {
  const sourceUrl = request.nextUrl.searchParams.get("sourceUrl");

  if (sourceUrl) {
    return sourceUrl;
  }

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return null;
  }

  const movie = await prisma.movie.findUnique({
    where: { id },
    select: { sourceUrl: true },
  });

  return movie?.sourceUrl ?? null;
}

export async function GET(request: NextRequest) {
  const sourceUrl = await resolveSourceUrl(request);

  if (!sourceUrl) {
    return NextResponse.json(
      { error: "A valid sourceUrl or id query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const stream = await fetchPlayableStream(sourceUrl, { revalidate: 3600 });

    return NextResponse.json(
      {
        originalUrl: stream.originalUrl,
        sources: stream.sources,
        resolvedFrom: stream.resolvedFrom,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    const status = error instanceof MovieApiError && error.status === 404 ? 404 : 502;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to fetch stream information",
      },
      { status },
    );
  }
}
