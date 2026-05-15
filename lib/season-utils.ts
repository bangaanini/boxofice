export type SeasonInfo = {
  season: number;
  totalEpisodes: number;
  episodes: number[];
};

export type EpisodeGroup = {
  season: number;
  totalEpisodes: number;
  episodes: number[];
};

const MAX_FALLBACK_SEASONS = 30;
const MAX_FALLBACK_EPISODES = 200;

function toSafeInteger(value: unknown, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function toPositiveInteger(value: unknown, fallback: number, max: number) {
  return Math.min(Math.max(toSafeInteger(value, fallback), 1), max);
}

function uniqueSortedNumbers(values: number[]) {
  return Array.from(new Set(values))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.trunc(value))
    .sort((left, right) => left - right);
}

function createRange(length: number) {
  return Array.from({ length }, (_value, index) => index + 1);
}

export function normalizeSeasonsList(value: unknown): SeasonInfo[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const seasons = value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const season = Number(record.season);

      if (!Number.isFinite(season)) {
        return null;
      }

      const episodes = uniqueSortedNumbers(
        Array.isArray(record.episodes)
          ? record.episodes.map((episode) => Number(episode))
          : [],
      );
      const totalEpisodes = toSafeInteger(
        record.totalEpisodes ?? record.total_episodes,
        episodes.length,
      );

      return {
        season: Math.trunc(season),
        totalEpisodes: Math.max(totalEpisodes, episodes.length, 0),
        episodes,
      };
    })
    .filter((entry): entry is SeasonInfo => entry !== null)
    .sort((left, right) => left.season - right.season);

  return seasons.length ? seasons : null;
}

export function getEpisodeNumbers(season: SeasonInfo | EpisodeGroup) {
  if (season.episodes.length) {
    return uniqueSortedNumbers(season.episodes);
  }

  const fallbackLength = toPositiveInteger(
    season.totalEpisodes,
    1,
    MAX_FALLBACK_EPISODES,
  );

  return createRange(fallbackLength);
}

export function countEpisodesFromSeasons(seasonsList: SeasonInfo[] | null) {
  return seasonsList?.reduce(
    (total, season) => total + getEpisodeNumbers(season).length,
    0,
  ) ?? null;
}

export function buildSeriesEpisodeGroups(input: {
  seasonsList?: SeasonInfo[] | null;
  totalEpisode?: number | null;
  totalSeason?: number | null;
}): EpisodeGroup[] {
  if (input.seasonsList?.length) {
    return input.seasonsList.map((season) => ({
      season: season.season,
      totalEpisodes: season.totalEpisodes,
      episodes: getEpisodeNumbers(season),
    }));
  }

  const totalSeason = toPositiveInteger(
    input.totalSeason,
    1,
    MAX_FALLBACK_SEASONS,
  );
  const totalEpisode = toPositiveInteger(
    input.totalEpisode,
    1,
    MAX_FALLBACK_EPISODES,
  );

  return createRange(totalSeason).map((season) => ({
    season,
    totalEpisodes: totalEpisode,
    episodes: createRange(totalEpisode),
  }));
}

export function resolveSeriesEpisode(input: {
  requestedEpisode?: number | string | null;
  requestedSeason?: number | string | null;
  seasonsList?: SeasonInfo[] | null;
  totalEpisode?: number | null;
  totalSeason?: number | null;
}) {
  const groups = buildSeriesEpisodeGroups(input);
  const requestedSeason = toSafeInteger(input.requestedSeason, 1);
  const requestedEpisode = toSafeInteger(input.requestedEpisode, 1);
  const selectedGroup =
    groups.find((group) => group.season === requestedSeason) ?? groups[0];
  const episodes = selectedGroup?.episodes.length
    ? selectedGroup.episodes
    : [1];

  return {
    episode: episodes.includes(requestedEpisode)
      ? requestedEpisode
      : episodes[0],
    groups,
    season: selectedGroup?.season ?? 1,
  };
}
