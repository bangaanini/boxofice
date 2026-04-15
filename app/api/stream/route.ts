import { NextResponse, type NextRequest } from "next/server";

import { fetchPlayableStream, MovieApiError } from "@/lib/movie-api";
import { prisma } from "@/lib/prisma";
import { getCurrentUserSession } from "@/lib/user-auth";
import {
  createPlaybackAccessToken,
  getVipProgramSettingsSafe,
  getVipStatus,
  resolvePreviewLimitSeconds,
} from "@/lib/vip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const STREAM_CACHE_FRESH_MS = 15 * 60 * 1000;

type CachedStreamSource = {
  url: string;
  label: string;
  quality?: string;
  type?: string;
};

type CachedMovieStream = {
  checkedAt: Date;
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

function isCacheFresh(checkedAt: Date) {
  return Date.now() - checkedAt.getTime() <= STREAM_CACHE_FRESH_MS;
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
            checkedAt: true,
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
          checkedAt: true,
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
  const [lookup, user, vipSettingsResult] = await Promise.all([
    resolveStreamLookup(request),
    getCurrentUserSession(),
    getVipProgramSettingsSafe(),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!lookup?.sourceUrl) {
    return NextResponse.json(
      { error: "A valid sourceUrl or id query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const vipStatus = getVipStatus(user);
    const previewLimitSeconds = resolvePreviewLimitSeconds(
      vipSettingsResult.settings,
      vipStatus.active,
    );
    const accessToken = createPlaybackAccessToken({
      movieId: lookup.movieId,
      previewLimitSeconds,
      userId: user.id,
      vipActive: vipStatus.active,
    });
    const streamCache = lookup.streamCache;
    const cachedStream = streamCache ? cachedStreamResponse(streamCache) : null;

    if (cachedStream && streamCache && isCacheFresh(streamCache.checkedAt)) {
      return NextResponse.json(
        {
          ...cachedStream,
          accessToken: accessToken.token,
          accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
          paywallDescription: vipSettingsResult.settings.paywallDescription,
          paywallTitle: vipSettingsResult.settings.paywallTitle,
          previewLimitSeconds,
          upgradeLabel: vipSettingsResult.settings.joinVipLabel,
          upgradeUrl: vipSettingsResult.settings.joinVipUrl,
          vipActive: vipStatus.active,
          vipExpiresAt: vipStatus.expiresAt?.toISOString() ?? null,
        },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        },
      );
    }

    const stream = await fetchPlayableStream(lookup.sourceUrl, {
      revalidate: 3600,
    });

    if (lookup.movieId) {
      if (stream.sources.length) {
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
      } else {
        await prisma.movieStreamCache
          .deleteMany({
            where: {
              movieId: lookup.movieId,
            },
          })
          .catch((error) => {
            console.error("Failed to clear broken stream cache", error);
          });
      }
    }

    return NextResponse.json(
      {
        accessToken: accessToken.token,
        accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
        iframe: stream.iframe,
        m3u8: stream.m3u8,
        originalUrl: stream.originalUrl,
        paywallDescription: vipSettingsResult.settings.paywallDescription,
        paywallTitle: vipSettingsResult.settings.paywallTitle,
        previewLimitSeconds,
        sources: stream.sources,
        resolvedFrom: stream.resolvedFrom,
        upgradeLabel: vipSettingsResult.settings.joinVipLabel,
        upgradeUrl: vipSettingsResult.settings.joinVipUrl,
        vipActive: vipStatus.active,
        vipExpiresAt: vipStatus.expiresAt?.toISOString() ?? null,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
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
