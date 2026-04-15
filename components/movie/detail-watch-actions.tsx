"use client";

import Link from "next/link";
import * as React from "react";
import { Play } from "lucide-react";

import { MovieActionButtons } from "@/components/movie/movie-action-buttons";
import { WatchPlayer } from "@/components/movie/watch-player";
import { Button } from "@/components/ui/button";
import {
  getMovieStreamCacheKey,
  prefetchCachedStream,
} from "@/lib/stream-cache-client";

type DetailWatchActionsProps = {
  initialSaved: boolean;
  initialOpen?: boolean;
  movieId: string;
  poster?: string | null;
  title: string;
};

export function DetailWatchActions({
  initialSaved,
  initialOpen = false,
  movieId,
  poster,
  title,
}: DetailWatchActionsProps) {
  const playerRef = React.useRef<HTMLDivElement | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = React.useState(initialOpen);

  React.useEffect(() => {
    if (initialOpen) {
      setIsPlayerOpen(true);
    }
  }, [initialOpen]);

  React.useEffect(() => {
    const warmupId = window.setTimeout(() => {
      void prefetchCachedStream({
        cacheKey: getMovieStreamCacheKey(movieId),
        movieId,
      }).catch(() => undefined);
      void import("hls.js").catch(() => undefined);
    }, 350);

    return () => {
      window.clearTimeout(warmupId);
    };
  }, [movieId]);

  React.useEffect(() => {
    if (!isPlayerOpen) {
      return;
    }

    const scrollId = window.setTimeout(() => {
      playerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 0);

    return () => {
      window.clearTimeout(scrollId);
    };
  }, [isPlayerOpen]);

  function playInline() {
    if (isPlayerOpen) {
      playerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    setIsPlayerOpen(true);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <div className="sm:w-auto">
          <Button
            type="button"
            size="lg"
            onClick={playInline}
            data-haptic="medium"
            className="h-12 w-full bg-red-600 px-7 text-white hover:bg-red-500 sm:w-auto"
          >
            <Play className="size-4 fill-current" />
            {isPlayerOpen ? "Putar lagi" : "Tonton"}
          </Button>
        </div>
        <MovieActionButtons
          initialSaved={initialSaved}
          movieId={movieId}
          title={title}
        />
        <Button
          asChild
          size="lg"
          variant="secondary"
          data-haptic="light"
          className="hidden h-12 border border-white/10 bg-white/10 px-7 text-white hover:bg-white/15 sm:inline-flex"
        >
          <Link href="/" prefetch>
            Jelajahi lagi
          </Link>
        </Button>
      </div>

      {isPlayerOpen ? (
        <div ref={playerRef} className="pt-1">
          <WatchPlayer
            key={movieId}
            autoPlay
            defaultQuality="480p"
            movieId={movieId}
            poster={poster}
          />
        </div>
      ) : null}
    </div>
  );
}
