"use client";

export type CachedStreamSource = {
  url: string;
  label: string;
  quality?: string;
  type?: string;
};

export type CachedStreamResponse = {
  originalUrl?: string;
  resolvedFrom?: string;
  sources: CachedStreamSource[];
};

type StreamCacheEntry = {
  expiresAt: number;
  value: CachedStreamResponse;
};

const STREAM_CACHE_TTL_MS = 10 * 60 * 1000;
const STREAM_CACHE_PREFIX = "boxofice:stream:";
const memoryCache = new Map<string, StreamCacheEntry>();

function cacheKey(movieId: string) {
  return `${STREAM_CACHE_PREFIX}${movieId}`;
}

function isCacheEntryValid(
  entry: StreamCacheEntry | null | undefined,
): entry is StreamCacheEntry {
  return Boolean(entry && entry.expiresAt > Date.now() && entry.value.sources.length);
}

function readSessionCache(movieId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(cacheKey(movieId));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StreamCacheEntry;

    if (!isCacheEntryValid(parsed)) {
      window.sessionStorage.removeItem(cacheKey(movieId));
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCache(movieId: string, entry: StreamCacheEntry) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(cacheKey(movieId), JSON.stringify(entry));
  } catch {
    // Ignore storage errors; memory cache still helps within this tab session.
  }
}

export function readCachedStream(movieId: string) {
  const memoryEntry = memoryCache.get(movieId);

  if (isCacheEntryValid(memoryEntry)) {
    return memoryEntry.value;
  }

  const sessionEntry = readSessionCache(movieId);

  if (sessionEntry) {
    memoryCache.set(movieId, sessionEntry);
    return sessionEntry.value;
  }

  return null;
}

export function writeCachedStream(
  movieId: string,
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

  memoryCache.set(movieId, entry);
  writeSessionCache(movieId, entry);
}

export async function prefetchCachedStream(movieId: string) {
  const cached = readCachedStream(movieId);

  if (cached) {
    return cached;
  }

  const response = await fetch(`/api/stream?id=${encodeURIComponent(movieId)}`);

  if (!response.ok) {
    throw new Error(`Player request failed with ${response.status}`);
  }

  const payload = (await response.json()) as CachedStreamResponse;

  if (!payload.sources.length) {
    throw new Error("No playable HLS source was returned.");
  }

  writeCachedStream(movieId, payload);

  return payload;
}
