"use client";

export type CachedStreamSource = {
  url: string;
  label: string;
  quality?: string;
  type?: string;
};

export type CachedStreamSubtitle = {
  src: string;
  lang: string;
  label: string;
  default?: boolean;
};

export type CachedStreamResponse = {
  accessToken?: string;
  accessTokenExpiresAt?: string;
  authenticated?: boolean;
  episode?: number;
  format?: string;
  ownerPlaybackAccess?: boolean;
  paywallDescription?: string;
  paywallTitle?: string;
  previewLimitSeconds?: number;
  season?: number;
  sources: CachedStreamSource[];
  subtitles?: CachedStreamSubtitle[];
  upgradeLabel?: string;
  upgradeUrl?: string;
  vipActive?: boolean;
  vipExpiresAt?: string | null;
};

type StreamCacheEntry = {
  expiresAt: number;
  value: CachedStreamResponse;
};

const STREAM_CACHE_TTL_MS = 10 * 60 * 1000;
const STREAM_CACHE_PREFIX = "boxofice:stream:v6:";
const memoryCache = new Map<string, StreamCacheEntry>();

type StreamLookup = {
  cacheKey: string;
  movieId?: string;
  sourceUrl?: string;
  detailPath?: string;
  season?: number;
  episode?: number;
};

function storageKey(key: string) {
  return `${STREAM_CACHE_PREFIX}${key}`;
}

function isCacheEntryValid(
  entry: StreamCacheEntry | null | undefined,
): entry is StreamCacheEntry {
  return Boolean(
    entry && entry.expiresAt > Date.now() && entry.value.sources.length,
  );
}

function readSessionCache(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey(key));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StreamCacheEntry;

    if (!isCacheEntryValid(parsed)) {
      window.sessionStorage.removeItem(storageKey(key));
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCache(key: string, entry: StreamCacheEntry) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // Ignore storage errors; memory cache still helps within this tab session.
  }
}

export function getMovieStreamCacheKey(
  movieId: string,
  season?: number,
  episode?: number,
  scope: "guest" | "user" = "user",
) {
  if (season && episode) {
    return `movie:${scope}:${movieId}:s${season}:e${episode}`;
  }

  return `movie:${scope}:${movieId}`;
}

export function getSourceStreamCacheKey(
  sourceUrl: string,
  season?: number,
  episode?: number,
) {
  if (season && episode) {
    return `source:${sourceUrl}:s${season}:e${episode}`;
  }

  return `source:${sourceUrl}`;
}

export function readCachedStream(key: string) {
  const memoryEntry = memoryCache.get(key);

  if (isCacheEntryValid(memoryEntry)) {
    return memoryEntry.value;
  }

  const sessionEntry = readSessionCache(key);

  if (sessionEntry) {
    memoryCache.set(key, sessionEntry);
    return sessionEntry.value;
  }

  return null;
}

export function writeCachedStream(
  key: string,
  value: CachedStreamResponse,
  ttlMs = STREAM_CACHE_TTL_MS,
) {
  if (!value.sources.length) {
    return;
  }

  if (value.authenticated === false) {
    return;
  }

  const tokenExpiry = value.accessTokenExpiresAt
    ? new Date(value.accessTokenExpiresAt).getTime()
    : Number.NaN;
  const safeTtl = Number.isFinite(tokenExpiry)
    ? Math.max(15_000, Math.min(ttlMs, tokenExpiry - Date.now() - 5_000))
    : ttlMs;
  const entry = {
    expiresAt: Date.now() + safeTtl,
    value,
  };

  memoryCache.set(key, entry);
  writeSessionCache(key, entry);
}

export function clearCachedStream(key: string) {
  memoryCache.delete(key);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(storageKey(key));
  } catch {
    // Ignore storage errors.
  }
}

export async function prefetchCachedStream(lookup: StreamLookup) {
  const cached = readCachedStream(lookup.cacheKey);

  if (cached) {
    return cached;
  }

  const params = new URLSearchParams();

  if (lookup.detailPath) {
    params.set("detailPath", lookup.detailPath);
  } else if (lookup.sourceUrl) {
    params.set("sourceUrl", lookup.sourceUrl);
  } else if (lookup.movieId) {
    params.set("id", lookup.movieId);
  } else {
    throw new Error("Sumber video belum valid.");
  }

  if (lookup.season !== undefined && lookup.season > 0) {
    params.set("se", String(lookup.season));
  }
  if (lookup.episode !== undefined && lookup.episode > 0) {
    params.set("ep", String(lookup.episode));
  }

  const response = await fetch(`/api/stream?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Video belum bisa dibuka (${response.status}).`);
  }

  const payload = (await response.json()) as CachedStreamResponse;

  if (!payload.sources.length) {
    throw new Error("Sumber video belum tersedia.");
  }

  writeCachedStream(lookup.cacheKey, payload);

  return payload;
}
