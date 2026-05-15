import { formatMovieTitle } from "@/lib/movie-title";
import { isBlockedMovieCandidate } from "@/lib/movie-visibility";

const DEFAULT_BASE_URL = "https://indocast.site/api/filmbox";

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return DEFAULT_BASE_URL;
  }

  return trimmed.replace(/\/+$/, "");
}

const BASE_URL = normalizeBaseUrl(process.env.FILMBOX_BASE_URL);
const API_KEY = process.env.FILMBOX_API_KEY?.trim() ?? "";
const API_REQUEST_TIMEOUT_MS = 10000;

type JsonRecord = Record<string, unknown>;

export type NormalizedMovieMetadata = {
  sourceUrl: string;
  detailPath: string;
  subjectId: string;
  subjectType: number;
  title: string;
  thumbnail?: string;
  description?: string;
  duration?: string;
  genre?: string;
  rating?: string;
  quality?: string;
  year?: string;
  releaseDate?: string;
  country?: string;
  bahasa?: string;
  hasIndonesianSubtitle?: boolean;
  totalEpisode?: number;
  totalSeason?: number;
};

export type MovieListResult = {
  page?: number;
  totalPages?: number;
  fetched: number;
  movies: NormalizedMovieMetadata[];
};

export type FilmboxHomeBanner = NormalizedMovieMetadata;

export type FilmboxHomeSection = {
  title: string;
  slug: string;
  position: number;
  items: NormalizedMovieMetadata[];
};

export type FilmboxHomeResult = {
  heroBanners: FilmboxHomeBanner[];
  sections: FilmboxHomeSection[];
};

export type SeasonInfo = {
  season: number;
  totalEpisodes: number;
  episodes: number[];
};

export type MovieDetail = {
  sourceUrl: string;
  detailPath: string;
  subjectId: string;
  subjectType: number;
  title?: string;
  poster?: string;
  synopsis?: string;
  genres: string[];
  releaseDate?: string;
  country?: string;
  bahasa?: string;
  hasIndonesianSubtitle?: boolean;
  rating?: string;
  totalEpisode?: number;
  totalSeason?: number;
  seasonsList: SeasonInfo[];
  trailerUrl?: string;
  raw: JsonRecord;
};

export type FilmboxPlayback = {
  subjectId: string;
  se: number;
  episode: number;
  quality: number | string;
  format: string;
  vidUrl: string | null;
  vidUrlProxy: string | null;
  subUrl: string | null;
};

export class MovieApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "MovieApiError";
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function asInt(value: unknown, fallback: number): number {
  const parsed = asNumber(value);
  return parsed === undefined ? fallback : Math.trunc(parsed);
}

