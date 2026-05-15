import { NextResponse, type NextRequest } from "next/server";

import { hasBotOwnerPlaybackAccess } from "@/lib/bot-access";
import { fetchGetPlay, MovieApiError } from "@/lib/movie-api";
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

type StreamLookup = {
  movieId: string;
  detailPath: string;
  subjectId: string;
  subjectType: number;
  totalSeason: number;
  totalEpisode: number;
};

function clampInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

async function resolveStreamLookup(
  request: NextRequest,
): Promise<StreamLookup | null> {
  const detailPathQuery = request.nextUrl.searchParams.get("detailPath");
  const idQuery = request.nextUrl.searchParams.get("id");
  const sourceUrlQuery = request.nextUrl.searchParams.get("sourceUrl");
  const findBy = detailPathQuery ?? sourceUrlQuery;

  const movie = idQuery
    ? await prisma.movie.findUnique({
        where: { id: idQuery },
        select: {
          id: true,
          detailPath: true,
          sourceUrl: true,
          subjectId: true,
          subjectType: true,
          totalSeason: true,
          totalEpisode: true,
        },
      })
    : findBy
      ? await prisma.movie.findUnique({
          where: { sourceUrl: findBy },
          select: {
            id: true,
            detailPath: true,
            sourceUrl: true,
            subjectId: true,
            subjectType: true,
            totalSeason: true,
            totalEpisode: true,
          },
        })
      : null;

  if (!movie || !movie.subjectId) {
    return null;
  }

  return {
    movieId: movie.id,
    detailPath: movie.detailPath ?? movie.sourceUrl,
    subjectId: movie.subjectId,
    subjectType: movie.subjectType,
    totalSeason: movie.totalSeason,
    totalEpisode: movie.totalEpisode,
  };
}

function resolveEpisode(lookup: StreamLookup, request: NextRequest) {
  const isSeries = lookup.subjectType === 2;

  if (!isSeries) {
    return { se: 0, ep: 0 };
  }

  const seParam = clampInt(request.nextUrl.searchParams.get("se"), 1);
  const epParam = clampInt(request.nextUrl.searchParams.get("ep"), 1);
  const seasonCap = Math.max(1, lookup.totalSeason || 1);
  const episodeCap = Math.max(1, lookup.totalEpisode || 1);

  return {
    se: Math.min(Math.max(seParam, 1), seasonCap),
    ep: Math.min(Math.max(epParam, 1), episodeCap),
  };
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

  if (!lookup) {
    return NextResponse.json(
      {
        error:
          "Berikan parameter id, detailPath, atau sourceUrl yang valid.",
      },
      { status: 400 },
    );
  }

  try {
    const [ownerPlaybackAccess, vipStatus] = await Promise.all([
      hasBotOwnerPlaybackAccess(user),
      Promise.resolve(getVipStatus(user)),
    ]);
    const vipLikeAccess = vipStatus.active || ownerPlaybackAccess;
    const previewLimitSeconds = resolvePreviewLimitSeconds(
      vipSettingsResult.settings,
      vipLikeAccess,
    );
    const accessToken = createPlaybackAccessToken({
      movieId: lookup.movieId,
      previewLimitSeconds,
      userId: user.id,
      vipActive: vipLikeAccess,
    });
    const { se, ep } = resolveEpisode(lookup, request);
    const playback = await fetchGetPlay({
      detailPath: lookup.detailPath,
      ep,
      lang: "in_id",
      se,
      subjectId: lookup.subjectId,
    });

    if (!playback.vidUrlProxy) {
      return NextResponse.json(
        {
          error: "Sumber video belum tersedia dari Filmbox.",
        },
        { status: 502 },
      );
    }

    const sources = [
      {
        url: playback.vidUrlProxy,
        label:
          typeof playback.quality === "number"
            ? `${playback.quality}p`
            : String(playback.quality ?? "Auto"),
        quality:
          typeof playback.quality === "number"
            ? String(playback.quality)
            : String(playback.quality ?? "auto"),
        type: "video/mp4",
      },
    ];
    const subtitles = playback.subUrl
      ? [
          {
            src: `/api/subtitle?url=${encodeURIComponent(playback.subUrl)}`,
            lang: "id",
            label: "Indonesia",
            default: true,
          },
        ]
      : [];

    return NextResponse.json(
      {
        accessToken: accessToken.token,
        accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
        episode: playback.episode,
        format: playback.format,
        ownerPlaybackAccess,
        paywallDescription: vipSettingsResult.settings.paywallDescription,
        paywallTitle: vipSettingsResult.settings.paywallTitle,
        previewLimitSeconds,
        season: playback.se,
        sources,
        subtitles,
        upgradeLabel: vipSettingsResult.settings.joinVipLabel,
        upgradeUrl: vipSettingsResult.settings.joinVipUrl,
        vipActive: vipLikeAccess,
        vipExpiresAt: vipStatus.expiresAt?.toISOString() ?? null,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    const status =
      error instanceof MovieApiError && error.status === 404 ? 404 : 502;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Tidak bisa mengambil sumber video saat ini.",
      },
      { status },
    );
  }
}
