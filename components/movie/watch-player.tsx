"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import type Player from "video.js/dist/types/player";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StreamSource = {
  url: string;
  label: string;
  quality?: string;
  type?: string;
};

type StreamResponse = {
  sources: StreamSource[];
};

type PlayerWithQualitySelector = Player & {
  hlsQualitySelector?: (options?: { displayCurrentQuality?: boolean }) => void;
};

type WatchPlayerProps = {
  movieId: string;
  poster?: string | null;
};

function isHlsSource(source: StreamSource) {
  return (
    source.type === "application/x-mpegURL" ||
    decodeURIComponent(source.url).toLowerCase().includes(".m3u8")
  );
}

function toVideoJsSource(source: StreamSource) {
  const type = source.type ?? (isHlsSource(source) ? "application/x-mpegURL" : "video/mp4");

  return {
    src:
      type === "application/x-mpegURL"
        ? `/api/hls?url=${encodeURIComponent(source.url)}`
        : source.url,
    type,
  };
}

export function WatchPlayer({ movieId, poster }: WatchPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const playerRef = React.useRef<PlayerWithQualitySelector | null>(null);
  const [stream, setStream] = React.useState<StreamResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedSourceUrl, setSelectedSourceUrl] = React.useState<string | null>(
    null,
  );
  const [retryCount, setRetryCount] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadStream() {
      setError(null);
      setStream(null);

      try {
        const response = await fetch(`/api/stream?id=${encodeURIComponent(movieId)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Player request failed with ${response.status}`);
        }

        const payload = (await response.json()) as StreamResponse;

        if (!payload.sources.length) {
          throw new Error("No playable HLS source was returned.");
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
            : "Unable to open the player.",
        );
      }
    }

    loadStream();

    return () => {
      controller.abort();
    };
  }, [movieId, retryCount]);

  const sources = React.useMemo(() => stream?.sources ?? [], [stream]);
  const selectedSource =
    sources.find((source) => source.url === selectedSourceUrl) ??
    sources[0] ??
    null;

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
    }

    setupPlayer();

    return () => {
      disposed = true;
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, [poster, selectedSource, sources]);

  function selectSource(source: StreamSource) {
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
      <div className="flex aspect-video w-full items-center justify-center rounded-md bg-neutral-950 text-neutral-300 ring-1 ring-white/10">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="size-7 animate-spin text-red-500" />
          <p>Preparing direct stream</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-md bg-neutral-950 px-6 text-center ring-1 ring-white/10">
        <p className="text-2xl font-semibold text-white">Player unavailable</p>
        <p className="max-w-md text-sm leading-6 text-neutral-400">{error}</p>
        <Button onClick={() => setRetryCount((value) => value + 1)}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div data-vjs-player className="overflow-hidden bg-black ring-1 ring-white/10 sm:rounded-md">
        <video
          ref={videoRef}
          className="video-js vjs-big-play-centered"
          playsInline
          controls
        />
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