function getString(record: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function buildUpstreamUrl(
  path: string,
  query?: Record<string, string | number | undefined>,
) {
  const url = new URL(`${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function requestJson<T>(
  path: string,
  init?: RequestInit & {
    next?: { revalidate?: number };
    query?: Record<string, string | number | undefined>;
  },
): Promise<T> {
  const { headers, query, ...restInit } = init ?? {};
  let lastError: unknown;
  const requestUrl = buildUpstreamUrl(path, query);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(requestUrl, {
        ...restInit,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "boxofice/1.0",
          "x-api-key": API_KEY,
          ...headers,
        },
        signal: restInit.signal ?? controller.signal,
      });

      if (!response.ok) {
        throw new MovieApiError(
          `Filmbox upstream request failed with ${response.status}`,
          response.status,
        );
      }

      try {
        return (await response.json()) as T;
      } catch {
        throw new MovieApiError(
          "Filmbox upstream returned invalid JSON",
          response.status,
        );
      }
    } catch (error) {
      lastError = error;

      const canRetry =
        !(error instanceof MovieApiError) ||
        typeof error.status !== "number" ||
        error.status >= 500;

      if (!canRetry || attempt === 3) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new MovieApiError("Filmbox upstream request failed");
}

export function slugifyHomeSection(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9À-ɏ\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 96)
    .replace(/^-+|-+$/g, "");
}

function detectIndonesianSubtitle(bahasa: string | undefined) {
  return /\bIndonesian\b/i.test(bahasa ?? "");
}

function deriveYear(record: JsonRecord) {
  const explicit = getString(record, ["year"]);

  if (explicit) {
    return explicit;
  }

  const releaseDate = getString(record, ["releaseDate"]);

  if (releaseDate && releaseDate.length >= 4) {
    return releaseDate.slice(0, 4);
  }

  return undefined;
}

export function normalizeMovieMetadata(
  value: unknown,
): NormalizedMovieMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const detailPath = getString(value, ["detailPath"]);
  const subjectId = getString(value, ["subjectId"]);
  const subjectType = asInt(value.subjectType, 1);
  const title = getString(value, ["title"]);
  const year = deriveYear(value);

  if (!detailPath || !subjectId || !title) {
    return null;
  }

  const ratingValue = value.rating;
  const rating =
    typeof ratingValue === "number" && Number.isFinite(ratingValue)
      ? ratingValue.toString()
      : asString(ratingValue);
  const bahasa = getString(value, ["bahasa"]);
  const normalizedMovie: NormalizedMovieMetadata = {
    sourceUrl: detailPath,
    detailPath,
    subjectId,
    subjectType,
    title: formatMovieTitle(title, { sourceUrl: detailPath, year }),
    thumbnail: getString(value, ["cover_url", "poster", "thumbnail", "image"]),
    description: getString(value, ["description", "synopsis", "overview"]),
    genre: getString(value, ["genre", "genres"]),
    rating,
    year,
    releaseDate: getString(value, ["releaseDate", "release_date"]),
    country: getString(value, ["country"]),
    bahasa,
    hasIndonesianSubtitle: detectIndonesianSubtitle(bahasa),
    totalEpisode: asNumber(value.totalEpisode),
    totalSeason: asNumber(value.totalSeason),
  };

  if (isBlockedMovieCandidate(normalizedMovie)) {
    return null;
  }

  return normalizedMovie;
}

function normalizeMovieList(value: unknown): NormalizedMovieMetadata[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeMovieMetadata(item))
    .filter((item): item is NormalizedMovieMetadata => item !== null);
}

function unwrapData(value: unknown): JsonRecord {
  if (!isRecord(value)) {
    return {};
  }

  return isRecord(value.data) ? value.data : value;
}

export async function fetchFilmboxHome(): Promise<FilmboxHomeResult> {
  const response = await requestJson<unknown>("/home", {
    cache: "no-store",
  });
  const data = unwrapData(response);
  const heroSource = Array.isArray(data.hero_banners) ? data.hero_banners : [];
  const heroBanners = normalizeMovieList(heroSource);
  const sectionSource = Array.isArray(data.content_sections)
    ? data.content_sections
    : [];
  const sections: FilmboxHomeSection[] = [];

  for (const entry of sectionSource) {
    if (!isRecord(entry)) {
      continue;
    }

    const title = getString(entry, ["section_title"]);
    const items = normalizeMovieList(
      Array.isArray(entry.items) ? entry.items : [],
    );

    if (!title || items.length === 0) {
      continue;
    }

    sections.push({
      title,
      slug: slugifyHomeSection(title),
      position: asInt(entry.position, sections.length + 1),
      items,
    });
  }

  return {
    heroBanners,
    sections,
  };
}

export async function fetchTrending(
  page = 0,
  perPage = 18,
): Promise<MovieListResult> {
  const response = await requestJson<unknown>("/trending", {
    cache: "no-store",
    query: { page, perPage },
  });
  const data = unwrapData(response);
  const items = Array.isArray(data.items) ? data.items : [];

  return {
    page,
    totalPages: undefined,
    fetched: items.length,
    movies: normalizeMovieList(items),
  };
}

export async function fetchSearch(
  query: string,
  page = 1,
  perPage = 18,
  subjectType?: number,
): Promise<MovieListResult> {
  const body: Record<string, string> = {
    keyword: query,
    page: String(page),
    perPage: String(perPage),
  };

  if (subjectType !== undefined) {
    body.subjectType = String(subjectType);
  }

  const response = await requestJson<unknown>("/search", {
    body: JSON.stringify(body),
    cache: "no-store",
    method: "POST",
  });
  const data = unwrapData(response);
  const items = Array.isArray(data.items) ? data.items : [];

  return {
    page,
    fetched: items.length,
    movies: normalizeMovieList(items),
  };
}

export async function fetchDetail(
  detailPath: string,
  options: { revalidate?: number } = {},
): Promise<MovieDetail> {
  const response = await requestJson<unknown>("/details", {
    next: {
      revalidate: options.revalidate ?? 3600,
    },
    query: { detailPath },
  });
  const data = unwrapData(response);
  const subjectId = getString(data, ["subjectId"]) ?? "";
  const subjectType = asInt(data.subjectType, 1);
  const resolvedDetailPath = getString(data, ["detailPath"]) ?? detailPath;
  const title = getString(data, ["title"]);
  const year = deriveYear(data);
  const seasonsRaw = Array.isArray(data.seasons_list) ? data.seasons_list : [];
  const seasonsList: SeasonInfo[] = seasonsRaw
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const episodes = Array.isArray(entry.episodes)
        ? entry.episodes
            .map((value) => asNumber(value))
            .filter((value): value is number => typeof value === "number")
        : [];

      return {
        season: asInt(entry.season, 1),
        totalEpisodes: asInt(entry.total_episodes, episodes.length),
        episodes,
      };
    })
    .filter((value): value is SeasonInfo => value !== null);
  const bahasa = getString(data, ["bahasa"]);
  const ratingValue = data.rating;
  const rating =
    typeof ratingValue === "number" && Number.isFinite(ratingValue)
      ? ratingValue.toString()
      : asString(ratingValue);

  return {
    sourceUrl: resolvedDetailPath,
    detailPath: resolvedDetailPath,
    subjectId,
    subjectType,
    title: title
      ? formatMovieTitle(title, { sourceUrl: resolvedDetailPath, year })
      : undefined,
    poster: getString(data, ["cover_url", "poster", "thumbnail"]),
    synopsis: getString(data, ["description", "synopsis", "overview"]),
    genres: (getString(data, ["genre"]) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    releaseDate: getString(data, ["releaseDate", "release_date"]),
    country: getString(data, ["country"]),
    bahasa,
    hasIndonesianSubtitle: detectIndonesianSubtitle(bahasa),
    rating,
    totalEpisode: asNumber(data.totalEpisode),
    totalSeason: asNumber(data.totalSeason),
    seasonsList,
    trailerUrl: getString(data, ["trailer_url", "trailerUrl"]),
    raw: data,
  };
}

export async function fetchGetPlay(input: {
  subjectId: string;
  detailPath: string;
  se?: number;
  ep?: number;
  lang?: string;
}): Promise<FilmboxPlayback> {
  const response = await requestJson<unknown>("/getplay", {
    cache: "no-store",
    query: {
      subjectId: input.subjectId,
      detailPath: input.detailPath,
      se: input.se ?? 0,
      ep: input.ep ?? 0,
      lang: input.lang ?? "in_id",
    },
  });
  const data = unwrapData(response);

  return {
    subjectId: getString(data, ["subjectId"]) ?? input.subjectId,
    se: asInt(data.se, input.se ?? 0),
    episode: asInt(data.episode, input.ep ?? 0),
    quality: asNumber(data.quality) ?? getString(data, ["quality"]) ?? "auto",
    format: getString(data, ["format"]) ?? "MP4",
    vidUrl: getString(data, ["vid_url"]) ?? null,
    vidUrlProxy: getString(data, ["vid_url_proxy"]) ?? null,
    subUrl: getString(data, ["sub_url"]) ?? null,
  };
}
