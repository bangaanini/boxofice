"use client";

import * as React from "react";
import { Play, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { prefetchCachedStream } from "@/lib/stream-cache-client";

type PlayButtonProps = {
  movieId: string;
};

export function PlayButton({ movieId }: PlayButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    router.prefetch(`/watch/${movieId}`);

    const scheduleWarmup = () => {
      void prefetchCachedStream(movieId).catch(() => undefined);
      void import("video.js").catch(() => undefined);
      void import("videojs-hls-quality-selector").catch(() => undefined);
    };

    const idleScheduler = window.requestIdleCallback;

    if (typeof idleScheduler === "function") {
      const idleId = idleScheduler(scheduleWarmup, {
        timeout: 1200,
      });

      return () => {
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = globalThis.setTimeout(scheduleWarmup, 300);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [movieId, router]);

  function play() {
    setIsLoading(true);
    router.push(`/watch/${movieId}`);
  }

  return (
    <Button
      type="button"
      size="lg"
      onClick={play}
      disabled={isLoading}
      className="h-12 w-full bg-red-600 px-7 text-white hover:bg-red-500 sm:w-auto"
    >
      {isLoading ? (
        <RefreshCw className="size-5 animate-spin" />
      ) : (
        <Play className="size-5 fill-current" />
      )}
      {isLoading ? "Opening player" : "Play"}
    </Button>
  );
}
