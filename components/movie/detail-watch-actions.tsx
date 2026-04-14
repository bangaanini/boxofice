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
  initialProgressSeconds?: number;
  movieId: string;
  poster?: string | null;
  showResumePrompt?: boolean;
  title: string;
};

function formatResumeTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.trunc(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function DetailWatchActions({
  initialSaved,
  initialOpen = false,
  initialProgressSeconds = 0,
  movieId,
  poster,
  showResumePrompt = false,
  title,
}: DetailWatchActionsProps) {
  const playerRef = React.useRef<HTMLDivElement | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = React.useState(initialOpen);
  const [isResumePromptOpen, setIsResumePromptOpen] =
    React.useState(showResumePrompt);
  const [playerStartSeconds, setPlayerStartSeconds] = React.useState(
    initialProgressSeconds,
  );

  React.useEffect(() => {
    if (initialOpen) {
      setIsPlayerOpen(true);
    }
  }, [initialOpen]);

  React.useEffect(() => {
    setPlayerStartSeconds(initialProgressSeconds);
  }, [initialProgressSeconds]);

  React.useEffect(() => {
    if (showResumePrompt) {
      setIsResumePromptOpen(true);
    }
  }, [showResumePrompt]);

  React.useEffect(() => {
    if (!isResumePromptOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsResumePromptOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isResumePromptOpen]);

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
    setPlayerStartSeconds(0);

    if (isPlayerOpen) {
      playerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    setIsPlayerOpen(true);
  }

  function continueWatching() {
    setPlayerStartSeconds(initialProgressSeconds);
    setIsResumePromptOpen(false);
    setIsPlayerOpen(true);
  }

  function startFromBeginning() {
    setPlayerStartSeconds(0);
    setIsResumePromptOpen(false);
    setIsPlayerOpen(true);
  }

  return (
    <div className="space-y-3">
      {isResumePromptOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-5 backdrop-blur-sm sm:items-center sm:pb-0"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-dialog-title"
        >
          <div className="w-full max-w-md rounded-md border border-white/10 bg-neutral-950 p-5 text-white shadow-2xl shadow-black/70">
            <p className="text-sm font-semibold text-red-400">
              Lanjutkan tontonan
            </p>
            <h2
              id="resume-dialog-title"
              className="mt-2 text-2xl font-black leading-tight"
            >
              Kamu terakhir berhenti di {formatResumeTime(initialProgressSeconds)}
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Tekan lanjutkan untuk membuka player dan langsung melompat ke
              posisi terakhir.
            </p>
            <div className="mt-5 grid gap-2">
              <Button
                type="button"
                onClick={continueWatching}
                className="h-12 bg-red-600 text-white hover:bg-red-500"
              >
                <Play className="size-4 fill-current" />
                Lanjutkan dari {formatResumeTime(initialProgressSeconds)}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={startFromBeginning}
                className="h-12 border border-white/10 bg-white/10 text-white hover:bg-white/15"
              >
                Mulai dari awal
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <div className="sm:w-auto">
          <Button
            type="button"
            size="lg"
            onClick={playInline}
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
            key={`${movieId}:${playerStartSeconds}`}
            autoPlay
            defaultQuality="480p"
            initialProgressSeconds={playerStartSeconds}
            movieId={movieId}
            poster={poster}
          />
        </div>
      ) : null}
    </div>
  );
}
