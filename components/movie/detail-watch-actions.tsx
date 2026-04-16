"use client";
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
  authBotChatUrl?: string | null;
  authMiniAppUrl?: string | null;
  initialSaved: boolean;
  initialOpen?: boolean;
  movieId: string;
  poster?: string | null;
  requiresAuth?: boolean;
  shareText?: string;
  shareUrl?: string;
  telegramShareUrl?: string | null;
  title: string;
};

export function DetailWatchActions({
  authBotChatUrl,
  authMiniAppUrl,
  initialSaved,
  initialOpen = false,
  movieId,
  poster,
  requiresAuth = false,
  shareText,
  shareUrl,
  telegramShareUrl,
  title,
}: DetailWatchActionsProps) {
  const playerRef = React.useRef<HTMLDivElement | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = React.useState(initialOpen);
  const [immersiveRequestId, setImmersiveRequestId] = React.useState(
    initialOpen ? 1 : 0,
  );

  const closePlayer = React.useCallback(() => {
    setIsPlayerOpen(false);
  }, []);

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
    if (requiresAuth) {
      window.location.href = authMiniAppUrl || authBotChatUrl || "/admin/login";
      return;
    }

    if (isPlayerOpen) {
      setImmersiveRequestId((value) => value + 1);
      playerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    setImmersiveRequestId((value) => value + 1);
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
            {requiresAuth
              ? "Buka di Telegram"
              : isPlayerOpen
                ? "Putar lagi"
                : "Tonton"}
          </Button>
        </div>
        <MovieActionButtons
          authUrl={authMiniAppUrl || authBotChatUrl}
          initialSaved={initialSaved}
          movieId={movieId}
          requiresAuth={requiresAuth}
          shareText={shareText}
          shareUrl={shareUrl}
          telegramShareUrl={telegramShareUrl}
          title={title}
        />
      </div>

      {isPlayerOpen ? (
        <div ref={playerRef} className="pt-1">
          <WatchPlayer
            key={movieId}
            autoPlay
            defaultQuality="480p"
            immersiveRequestId={immersiveRequestId}
            movieId={movieId}
            onRequestClose={closePlayer}
            poster={poster}
          />
        </div>
      ) : null}
    </div>
  );
}
