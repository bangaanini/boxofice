import { NextResponse, type NextRequest } from "next/server";

import { fetchPlayableStream, MovieApiError } from "@/lib/movie-api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CachedStreamSource = {
  url: string;
  label: string;
  quality?: string;
  type?: string;
};

type CachedMovieStream = {
  iframe: string | null;
  m3u8: string | null;
  originalUrl: string | null;
  resolvedFrom: string | null;
  sources: unknown;
};

function normalizeCachedSources(value: unknown): CachedStreamSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((source): source is CachedStreamSource => {
    return (
      typeof source === "object" &&
      source !== null &&
      "url" in source &&
      "label" in source &&
      typeof source.url === "string" &&
      typeof source.label === "string"
    );
  });
}

function cachedStreamResponse(cache: CachedMovieStream) {
  const sources = normalizeCachedSources(cache.sources);

  if (!sources.length) {
    return null;
  }

  return {
    iframe: cache.iframe ?? undefined,
    m3u8: cache.m3u8 ?? undefined,
    originalUrl: cache.originalUrl ?? undefined,
    resolvedFrom: cache.resolvedFrom ?? undefined,
    sources,
  };
}

async function resolveStreamLookup(request: NextRequest) {
  const sourceUrl = request.nextUrl.searchParams.get("sourceUrl");

  if (sourceUrl) {
    const movie = await prisma.movie.findUnique({
      where: { sourceUrl },
      select: {
        id: true,
        sourceUrl: true,
        streamCache: {
          select: {
            iframe: true,
            m3u8: true,
            originalUrl: true,
            resolvedFrom: true,
            sources: true,
          },
        },
      },
    });

    return {
      movieId: movie?.id,
      sourceUrl,
      streamCache: movie?.streamCache ?? null,
    };
  }

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return null;
  }

  const movie = await prisma.movie.findUnique({
    where: { id },
    select: {
      id: true,
      sourceUrl: true,
      streamCache: {
        select: {
          iframe: true,
          m3u8: true,
          originalUrl: true,
          resolvedFrom: true,
          sources: true,
        },
      },
    },
  });

  return movie
    ? {
        movieId: movie.id,
        sourceUrl: movie.sourceUrl,
        streamCache: movie.streamCache,
      }
    : null;
}

export async function GET(request: NextRequest) {
  const lookup = await resolveStreamLookup(request);

  if (!lookup?.sourceUrl) {
    return NextResponse.json(
      { error: "A valid sourceUrl or id query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const cachedStream = lookup.streamCache
      ? cachedStreamResponse(lookup.streamCache)
      : null;

    if (cachedStream) {
      return NextResponse.json(cachedStream, {
        headers: {
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=300",
        },
      });
    }

    const stream = await fetchPlayableStream(lookup.sourceUrl, {
      revalidate: 3600,
    });

    if (lookup.movieId && stream.sources.length) {
      await prisma.movieStreamCache
        .upsert({
          where: {
            movieId: lookup.movieId,
          },
          create: {
            movieId: lookup.movieId,
            sourceUrl: lookup.sourceUrl,
            resolvedFrom: stream.resolvedFrom,
            originalUrl: stream.originalUrl,
            iframe: stream.iframe,
            m3u8: stream.m3u8,
            sources: stream.sources,
            checkedAt: new Date(),
          },
          update: {
            resolvedFrom: stream.resolvedFrom,
            originalUrl: stream.originalUrl,
            iframe: stream.iframe,
            m3u8: stream.m3u8,
            sources: stream.sources,
            checkedAt: new Date(),
          },
        })
        .catch((error) => {
          console.error("Failed to write stream cache", error);
        });
    }

    return NextResponse.json(
      {
        iframe: stream.iframe,
        m3u8: stream.m3u8,
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
