"use client";

import * as React from "react";
import { ExternalLink, RotateCcw, RotateCw } from "lucide-react";
import type Player from "video.js/dist/types/player";

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

type PlayerWithQualitySelector = Player & {
  hlsQualitySelector?: (options?: { displayCurrentQuality?: boolean }) => void;
};

type WatchPlayerProps = {
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

function toVideoJsSource(source: CachedStreamSource) {
  const type =
    source.type ?? (isHlsSource(source) ? "application/x-mpegURL" : "video/mp4");

  return {
    src: `/api/hls?url=${encodeURIComponent(source.url)}`,
    type,
  };
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

function EmbeddedIframePlayer({ src }: { src: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black ring-1 ring-white/10 sm:rounded-md">
      <iframe
        src={src}
        title="Pemutar video"
        className="h-full w-full bg-black"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="origin-when-cross-origin"
      />
    </div>
  );
}

export function WatchPlayer({ movieId, poster, sourceUrl }: WatchPlayerProps) {
  const streamCacheKey = React.useMemo(() => {
    if (sourceUrl) {
      return getSourceStreamCacheKey(sourceUrl);
    }

    return movieId ? getMovieStreamCacheKey(movieId) : null;
  }, [movieId, sourceUrl]);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const playerRef = React.useRef<PlayerWithQualitySelector | null>(null);
  const lastTapRef = React.useRef<{ time: number; x: number } | null>(null);
  const [stream, setStream] = React.useState<CachedStreamResponse | null>(() =>
    streamCacheKey ? readCachedStream(streamCacheKey) : null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [selectedSourceUrl, setSelectedSourceUrl] = React.useState<string | null>(
    streamCacheKey ? readCachedStream(streamCacheKey)?.sources[0]?.url ?? null : null,
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
        setSelectedSourceUrl((current) => current ?? cached.sources[0]?.url ?? null);
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
        setSelectedSourceUrl(payload.sources[0]?.url ?? null);
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
  }, [movieId, retryCount, sourceUrl, streamCacheKey]);

  const sources = React.useMemo(() => stream?.sources ?? [], [stream]);
  const selectedSource =
    sources.find((source) => source.url === selectedSourceUrl) ??
    sources[0] ??
    null;

  const iframePlayerUrl = React.useMemo(
    () => stream?.iframe ?? null,
    [stream],
  );
  const externalPlayerUrl = React.useMemo(
    () => stream?.iframe ?? stream?.resolvedFrom ?? stream?.originalUrl ?? null,
    [stream],
  );

  const moveToNextPlayableSource = React.useCallback(
    (failedUrl: string) => {
      const nextFailedUrls = Array.from(
        new Set([...failedSourceUrls, failedUrl]),
      );
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

    let disposed = false;

    async function setupPlayer() {
      const [{ default: videojs }] = await Promise.all([
        import("video.js"),
        import("videojs-hls-quality-selector"),
      ]);

      if (disposed || !videoRef.current) {
        return;
      }

      const player = videojs(videoRef.current, {
        autoplay: false,
        controls: true,
        fluid: true,
        responsive: true,
        preload: "metadata",
        poster: poster ?? undefined,
        sources: [toVideoJsSource(selectedSource)],
      }) as PlayerWithQualitySelector;

      playerRef.current = player;
      player.ready(() => {
        player.hlsQualitySelector?.({ displayCurrentQuality: true });
      });

      const handlePlayerError = () => {
        moveToNextPlayableSource(selectedSource.url);
      };
      const handleFullscreenChange = () => {
        if (player.isFullscreen()) {
          void lockLandscapeIfPossible();
          return;
        }

        unlockOrientationIfPossible();
      };

      player.on("error", handlePlayerError);
      player.on("fullscreenchange", handleFullscreenChange);
    }

    setupPlayer();

    return () => {
      disposed = true;
      playerRef.current?.dispose();
      unlockOrientationIfPossible();
      playerRef.current = null;
    };
  }, [moveToNextPlayableSource, poster, selectedSource, sources]);

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
    const player = playerRef.current;

    if (!player) {
      return;
    }

    const currentTime = player.currentTime() ?? 0;
    const duration = player.duration();
    const maxTime =
      typeof duration === "number" && Number.isFinite(duration)
        ? Math.max(duration - 1, 0)
        : Infinity;
    const nextTime = Math.max(
      0,
      Math.min(currentTime + seconds, maxTime),
    );

    player.currentTime(nextTime);
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

    if (target.closest(".vjs-control-bar, button")) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    handlePointerDoubleTap(event.clientX - bounds.left, bounds.width);
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;

    if (target.closest(".vjs-control-bar, button")) {
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
    if (!playerRef.current) {
      setSelectedSourceUrl(source.url);
      return;
    }

    const player = playerRef.current;
    const currentTime = player.currentTime() ?? 0;
    const wasPaused = player.paused();

    setSelectedSourceUrl(source.url);
    player.src(toVideoJsSource(source));
    player.one("loadedmetadata", () => {
      player.currentTime(currentTime);
      if (!wasPaused) {
        void player.play();
      }
    });
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
    if (iframePlayerUrl) {
      return <EmbeddedIframePlayer src={iframePlayerUrl} />;
    }

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
        {externalPlayerUrl ? (
          <Button asChild variant="secondary">
            <a
              href={externalPlayerUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-4" />
              Buka player cadangan
            </a>
          </Button>
        ) : null}
      </div>
    );
  }

  if (iframePlayerUrl) {
    return <EmbeddedIframePlayer src={iframePlayerUrl} />;
  }

  if (stream && !sources.length) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-md bg-neutral-950 px-6 text-center ring-1 ring-white/10">
        <p className="text-2xl font-semibold text-white">
          Source langsung belum tersedia
        </p>
        <p className="max-w-md text-sm leading-6 text-neutral-400">
          Link video dari upstream untuk judul ini belum cocok untuk pemutar
          internal. Kamu tetap bisa mencoba player cadangan.
        </p>
        {externalPlayerUrl ? (
          <Button asChild>
            <a
              href={externalPlayerUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-4" />
              Buka player cadangan
            </a>
          </Button>
        ) : (
          <Button onClick={() => setRetryCount((value) => value + 1)}>
            <RotateCw className="size-4" />
            Coba lagi
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        data-vjs-player
        onDoubleClick={handleDoubleClick}
        onTouchEnd={handleTouchEnd}
        className="relative overflow-hidden bg-black ring-1 ring-white/10 sm:rounded-md"
      >
        <video
          ref={videoRef}
          className="video-js vjs-big-play-centered"
          playsInline
          controls
        />
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

      {sources.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {sources.map((source) => (
            <button
              key={source.url}
              type="button"
              onClick={() => selectSource(source)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
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
    </div>
  );
}
