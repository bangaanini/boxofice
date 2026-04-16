"use client";

import * as React from "react";
import { Play, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { MovieActionButtons } from "@/components/movie/movie-action-buttons";
import { Button } from "@/components/ui/button";
import {
  getMovieStreamCacheKey,
  prefetchCachedStream,
} from "@/lib/stream-cache-client";

type DetailWatchActionsProps = {
  authBotChatUrl?: string | null;
  authMiniAppUrl?: string | null;
  initialSaved: boolean;
  movieId: string;
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
  movieId,
  requiresAuth = false,
  shareText,
  shareUrl,
  telegramShareUrl,
  title,
}: DetailWatchActionsProps) {
  const router = useRouter();
  const [isOpening, setIsOpening] = React.useState(false);

  React.useEffect(() => {
    if (requiresAuth) {
      return;
    }

    router.prefetch(`/watch/${movieId}`);

    const scheduleWarmup = () => {
      void prefetchCachedStream({
        cacheKey: getMovieStreamCacheKey(movieId),
        movieId,
      }).catch(() => undefined);
      void import("hls.js").catch(() => undefined);
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

    const timeoutId = window.setTimeout(scheduleWarmup, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [movieId, requiresAuth, router]);

  function handleWatch() {
    if (requiresAuth) {
      window.location.href = authMiniAppUrl || authBotChatUrl || "/admin/login";
      return;
    }

    setIsOpening(true);
    router.push(`/watch/${movieId}`);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <div className="sm:w-auto">
          <Button
            type="button"
            size="lg"
            onClick={handleWatch}
            disabled={isOpening}
            data-haptic="medium"
            className="h-12 w-full bg-red-600 px-7 text-white hover:bg-red-500 sm:w-auto"
          >
            {isOpening ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
            {requiresAuth
              ? "Buka di Telegram"
              : isOpening
                ? "Membuka..."
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
    </div>
  );
}
