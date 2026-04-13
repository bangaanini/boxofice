"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import type Player from "video.js/dist/types/player";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StreamSource = {
  url: string;
  label: string;
  quality?: string;
  type?: string;
};

type StreamResponse = {
  originalUrl: string;
  iframe?: string;
  sources: StreamSource[];
};

type PlayerWithQualitySelector = Player & {
  hlsQualitySelector?: (options?: { displayCurrentQuality?: boolean }) => void;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; stream: StreamResponse };

type VideoPlayerProps = {
  sourceUrl: string;
  poster?: string | null;
  title: string;
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

export function VideoPlayer({ sourceUrl, poster, title }: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const playerRef = React.useRef<PlayerWithQualitySelector | null>(null);
  const [state, setState] = React.useState<LoadState>({ status: "loading" });
  const [retryCount, setRetryCount] = React.useState(0);
  const [selectedSourceUrl, setSelectedSourceUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadStream() {
      setState({ status: "loading" });

      try {
        const response = await fetch(
          `/api/stream?sourceUrl=${encodeURIComponent(sourceUrl)}`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Stream request failed with ${response.status}`);
        }

        const stream = (await response.json()) as StreamResponse;
        setState({ status: "ready", stream });
        setSelectedSourceUrl(stream.sources[0]?.url ?? null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load this stream.",
        });
      }
    }

    loadStream();

    return () => {
      controller.abort();
    };
  }, [sourceUrl, retryCount]);

  const stream = state.status === "ready" ? state.stream : null;
  const sources = stream?.sources ?? [];
  const hasDirectSources = sources.length > 0;
  const selectedSource =
    sources.find((source) => source.url === selectedSourceUrl) ??
    sources[0] ??
    null;

  React.useEffect(() => {
    if (!videoRef.current || !stream?.sources.length) {
      return;
    }

    const currentStream = stream;
    let disposed = false;

    async function setupPlayer() {
      const [{ default: videojs }] = await Promise.all([
        import("video.js"),
        import("videojs-hls-quality-selector"),
      ]);

      if (disposed || !videoRef.current) {
        return;
      }

      const sources = [toVideoJsSource(selectedSource ?? currentStream.sources[0])];

      const player = videojs(videoRef.current, {
        controls: true,
        fluid: true,
        responsive: true,
        preload: "metadata",
        poster: poster ?? undefined,
        sources,
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
  }, [poster, selectedSource, stream]);

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

  if (state.status === "loading") {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-md bg-neutral-950">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-md border border-white/10 bg-neutral-950 p-6 text-center">
        <div>
          <p className="text-lg font-semibold text-white">Stream unavailable</p>
          <p className="mt-2 text-sm text-neutral-400">{state.message}</p>
        </div>
        <Button onClick={() => setRetryCount((value) => value + 1)}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (!hasDirectSources && stream?.iframe) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
        <iframe
          src={stream.iframe}
          title={`${title} player`}
          className="h-full w-full"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  if (!hasDirectSources) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-md border border-white/10 bg-neutral-950 p-6 text-center">
        <p className="max-w-md text-sm text-neutral-300">
          No direct video source is available for this title yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div data-vjs-player className="overflow-hidden rounded-md bg-black">
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
