"use client";

import * as React from "react";
import { RotateCcw, RotateCw } from "lucide-react";
import type Hls from "hls.js";

import { Button } from "@/components/ui/button";
import {
  getMovieStreamCacheKey,
  getSourceStreamCacheKey,
  prefetchCachedStream,
  readCachedStream,
  type CachedStreamResponse,
  type CachedStreamSource,
} from "@/lib/stream-cache-client";
import { cn } from "@/lib/utils";

type WatchPlayerProps = {
  autoPlay?: boolean;
  defaultQuality?: string;
  initialProgressSeconds?: number;
  movieId?: string;
  poster?: string | null;
  sourceUrl?: string;
};

type SeekFeedback = {
  direction: "backward" | "forward";
  key: number;
};

type OrientationLockValue =
  | "any"
  | "landscape"
  | "landscape-primary"
  | "landscape-secondary"
  | "natural"
  | "portrait"
  | "portrait-primary"
  | "portrait-secondary";

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: OrientationLockValue) => Promise<void>;
};

function isHlsSource(source: CachedStreamSource) {
  return (
    source.type === "application/x-mpegURL" ||
    decodeURIComponent(source.url).toLowerCase().includes(".m3u8")
  );
}

function toMediaSourceUrl(source: CachedStreamSource) {
  return `/api/hls?url=${encodeURIComponent(source.url)}`;
}

function normalizeQuality(value: string | undefined) {
  return value?.toLowerCase().replace(/\s+/g, "").replace(/p$/, "");
}

function chooseDefaultSource(
  sources: CachedStreamSource[],
  defaultQuality: string | undefined,
) {
  if (!sources.length) {
    return null;
  }

  const preferredQuality = normalizeQuality(defaultQuality);

  if (preferredQuality) {
    const preferredSource = sources.find((source) => {
      const label = normalizeQuality(source.label);
      const quality = normalizeQuality(source.quality);

      return (
        label === preferredQuality ||
        quality === preferredQuality ||
        label?.includes(preferredQuality) ||
        quality?.includes(preferredQuality)
      );
    });

    if (preferredSource) {
      return preferredSource;
    }
  }

  return sources[0];
}

async function lockLandscapeIfPossible() {
  const orientation = screen.orientation as ScreenOrientationWithLock | undefined;

  if (!orientation?.lock) {
    return;
  }

  await orientation.lock("landscape").catch(() => undefined);
}

function unlockOrientationIfPossible() {
  screen.orientation?.unlock?.();
}

