import { Prisma } from "@/app/generated/prisma/client";
import { fetchDetail } from "@/lib/movie-api";
import { prisma } from "@/lib/prisma";
import {
  countEpisodesFromSeasons,
  normalizeSeasonsList,
  type SeasonInfo,
} from "@/lib/season-utils";

type SeriesMetadataInput = {
  detailPath: string | null;
  id: string;
  seasonsList: unknown;
  subjectType: number;
  totalEpisode: number;
  totalSeason: number;
};

export type RefreshedSeriesEpisodeMetadata = {
  seasonsList: SeasonInfo[] | null;
  totalEpisode: number;
  totalSeason: number;
};

function hasCompleteSeriesEpisodeMetadata(input: SeriesMetadataInput) {
  if (input.subjectType !== 2) {
    return true;
  }

  const seasonsList = normalizeSeasonsList(input.seasonsList);
  const episodeCount = countEpisodesFromSeasons(seasonsList);

  return Boolean(
    seasonsList?.length &&
      episodeCount &&
      episodeCount >= 1 &&
      input.totalEpisode >= 1 &&
      input.totalSeason >= 1,
  );
}

async function getStoredSeriesEpisodeMetadata(input: SeriesMetadataInput) {
  const stored = await prisma.movie.findUnique({
    where: {
      id: input.id,
    },
    select: {
      seasonsList: true,
      totalEpisode: true,
      totalSeason: true,
    },
  });

  if (
    !stored ||
    !hasCompleteSeriesEpisodeMetadata({
      ...input,
      seasonsList: stored.seasonsList,
      totalEpisode: stored.totalEpisode,
      totalSeason: stored.totalSeason,
    })
  ) {
    return null;
  }

  return {
    seasonsList: normalizeSeasonsList(stored.seasonsList),
    totalEpisode: stored.totalEpisode,
    totalSeason: stored.totalSeason,
  };
}

export async function refreshSeriesEpisodeMetadataIfNeeded(
  input: SeriesMetadataInput,
): Promise<RefreshedSeriesEpisodeMetadata | null> {
  if (hasCompleteSeriesEpisodeMetadata(input)) {
    return null;
  }

  const storedMetadata = await getStoredSeriesEpisodeMetadata(input);

  if (storedMetadata) {
    return storedMetadata;
  }

  if (!input.detailPath) {
    return null;
  }

  const detail = await fetchDetail(input.detailPath, {
    revalidate: 1800,
  }).catch(() => null);
  const seasonsList = normalizeSeasonsList(detail?.seasonsList);

  if (!detail || !seasonsList?.length) {
    return null;
  }

  const totalEpisode = Math.max(
    detail.totalEpisode ?? 1,
    countEpisodesFromSeasons(seasonsList) ?? 1,
  );
  const totalSeason = Math.max(detail.totalSeason ?? 1, seasonsList.length);

  await prisma.movie.update({
    where: {
      id: input.id,
    },
    data: {
      detailSyncedAt: new Date(),
      seasonsList: seasonsList as unknown as Prisma.InputJsonValue,
      totalEpisode,
      totalSeason,
    },
  });

  return {
    seasonsList,
    totalEpisode,
    totalSeason,
  };
}
