"use client";

import * as React from "react";
import { LogIn, Play, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { MovieActionButtons } from "@/components/movie/movie-action-buttons";
import { Button } from "@/components/ui/button";
import {
  buildSeriesEpisodeGroups,
  type SeasonInfo,
} from "@/lib/season-utils";
import {
  getMovieStreamCacheKey,
  prefetchCachedStream,
} from "@/lib/stream-cache-client";

type DetailWatchActionsProps = {
  authLoginUrl?: string | null;
  initialSaved: boolean;
  movieId: string;
  requiresAuth?: boolean;
  seasonsList?: SeasonInfo[] | null;
  shareText?: string;
  shareUrl?: string;
  subjectType?: number;
  telegramShareUrl?: string | null;
  title: string;
  totalEpisode?: number;
  totalSeason?: number;
};

export function DetailWatchActions({
  authLoginUrl,
  initialSaved,
  movieId,
  requiresAuth = false,
  seasonsList,
  shareText,
  shareUrl,
  subjectType = 1,
  telegramShareUrl,
  title,
  totalEpisode,
  totalSeason,
}: DetailWatchActionsProps) {
  const router = useRouter();
  const hasKnownEpisodeList = subjectType === 2 && Boolean(seasonsList?.length);
  const episodeGroups = React.useMemo(
    () =>
      hasKnownEpisodeList
        ? buildSeriesEpisodeGroups({
            seasonsList,
            totalEpisode,
            totalSeason,
          })
        : [],
    [hasKnownEpisodeList, seasonsList, totalEpisode, totalSeason],
  );
  const [selectedSeason, setSelectedSeason] = React.useState(
    episodeGroups[0]?.season ?? 1,
  );
  const [selectedEpisode, setSelectedEpisode] = React.useState(
    episodeGroups[0]?.episodes[0] ?? 1,
  );
  const [isOpening, setIsOpening] = React.useState(false);
  const selectedGroup =
    episodeGroups.find((group) => group.season === selectedSeason) ??
    episodeGroups[0] ??
    null;
  const episodeOptions = selectedGroup?.episodes.length
    ? selectedGroup.episodes
    : [1];
  const selectedSeasonNumber = selectedGroup?.season ?? selectedSeason;
  const selectedEpisodeNumber = episodeOptions.includes(selectedEpisode)
    ? selectedEpisode
    : episodeOptions[0];
  const watchPath = React.useMemo(() => {
    if (!episodeGroups.length) {
      return `/watch/${movieId}`;
    }

    const params = new URLSearchParams({
      ep: String(selectedEpisodeNumber),
      se: String(selectedSeasonNumber),
    });

    return `/watch/${movieId}?${params.toString()}`;
  }, [
    episodeGroups.length,
    movieId,
    selectedEpisodeNumber,
    selectedSeasonNumber,
  ]);

  React.useEffect(() => {
    if (!episodeGroups.length) {
      return;
    }

    const nextGroup =
      episodeGroups.find((group) => group.season === selectedSeason) ??
      episodeGroups[0];
    const nextEpisodes = nextGroup.episodes.length ? nextGroup.episodes : [1];

    if (selectedSeason !== nextGroup.season) {
      setSelectedSeason(nextGroup.season);
      return;
    }

    if (!nextEpisodes.includes(selectedEpisode)) {
      setSelectedEpisode(nextEpisodes[0]);
    }
  }, [episodeGroups, selectedEpisode, selectedSeason]);

  React.useEffect(() => {
    if (requiresAuth) {
      return;
    }

    router.prefetch(watchPath);

    const scheduleWarmup = () => {
      void prefetchCachedStream({
        cacheKey: getMovieStreamCacheKey(
          movieId,
          episodeGroups.length ? selectedSeasonNumber : undefined,
          episodeGroups.length ? selectedEpisodeNumber : undefined,
        ),
        episode: episodeGroups.length ? selectedEpisodeNumber : undefined,
        movieId,
        season: episodeGroups.length ? selectedSeasonNumber : undefined,
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
  }, [
    episodeGroups.length,
    movieId,
    requiresAuth,
    router,
    selectedEpisodeNumber,
    selectedSeasonNumber,
    watchPath,
  ]);

  function handleWatch() {
    if (requiresAuth) {
      window.location.href = authLoginUrl || "/login";
      return;
    }

    setIsOpening(true);
    router.push(watchPath);
  }

  return (
    <div className="space-y-3">
      {episodeGroups.length ? (
        <div className="grid gap-2 sm:max-w-md sm:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold text-neutral-400">
            Season
            <select
              value={selectedSeasonNumber}
              onChange={(event) => {
                const nextSeason = Number(event.target.value);
                const nextGroup =
                  episodeGroups.find((group) => group.season === nextSeason) ??
                  episodeGroups[0];

                setSelectedSeason(nextGroup.season);
                setSelectedEpisode(nextGroup.episodes[0] ?? 1);
              }}
              className="h-11 w-full rounded-lg border border-white/15 bg-black/55 px-3 text-sm font-semibold normal-case tracking-normal text-white outline-none transition focus:border-red-400"
            >
              {episodeGroups.map((group) => (
                <option key={group.season} value={group.season}>
                  Season {group.season}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs font-semibold text-neutral-400">
            Episode
            <select
              value={selectedEpisodeNumber}
              onChange={(event) =>
                setSelectedEpisode(Number(event.target.value))
              }
              className="h-11 w-full rounded-lg border border-white/15 bg-black/55 px-3 text-sm font-semibold normal-case tracking-normal text-white outline-none transition focus:border-red-400"
            >
              {episodeOptions.map((episode) => (
                <option key={episode} value={episode}>
                  Episode {episode}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

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
            {requiresAuth ? (
              <LogIn className="size-4" />
            ) : isOpening ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
            {requiresAuth
              ? "Login / Daftar untuk menonton"
              : isOpening
                ? "Membuka..."
                : episodeGroups.length
                  ? `Tonton S${selectedSeasonNumber} E${selectedEpisodeNumber}`
                  : "Tonton"}
          </Button>
        </div>
        <MovieActionButtons
          authUrl={authLoginUrl || "/login"}
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