export function WatchPlayer({
  autoPlay = false,
  defaultQuality,
  initialProgressSeconds = 0,
  movieId,
  poster,
  sourceUrl,
}: WatchPlayerProps) {
  const streamCacheKey = React.useMemo(() => {
    if (sourceUrl) {
      return getSourceStreamCacheKey(sourceUrl);
    }

    return movieId ? getMovieStreamCacheKey(movieId) : null;
  }, [movieId, sourceUrl]);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const hlsRef = React.useRef<Hls | null>(null);
  const lastTapRef = React.useRef<{ time: number; x: number } | null>(null);
  const resumeSnapshotRef = React.useRef<{
    time: number;
    shouldPlay: boolean;
  } | null>(null);
  const initialResumeAppliedRef = React.useRef(false);
  const lastProgressReportRef = React.useRef(0);
  const [stream, setStream] = React.useState<CachedStreamResponse | null>(() =>
    streamCacheKey ? readCachedStream(streamCacheKey) : null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [selectedSourceUrl, setSelectedSourceUrl] = React.useState<string | null>(
    streamCacheKey
      ? chooseDefaultSource(
          readCachedStream(streamCacheKey)?.sources ?? [],
          defaultQuality,
        )?.url ?? null
      : null,
  );
  const [seekFeedback, setSeekFeedback] = React.useState<SeekFeedback | null>(
    null,
  );
  const [failedSourceUrls, setFailedSourceUrls] = React.useState<string[]>([]);
  const [retryCount, setRetryCount] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadStream() {
      setError(null);
      setFailedSourceUrls([]);

      if (!streamCacheKey || (!movieId && !sourceUrl)) {
        setError("Sumber video belum valid.");
        return;
      }

      const cached = readCachedStream(streamCacheKey);

      if (cached) {
        setStream(cached);
        setSelectedSourceUrl(
          (current) =>
            current ??
            chooseDefaultSource(cached.sources, defaultQuality)?.url ??
            null,
        );
        return;
      }

      setStream(null);

      try {
        const payload = await prefetchCachedStream({
          cacheKey: streamCacheKey,
          movieId,
          sourceUrl,
        });

        if (controller.signal.aborted) {
          return;
        }

        setStream(payload);
        setSelectedSourceUrl(
          chooseDefaultSource(payload.sources, defaultQuality)?.url ?? null,
        );
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Pemutar belum bisa dibuka sekarang.",
        );
      }
    }

    loadStream();

    return () => {
      controller.abort();
    };
  }, [defaultQuality, movieId, retryCount, sourceUrl, streamCacheKey]);

  const sources = React.useMemo(() => stream?.sources ?? [], [stream]);
  const selectedSource =
    sources.find((source) => source.url === selectedSourceUrl) ??
    chooseDefaultSource(sources, defaultQuality) ??
    null;

  const moveToNextPlayableSource = React.useCallback(
    (failedUrl: string) => {
      const nextFailedUrls = Array.from(new Set([...failedSourceUrls, failedUrl]));
      const nextSource = sources.find(
        (source) => !nextFailedUrls.includes(source.url),
      );

      setFailedSourceUrls(nextFailedUrls);

      if (nextSource) {
        setSelectedSourceUrl(nextSource.url);
        return;
      }

      setError(
        "Sumber video langsung dari upstream belum bisa diputar di pemutar ini.",
      );
    },
    [failedSourceUrls, sources],
  );

  React.useEffect(() => {
    if (!videoRef.current || !sources.length || !selectedSource) {
      return;
    }

    const video = videoRef.current;
    const activeSource = selectedSource;
    let disposed = false;
    let hls: Hls | null = null;
    const resumeSnapshot =
      resumeSnapshotRef.current ??
      (!initialResumeAppliedRef.current
        ? {
            shouldPlay: autoPlay,
            time: initialProgressSeconds > 3 ? initialProgressSeconds : 0,
          }
        : null);
    resumeSnapshotRef.current = null;
    initialResumeAppliedRef.current = true;
    const mediaUrl = toMediaSourceUrl(activeSource);

    function resumePlayback() {
      if (!resumeSnapshot || disposed) {
        return;
      }

      if (resumeSnapshot.time > 1) {
        video.currentTime = resumeSnapshot.time;
      }

      if (resumeSnapshot.shouldPlay) {
        void video.play().catch(() => undefined);
      }
    }

    function handleNativeError() {
      if (!disposed) {
        moveToNextPlayableSource(activeSource.url);
      }
    }

    async function setupPlayer() {
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.poster = poster ?? "";
      video.addEventListener("error", handleNativeError);

      if (!isHlsSource(activeSource)) {
        video.src = mediaUrl;
        video.addEventListener("loadedmetadata", resumePlayback, { once: true });
        video.load();
        return;
      }

      const { default: Hls } = await import("hls.js");

      if (disposed) {
        return;
      }

      if (Hls.isSupported()) {
        hls = new Hls({
          backBufferLength: 60,
          enableWorker: true,
          maxBufferLength: 45,
        });
        hlsRef.current = hls;
        hls.attachMedia(video);
        hls.loadSource(mediaUrl);
        hls.on(Hls.Events.MANIFEST_PARSED, resumePlayback);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            hls?.destroy();
            hlsRef.current = null;
            moveToNextPlayableSource(activeSource.url);
          }
        });
        return;
      }

      if (
        video.canPlayType("application/vnd.apple.mpegurl") ||
        video.canPlayType("application/x-mpegURL")
      ) {
        video.src = mediaUrl;
        video.addEventListener("loadedmetadata", resumePlayback, { once: true });
        video.load();
        return;
      }

      moveToNextPlayableSource(activeSource.url);
    }

    void setupPlayer();

    return () => {
      disposed = true;
      video.removeEventListener("error", handleNativeError);
      hls?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
      unlockOrientationIfPossible();
    };
  }, [
    autoPlay,
    defaultQuality,
    initialProgressSeconds,
    moveToNextPlayableSource,
    poster,
    selectedSource,
    sources,
  ]);

  React.useEffect(() => {
    const video = videoRef.current;

    if (!video || !movieId) {
      return;
    }

    const currentVideo = video;

    function reportProgress(force = false) {
      const progressSeconds = Math.trunc(currentVideo.currentTime || 0);
      const duration = Number.isFinite(currentVideo.duration)
        ? Math.trunc(currentVideo.duration)
        : 0;
      const now = Date.now();

      if (!force && now - lastProgressReportRef.current < 5000) {
        return;
      }

      if (!force && progressSeconds < 5) {
        return;
      }

      lastProgressReportRef.current = now;

      const payload = JSON.stringify({
        completed: currentVideo.ended,
        durationSeconds: duration,
        movieId,
        progressSeconds,
      });

      if (force && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/watch-history",
          new Blob([payload], { type: "application/json" }),
        );
        return;
      }

      void fetch("/api/watch-history", {
        body: payload,
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: force,
        method: "POST",
      }).catch(() => undefined);
    }

    const handleTimeUpdate = () => reportProgress(false);
    const handlePause = () => reportProgress(true);
    const handleEnded = () => reportProgress(true);
    const handlePageHide = () => reportProgress(true);
    const progressIntervalId = window.setInterval(
      () => reportProgress(false),
      5000,
    );

    currentVideo.addEventListener("timeupdate", handleTimeUpdate);
    currentVideo.addEventListener("pause", handlePause);
    currentVideo.addEventListener("ended", handleEnded);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      reportProgress(true);
      window.clearInterval(progressIntervalId);
      currentVideo.removeEventListener("timeupdate", handleTimeUpdate);
      currentVideo.removeEventListener("pause", handlePause);
      currentVideo.removeEventListener("ended", handleEnded);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [movieId, sources.length]);

  React.useEffect(() => {
    function handleFullscreenChange() {
      if (document.fullscreenElement === videoRef.current) {
        void lockLandscapeIfPossible();
        return;
      }

      unlockOrientationIfPossible();
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      unlockOrientationIfPossible();
    };
  }, []);

  React.useEffect(() => {
    if (!seekFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => setSeekFeedback(null), 650);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [seekFeedback]);

  function seekBy(seconds: number) {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const currentTime = video.currentTime;
    const duration = video.duration;
    const maxTime =
      typeof duration === "number" && Number.isFinite(duration)
        ? Math.max(duration - 1, 0)
        : Infinity;
    const nextTime = Math.max(
      0,
      Math.min(currentTime + seconds, maxTime),
    );

    video.currentTime = nextTime;
    setSeekFeedback({
      direction: seconds < 0 ? "backward" : "forward",
      key: Date.now(),
    });
  }

  function handlePointerDoubleTap(clientX: number, width: number) {
    const isLeftSide = clientX < width / 2;
    seekBy(isLeftSide ? -10 : 10);
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;

    if (target.closest("button")) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    handlePointerDoubleTap(event.clientX - bounds.left, bounds.width);
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;

    if (target.closest("button")) {
      return;
    }

    const touch = event.changedTouches[0];

    if (!touch) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = touch.clientX - bounds.left;
    const now = Date.now();
    const lastTap = lastTapRef.current;

    if (lastTap && now - lastTap.time < 280 && Math.abs(lastTap.x - x) < 80) {
      handlePointerDoubleTap(x, bounds.width);
      lastTapRef.current = null;
      return;
    }

    lastTapRef.current = { time: now, x };
  }

  function selectSource(source: CachedStreamSource) {
    const video = videoRef.current;
    resumeSnapshotRef.current = {
      time: video?.currentTime ?? 0,
      shouldPlay: video ? !video.paused : false,
    };
    setSelectedSourceUrl(source.url);
  }

  if (!stream && !error) {
    return (
      <div className="relative flex aspect-video w-full overflow-hidden rounded-md bg-neutral-950 text-neutral-200 ring-1 ring-white/10">
        {poster ? (
          <div
            className="absolute inset-0 scale-105 bg-cover bg-center opacity-20 blur-sm"
            style={{ backgroundImage: `url(${poster})` }}
          />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(220,38,38,0.22),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.45),rgba(0,0,0,0.9))]" />
        <div className="relative z-10 flex w-full flex-col items-center justify-center px-6 text-center">
          <div className="relative flex size-16 items-center justify-center rounded-full bg-red-600/10 ring-1 ring-red-400/20">
            <div className="absolute inset-1 rounded-full border border-red-500/20" />
            <div className="size-9 animate-spin rounded-full border-2 border-red-500/25 border-t-red-500" />
          </div>
          <p className="mt-5 text-base font-semibold text-white">
            Menyiapkan tontonanmu
          </p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-400">
            Kami sedang mengambil link video terbaik. Biasanya hanya sebentar.
          </p>
          <div className="mt-5 h-1.5 w-44 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-red-500" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-md bg-neutral-950 px-6 text-center ring-1 ring-white/10">
        <p className="text-2xl font-semibold text-white">Video belum siap</p>
        <p className="max-w-md text-sm leading-6 text-neutral-400">
          {error}
        </p>
        <Button onClick={() => setRetryCount((value) => value + 1)}>
          <RotateCw className="size-4" />
          Coba lagi
        </Button>
      </div>
    );
  }

  if (stream && !sources.length) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-md bg-neutral-950 px-6 text-center ring-1 ring-white/10">
        <p className="text-2xl font-semibold text-white">
          Belum tersedia untuk internal player
        </p>
        <p className="max-w-md text-sm leading-6 text-neutral-400">
          Sumber video dari upstream untuk judul ini belum cocok diputar tanpa
          iframe. Judul seperti ini akan disaring dari katalog setelah sync
          berikutnya.
        </p>
        <Button onClick={() => setRetryCount((value) => value + 1)}>
          <RotateCw className="size-4" />
          Coba lagi
        </Button>
      </div>
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      onTouchEnd={handleTouchEnd}
      className="relative aspect-video overflow-hidden bg-black ring-1 ring-white/10 sm:rounded-md"
    >
      <video
        ref={videoRef}
        className="h-full w-full bg-black"
        poster={poster ?? undefined}
        playsInline
        controls
      />
      {sources.length > 1 ? (
        <div className="absolute right-2 top-2 z-20 flex max-w-[calc(100%-1rem)] gap-1 overflow-x-auto rounded-md bg-black/65 p-1 backdrop-blur">
          {sources.map((source) => (
            <button
              key={source.url}
              type="button"
              onClick={() => selectSource(source)}
              className={cn(
                "shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors sm:px-3 sm:py-1.5 sm:text-sm",
                source.url === selectedSource?.url
                  ? "border-white bg-white text-neutral-950"
                  : "border-white/15 bg-neutral-900 text-neutral-100 hover:bg-neutral-800",
              )}
            >
              {source.label}
            </button>
          ))}
        </div>
      ) : null}
      {seekFeedback ? (
        <div
          key={seekFeedback.key}
          className={cn(
            "pointer-events-none absolute inset-y-0 flex w-1/2 items-center justify-center bg-black/15 text-white",
            seekFeedback.direction === "backward" ? "left-0" : "right-0",
          )}
        >
          <div className="flex size-20 animate-ping items-center justify-center rounded-full bg-white/10" />
          <div className="absolute flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-sm font-semibold backdrop-blur">
            {seekFeedback.direction === "backward" ? (
              <RotateCcw className="size-5" />
            ) : (
              <RotateCw className="size-5" />
            )}
            {seekFeedback.direction === "backward" ? "-10 detik" : "+10 detik"}
          </div>
        </div>
      ) : null}
    </div>
  );
}
