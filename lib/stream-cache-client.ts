"use client";

export type CachedStreamSource = {
  url: string;
  label: string;
  quality?: string;
  type?: string;
};

export type CachedStreamResponse = {
  iframe?: string;
  m3u8?: string;
  originalUrl?: string;
  resolvedFrom?: string;
  sources: CachedStreamSource[];
};

type StreamCacheEntry = {
  expiresAt: number;
  value: CachedStreamResponse;
};

const STREAM_CACHE_TTL_MS = 10 * 60 * 1000;
const STREAM_CACHE_PREFIX = "boxofice:stream:v3:";
const memoryCache = new Map<string, StreamCacheEntry>();

type StreamLookup = {
  cacheKey: string;
  movieId?: string;
  sourceUrl?: string;
};

function storageKey(key: string) {
  return `${STREAM_CACHE_PREFIX}${key}`;
}

function isCacheEntryValid(
  entry: StreamCacheEntry | null | undefined,
): entry is StreamCacheEntry {
  return Boolean(
    entry &&
      entry.expiresAt > Date.now() &&
      entry.value.sources.length,
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

export function getMovieStreamCacheKey(movieId: string) {
  return `movie:${movieId}`;
}

export function getSourceStreamCacheKey(sourceUrl: string) {
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

  const entry = {
    expiresAt: Date.now() + ttlMs,
    value,
  };

  memoryCache.set(key, entry);
  writeSessionCache(key, entry);
}

export async function prefetchCachedStream(lookup: StreamLookup) {
  const cached = readCachedStream(lookup.cacheKey);

  if (cached) {
    return cached;
  }

  const params = new URLSearchParams();

  if (lookup.sourceUrl) {
    params.set("sourceUrl", lookup.sourceUrl);
  } else if (lookup.movieId) {
    params.set("id", lookup.movieId);
  } else {
    throw new Error("Sumber video belum valid.");
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
