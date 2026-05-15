import { NextResponse, type NextRequest } from "next/server";

import { hasBotOwnerPlaybackAccess } from "@/lib/bot-access";
import { fetchGetPlay, MovieApiError } from "@/lib/movie-api";
import { refreshSeriesEpisodeMetadataIfNeeded } from "@/lib/movie-series-metadata";
import { prisma } from "@/lib/prisma";
import {
  normalizeSeasonsList,
  resolveSeriesEpisode,
} from "@/lib/season-utils";
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
  seasonsList: unknown;
};

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
          seasonsList: true,
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
            seasonsList: true,
          },
        })
      : null;

  if (!movie || !movie.subjectId) {
    return null;
  }

  const refreshedSeriesMetadata = await refreshSeriesEpisodeMetadataIfNeeded({
    detailPath: movie.detailPath ?? movie.sourceUrl,
    id: movie.id,
    seasonsList: movie.seasonsList,
    subjectType: movie.subjectType,
    totalEpisode: movie.totalEpisode,
    totalSeason: movie.totalSeason,
  });

  return {
    movieId: movie.id,
    detailPath: movie.detailPath ?? movie.sourceUrl,
    subjectId: movie.subjectId,
    subjectType: movie.subjectType,
    totalSeason: refreshedSeriesMetadata?.totalSeason ?? movie.totalSeason,
    totalEpisode: refreshedSeriesMetadata?.totalEpisode ?? movie.totalEpisode,
    seasonsList:
      refreshedSeriesMetadata?.seasonsList ??
      normalizeSeasonsList(movie.seasonsList),
  };
}

function resolveEpisode(lookup: StreamLookup, request: NextRequest) {
  const isSeries = lookup.subjectType === 2;

  if (!isSeries) {
    return { se: 0, ep: 0 };
  }

  const selectedEpisode = resolveSeriesEpisode({
    requestedEpisode: request.nextUrl.searchParams.get("ep"),
    requestedSeason: request.nextUrl.searchParams.get("se"),
    seasonsList: normalizeSeasonsList(lookup.seasonsList),
    totalEpisode: lookup.totalEpisode,
    totalSeason: lookup.totalSeason,
  });

  return {
    se: selectedEpisode.season,
    ep: selectedEpisode.episode,
  };
}

export async function GET(request: NextRequest) {
  const [user, vipSettingsResult] = await Promise.all([
    getCurrentUserSession(),
    getVipProgramSettingsSafe(),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lookup = await resolveStreamLookup(request);

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
