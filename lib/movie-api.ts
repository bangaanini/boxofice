const BASE_URL = "https://api.sonzaix.indevs.in";

type JsonRecord = Record<string, unknown>;
const API_REQUEST_TIMEOUT_MS = 10000;
const MEDIA_PROBE_TIMEOUT_MS = 8000;

export type NormalizedMovieMetadata = {
  sourceUrl: string;
  title: string;
  thumbnail?: string;
  description?: string;
  duration?: string;
  genre?: string;
  rating?: string;
  quality?: string;
  year?: string;
};

export type MovieListResult = {
  page?: number;
  totalPages?: number;
  fetched: number;
  movies: NormalizedMovieMetadata[];
};

export type StreamSource = {
  url: string;
  label: string;
  quality?: string;
  type?: string;
};

export type SanitizedStreamResponse = {
  originalUrl: string;
  iframe?: string;
  m3u8?: string;
  sources: StreamSource[];
  resolvedFrom?: string;
};

export type MovieDetail = {
  sourceUrl: string;
  title?: string;
  poster?: string;
  synopsis?: string;
  genres: string[];
  releaseDate?: string;
  actors: string[];
  directors: string[];
  streams?: string;
  raw: JsonRecord;
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

function getString(record: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function getArray(record: JsonRecord, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function getStringArray(record: JsonRecord, keys: string[]): string[] {
  return getArray(record, keys)
    .map((value) => asString(value))
    .filter((value): value is string => Boolean(value));
}

function getStringList(record: JsonRecord, keys: string[]): string[] {
  const arrayValue = getStringArray(record, keys);

  if (arrayValue.length > 0) {
    return arrayValue;
  }

  const stringValue = getString(record, keys);

  if (!stringValue) {
    return [];
  }

  return stringValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanSynopsis(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const markers = ["Share Save", "DOWNLOAD Share Save"];
  let cleaned = value;

  for (const marker of markers) {
    const index = cleaned.indexOf(marker);
    if (index >= 0) {
      cleaned = cleaned.slice(index + marker.length);
      break;
    }
  }

  cleaned = cleaned
    .replace(/\s*Subtitle:\s*.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 40) {
    return value.replace(/\s+/g, " ").trim();
  }

  return cleaned;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit & { next?: { revalidate?: number } },
): Promise<T> {
  const { headers, ...restInit } = init ?? {};
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        ...restInit,
        headers: {
          Accept: "application/json",
          "User-Agent": "boxofice/1.0",
          ...headers,
        },
        signal: restInit.signal ?? controller.signal,
      });

      if (!response.ok) {
        throw new MovieApiError(
          `LK21 upstream request failed with ${response.status}`,
          response.status,
        );
      }

      try {
        return (await response.json()) as T;
      } catch {
        throw new MovieApiError(
          "LK21 upstream returned invalid JSON",
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
    : new MovieApiError("LK21 upstream request failed");
}

export function normalizeMovieMetadata(
  value: unknown,
): NormalizedMovieMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const sourceUrl = getString(value, ["sourceUrl", "url", "source", "slug"]);
  const title = getString(value, ["title", "name"]);

  if (!sourceUrl || !title) {
    return null;
  }

  return {
    sourceUrl,
    title,
    thumbnail: getString(value, ["thumbnail", "poster", "image", "cover"]),
    description: getString(value, ["description", "synopsis", "overview"]),
    duration: getString(value, ["duration", "runtime"]),
    genre: getString(value, ["genre", "genres"]),
    rating: getString(value, ["rating", "imdbRating", "score"]),
    quality: getString(value, ["quality", "resolution"]),
    year: getString(value, ["year", "releaseYear"]),
  };
}

function normalizeMovieListResponse(value: unknown): MovieListResult {
  const root = isRecord(value) ? value : {};
  const data = isRecord(root.data) ? root.data : root;
  const candidates = getArray(data, ["movies", "items", "results", "data"]);
  const movies = candidates
    .map((movie) => normalizeMovieMetadata(movie))
    .filter((movie): movie is NormalizedMovieMetadata => movie !== null);

  return {
    page: asNumber(data.page),
    totalPages: asNumber(data.totalPages),
    fetched: candidates.length,
    movies,
  };
}

function sourceTypeFromUrl(url: string): string | undefined {
  const lowered = url.split("?")[0]?.toLowerCase() ?? "";
  const decoded = decodeURIComponent(url).toLowerCase();

  if (lowered.endsWith(".m3u8") || decoded.includes(".m3u8")) {
    return "application/x-mpegURL";
  }

  if (lowered.endsWith(".mp4")) {
    return "video/mp4";
  }

  if (lowered.endsWith(".webm")) {
    return "video/webm";
  }

  return undefined;
}

function normalizeSourceCandidate(
  value: unknown,
): StreamSource | null {
  if (typeof value === "string") {
    const url = asString(value);
    return url
      ? {
          url,
          label: sourceTypeFromUrl(url) === "application/x-mpegURL" ? "Auto" : "Source",
          type: sourceTypeFromUrl(url),
        }
      : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const url = getString(value, ["url", "file", "src", "source", "link", "playUrl"]);

  if (!url) {
    return null;
  }

  const quality = getString(value, ["quality", "resolution", "label", "name"]);
  const type = getString(value, ["type", "mimeType"]) ?? sourceTypeFromUrl(url);

  return {
    url,
    label: quality ?? (type === "application/x-mpegURL" ? "Auto" : "Source"),
    quality,
    type,
  };
}

function normalizeStreamSources(data: JsonRecord): StreamSource[] {
  const sources: StreamSource[] = [];
  const m3u8 = data.m3u8;

  if (typeof m3u8 === "string") {
    const source = normalizeSourceCandidate(m3u8);
    if (source) {
      sources.push({ ...source, label: source.quality ?? "Auto" });
    }
  } else if (Array.isArray(m3u8)) {
    sources.push(
      ...m3u8
        .map((candidate) => normalizeSourceCandidate(candidate))
        .filter((source): source is StreamSource => source !== null),
    );
  }

  for (const key of ["sources", "files", "qualities", "resolutions", "videos"]) {
    const candidates = data[key];
    if (!Array.isArray(candidates)) {
      continue;
    }

    sources.push(
      ...candidates
        .map((candidate) => normalizeSourceCandidate(candidate))
        .filter((source): source is StreamSource => source !== null),
    );
  }

  const unique = new Map<string, StreamSource>();
  for (const source of sources) {
    unique.set(source.url, source);
  }

  const normalizedSources = Array.from(unique.values());

  return normalizedSources.sort((left, right) => {
    if (left.label === "Auto" && right.label !== "Auto") {
      return -1;
    }

    if (left.label !== "Auto" && right.label === "Auto") {
      return 1;
    }

    return 0;
  });
}

function normalizeStreamResponse(
  value: unknown,
  fallbackSourceUrl: string,
): SanitizedStreamResponse {
  const root = isRecord(value) ? value : {};
  const data = isRecord(root.data) ? root.data : root;

  return {
    originalUrl: getString(data, ["originalUrl", "sourceUrl", "url"]) ?? fallbackSourceUrl,
    iframe: getString(data, ["iframe", "embed", "embedUrl", "player"]),
    m3u8: typeof data.m3u8 === "string" ? data.m3u8 : undefined,
    sources: normalizeStreamSources(data),
  };
}

function isLikelyBadMediaContentType(contentType: string) {
  const lowered = contentType.toLowerCase();

  return (
    lowered.includes("text/html") ||
    lowered.includes("application/json") ||
    lowered.includes("image/")
  );
}

function looksLikeImageBytes(bytes: Uint8Array) {
  if (bytes.length < 12) {
    return false;
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47];
  const gifSignature = [0x47, 0x49, 0x46, 0x38];

  return (
    pngSignature.every((byte, index) => bytes[index] === byte) ||
    gifSignature.every((byte, index) => bytes[index] === byte) ||
    (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50)
  );
}

async function fetchForMediaProbe(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MEDIA_PROBE_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      headers: {
        Accept: "*/*",
        "User-Agent": "Mozilla/5.0 Boxofice/1.0",
        ...init.headers,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function firstPlaylistMediaUrl(playlist: string, playlistUrl: string) {
  for (const line of playlist.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    return new URL(trimmed, playlistUrl).toString();
  }

  return null;
}

async function isPlayableMediaUrl(url: string, depth = 0): Promise<boolean> {
  if (depth > 2) {
    return false;
  }

  const isPlaylist = sourceTypeFromUrl(url) === "application/x-mpegURL";
  const response = await fetchForMediaProbe(url);
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok || isLikelyBadMediaContentType(contentType)) {
    return false;
  }

  if (isPlaylist || contentType.toLowerCase().includes("mpegurl")) {
    const playlist = await response.text();

    if (!playlist.includes("#EXTM3U")) {
      return false;
    }

    const firstMediaUrl = firstPlaylistMediaUrl(playlist, url);

    if (!firstMediaUrl) {
      return false;
    }

    return isPlayableMediaUrl(firstMediaUrl, depth + 1);
  }

  if (
    contentType.toLowerCase().startsWith("video/") ||
    contentType.toLowerCase().includes("octet-stream")
  ) {
    await response.body?.cancel().catch(() => undefined);
    return true;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  return bytes.length > 0 && !looksLikeImageBytes(bytes);
}

async function filterPlayableSources(sources: StreamSource[]) {
  const checkedSources = await Promise.all(
    sources.map(async (source) => {
      try {
        return (await isPlayableMediaUrl(source.url)) ? source : null;
      } catch {
        return null;
      }
    }),
  );

  return checkedSources.filter(
    (source): source is StreamSource => source !== null,
  );
}

function shouldResolveDetailBeforeStream(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);

    return url.hostname.includes("lk21official");
  } catch {
    return false;
  }
}

export async function fetchHome(page = 1): Promise<MovieListResult> {
  const response = await requestJson<unknown>(`/lk21/home?page=${page}`);
  return normalizeMovieListResponse(response);
}

export async function fetchPopular(page = 1): Promise<MovieListResult> {
  const response = await requestJson<unknown>(`/lk21/populer?page=${page}`);
  return normalizeMovieListResponse(response);
}

export async function fetchNew(page = 1): Promise<MovieListResult> {
  const response = await requestJson<unknown>(`/lk21/new?page=${page}`);
  return normalizeMovieListResponse(response);
}

export async function fetchSearch(
  query: string,
  page = 1,
): Promise<MovieListResult> {
  const response = await requestJson<unknown>(
    `/lk21/search?q=${encodeURIComponent(query)}&page=${page}`,
    {
      cache: "no-store",
    },
  );

  return normalizeMovieListResponse(response);
}

export async function fetchDetail(
  sourceUrl: string,
  options: { revalidate?: number } = {},
): Promise<MovieDetail> {
  const response = await requestJson<unknown>(
    `/lk21/detail?url=${encodeURIComponent(sourceUrl)}`,
    {
      next: {
        revalidate: options.revalidate ?? 3600,
      },
    },
  );
  const root = isRecord(response) ? response : {};
  const data = isRecord(root.data) ? root.data : root;

  return {
    sourceUrl: getString(data, ["source", "sourceUrl", "url"]) ?? sourceUrl,
    title: getString(data, ["title", "name"]),
    poster: getString(data, ["poster", "thumbnail", "image"]),
    synopsis: cleanSynopsis(getString(data, ["synopsis", "description", "overview"])),
    genres: getStringList(data, ["genres", "genre"]),
    releaseDate: getString(data, ["releaseDate", "released", "date"]),
    actors: getStringArray(data, ["actors", "cast", "stars"]),
    directors: getStringArray(data, ["directors", "director"]),
    streams: getString(data, ["streams", "iframe", "player"]),
    raw: data,
  };
}

export async function fetchStream(
  sourceUrl: string,
  options: { revalidate?: number } = {},
): Promise<SanitizedStreamResponse> {
  const response = await requestJson<unknown>(
    `/lk21/stream?url=${encodeURIComponent(sourceUrl)}`,
    {
      next: {
        revalidate: options.revalidate ?? 3600,
      },
    },
  );

  return normalizeStreamResponse(response, sourceUrl);
}

export async function fetchPlayableStream(
  sourceUrl: string,
  options: { revalidate?: number } = {},
): Promise<SanitizedStreamResponse> {
  let initialStream: SanitizedStreamResponse | null = null;
  let initialError: unknown;

  if (!shouldResolveDetailBeforeStream(sourceUrl)) {
    try {
      initialStream = await fetchStream(sourceUrl, options);
    } catch (error) {
      initialError = error;
    }
  }

  if (initialStream && initialStream.sources.length > 0) {
    const playableSources = await filterPlayableSources(initialStream.sources);

    if (playableSources.length > 0) {
      return {
        ...initialStream,
        sources: playableSources,
        resolvedFrom: sourceUrl,
      };
    }
  }

  const detail = await fetchDetail(sourceUrl);

  if (!detail.streams || detail.streams === sourceUrl) {
    if (initialStream) {
      return {
        ...initialStream,
        resolvedFrom: sourceUrl,
      };
    }

    throw initialError instanceof Error
      ? initialError
      : new MovieApiError("LK21 stream source is unavailable");
  }

  const playerStream = await fetchStream(detail.streams, options);

  if (playerStream.sources.length === 0) {
    return initialStream
      ? {
          ...initialStream,
          resolvedFrom: sourceUrl,
        }
      : {
          ...playerStream,
          resolvedFrom: detail.streams,
        };
  }

  const playableSources = await filterPlayableSources(playerStream.sources);

  if (playableSources.length === 0) {
    return {
      ...playerStream,
      sources: [],
      resolvedFrom: detail.streams,
    };
  }

  return {
    ...playerStream,
    sources: playableSources,
    resolvedFrom: detail.streams,
  };
}
