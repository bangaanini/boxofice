"use client";

import * as React from "react";
import { Expand, Minimize, RotateCcw, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  clearCachedStream,
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
  episode?: number;
  immersiveRequestId?: number;
  initialProgressSeconds?: number;
  movieId?: string;
  onRequestClose?: () => void;
  poster?: string | null;
  season?: number;
  sourceUrl?: string;
};

type SeekFeedback = {
  direction: "backward" | "forward";
  key: number;
};

type PointerArea = {
  axisPosition: number;
  primarySize: number;
  rawHeight: number;
  rawWidth: number;
};

type VideoElementWithFastSeek = HTMLVideoElement & {
  fastSeek?: (time: number) => void;
  webkitEnterFullscreen?: () => void;
  webkitSupportsFullscreen?: boolean;
};

type TelegramWebApp = {
  exitFullscreen?: () => void;
  expand?: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  requestFullscreen?: () => void;
  setHeaderColor?: (color: string) => void;
};

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
};

function isHlsSource(source: CachedStreamSource) {
  return (
    source.type === "application/x-mpegURL" ||
    decodeURIComponent(source.url).toLowerCase().includes(".m3u8")
  );
}

function normalizeQuality(value: string | undefined) {
  return value?.toLowerCase().replace(/\s+/g, "").replace(/p$/, "");
}

function isAutoSource(source: CachedStreamSource) {
  const label = normalizeQuality(source.label);
  const quality = normalizeQuality(source.quality);

  return label === "auto" || quality === "auto";
}

function chooseDefaultSource(
  sources: CachedStreamSource[],
  defaultQuality: string | undefined,
) {
  if (!sources.length) {
    return null;
  }

  const autoSource = sources.find((source) => isAutoSource(source));

  if (autoSource) {
    return autoSource;
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

function unlockOrientationIfPossible() {
  screen.orientation?.unlock?.();
}

function formatPreviewLimit(seconds: number) {
  if (seconds <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getTelegramWebApp() {
  if (typeof window === "undefined") {
    return null;
  }

  return (window as TelegramWindow).Telegram?.WebApp ?? null;
}

function notifyImmersiveState(active: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  document.body.dataset.playerImmersive = active ? "true" : "false";
  window.dispatchEvent(
    new CustomEvent("boxofice-immersive-change", {
      detail: { active },
    }),
  );
}

function getPointerAreaFromBounds(options: {
  clientX: number;
  clientY: number;
  height: number;
  left: number;
  rotateImmersive: boolean;
  top: number;
  width: number;
}): PointerArea {
  const x = Math.max(0, Math.min(options.clientX - options.left, options.width));
  const y = Math.max(0, Math.min(options.clientY - options.top, options.height));

  if (options.rotateImmersive) {
    return {
      axisPosition: options.height > 0 ? 1 - y / options.height : 0.5,
      primarySize: options.height,
      rawHeight: options.height,
      rawWidth: options.width,
    };
  }

  return {
    axisPosition: options.width > 0 ? x / options.width : 0.5,
    primarySize: options.width,
    rawHeight: options.height,
    rawWidth: options.width,
  };
}

export function WatchPlayer({
  autoPlay = false,
  defaultQuality,
  episode = 0,
  immersiveRequestId = 0,
  initialProgressSeconds = 0,
  movieId,
  onRequestClose,
  poster,
  season = 0,
  sourceUrl,
}: WatchPlayerProps) {
  const streamCacheKey = React.useMemo(() => {
    if (sourceUrl) {
      return getSourceStreamCacheKey(sourceUrl, season, episode);
    }

    return movieId ? getMovieStreamCacheKey(movieId, season, episode) : null;
  }, [episode, movieId, season, sourceUrl]);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const hideChromeTimeoutRef = React.useRef<number | null>(null);
  const lastTapRef = React.useRef<{ time: number; x: number } | null>(null);
  const dismissedRotateSourceUrlRef = React.useRef<string | null>(null);
  const seekFeedbackKeyRef = React.useRef(0);
  const resumeSnapshotRef = React.useRef<{
    time: number;
    shouldPlay: boolean;
  } | null>(null);
  const initialResumeAppliedRef = React.useRef(false);
  const lastProgressReportRef = React.useRef(0);
  const failedSourceUrlsRef = React.useRef<string[]>([]);
  const [stream, setStream] = React.useState<CachedStreamResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedSourceUrl, setSelectedSourceUrl] = React.useState<string | null>(
    null,
  );
  const [seekFeedback, setSeekFeedback] = React.useState<SeekFeedback | null>(
    null,
  );
  const [isImmersive, setIsImmersive] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [previewEnded, setPreviewEnded] = React.useState(false);
  const [showChrome, setShowChrome] = React.useState(true);
  const [showRotateGate, setShowRotateGate] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);

  const requestClose = React.useCallback(() => {
    onRequestClose?.();
  }, [onRequestClose]);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadStream() {
      setError(null);
      failedSourceUrlsRef.current = [];
      setPreviewEnded(false);
      setShowRotateGate(false);
      dismissedRotateSourceUrlRef.current = null;

      if (!streamCacheKey || (!movieId && !sourceUrl)) {
        setError("Sumber video belum valid.");
        return;
      }

      const cached = readCachedStream(streamCacheKey);

      if (cached) {
        setStream(cached);
        setSelectedSourceUrl(
          chooseDefaultSource(cached.sources, defaultQuality)?.url ?? null,
        );
        return;
      }

      setStream(null);

      try {
        const payload = await prefetchCachedStream({
          cacheKey: streamCacheKey,
          episode,
          movieId,
          season,
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
  }, [
    defaultQuality,
    episode,
    movieId,
    retryCount,
    season,
    sourceUrl,
    streamCacheKey,
  ]);

  const sources = React.useMemo(() => stream?.sources ?? [], [stream]);
  const previewLimitSeconds = Math.max(0, stream?.previewLimitSeconds ?? 0);
  const isVipActive = Boolean(stream?.vipActive);
  const selectedSource =
    sources.find((source) => source.url === selectedSourceUrl) ??
    chooseDefaultSource(sources, defaultQuality) ??
    null;
  const manualSources = React.useMemo(
    () => sources.filter((source) => !isAutoSource(source)),
    [sources],
  );

  const clearHideChromeTimer = React.useCallback(() => {
    if (hideChromeTimeoutRef.current !== null) {
      window.clearTimeout(hideChromeTimeoutRef.current);
      hideChromeTimeoutRef.current = null;
    }
  }, []);

  const revealChrome = React.useCallback(() => {
    setShowChrome(true);
  }, []);

  const scheduleHideChrome = React.useCallback(() => {
    clearHideChromeTimer();

    if (!isImmersive || !isPlaying) {
      return;
    }

    hideChromeTimeoutRef.current = window.setTimeout(() => {
      setShowChrome(false);
    }, 2200);
  }, [clearHideChromeTimer, isImmersive, isPlaying]);

  const pulseChrome = React.useCallback(() => {
    revealChrome();
    scheduleHideChrome();
  }, [revealChrome, scheduleHideChrome]);

  const enterImmersive = React.useCallback(async () => {
    const telegram = getTelegramWebApp();

    setIsImmersive(true);
    revealChrome();
    telegram?.setHeaderColor?.("#000000");
    telegram?.expand?.();

    if (telegram?.requestFullscreen && telegram.isVersionAtLeast?.("8.0")) {
      telegram.requestFullscreen();
    }

    scheduleHideChrome();
  }, [revealChrome, scheduleHideChrome]);

  const exitImmersive = React.useCallback(async () => {
    const telegram = getTelegramWebApp();

    setIsImmersive(false);
    revealChrome();
    telegram?.exitFullscreen?.();
    unlockOrientationIfPossible();
  }, [revealChrome]);

  const closePlayer = React.useCallback(() => {
    void exitImmersive();
    requestClose();
  }, [exitImmersive, requestClose]);

  const toggleFullscreen = React.useCallback(() => {
    if (isImmersive) {
      closePlayer();
      return;
    }

    void enterImmersive();
  }, [closePlayer, enterImmersive, isImmersive]);

  const moveToNextPlayableSource = React.useCallback(
    (failedUrl: string) => {
      const nextFailedUrls = Array.from(
        new Set([...failedSourceUrlsRef.current, failedUrl]),
      );
      const nextSource = sources.find(
        (source) => !nextFailedUrls.includes(source.url),
      );

      failedSourceUrlsRef.current = nextFailedUrls;

      if (nextSource) {
        dismissedRotateSourceUrlRef.current = null;
        setSelectedSourceUrl(nextSource.url);
        return;
      }

      if (streamCacheKey) {
        clearCachedStream(streamCacheKey);
      }

      setError(
        "Sumber video langsung dari upstream belum bisa diputar di pemutar ini.",
      );
    },
    [sources, streamCacheKey],
  );

  React.useEffect(() => {
    if (!videoRef.current || !sources.length || !selectedSource) {
      return;
    }

    const video = videoRef.current;
    const activeSource = selectedSource;
    let disposed = false;
    const resumeTimeoutIds: number[] = [];
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
    const mediaUrl = activeSource.url;
    const resumeTime = resumeSnapshot?.time ?? 0;
    const hasResumeTarget = resumeTime > 1;
    let hasStartedPlayback = false;
    const resumeEvents = ["loadedmetadata", "loadeddata", "canplay", "seeked"] as const;

    function scheduleResumeStep(delayMs: number) {
      const timeoutId = window.setTimeout(runResumeStep, delayMs);
      resumeTimeoutIds.push(timeoutId);
    }

    function getResumeTargetTime() {
      if (!hasResumeTarget) {
        return 0;
      }

      if (!Number.isFinite(video.duration)) {
        return resumeTime;
      }

      if (video.duration <= 0) {
        return resumeTime;
      }

      return Math.min(resumeTime, Math.max(video.duration - 1, 0));
    }

    function applyResumeSeek() {
      if (!hasResumeTarget || disposed) {
        return true;
      }

      const targetTime = getResumeTargetTime();

      if (Math.abs(video.currentTime - targetTime) <= 1) {
        return true;
      }

      try {
        const seekableVideo = video as VideoElementWithFastSeek;

        if (typeof seekableVideo.fastSeek === "function") {
          seekableVideo.fastSeek(targetTime);
        } else {
          video.currentTime = targetTime;
        }
      } catch {
        return false;
      }

      return Math.abs(video.currentTime - targetTime) <= 1;
    }

    function playWhenResumeReady() {
      if (!resumeSnapshot?.shouldPlay || hasStartedPlayback || disposed) {
        return;
      }

      if (
        hasResumeTarget &&
        Math.abs(video.currentTime - getResumeTargetTime()) > 2
      ) {
        return;
      }

      hasStartedPlayback = true;
      const playPromise = video.play();

      if (!playPromise || typeof playPromise.then !== "function") {
        return;
      }

      playPromise.catch((error: unknown) => {
        hasStartedPlayback = false;

        const name = (error as DOMException | null)?.name;

        if (
          name === "NotAllowedError" ||
          name === "AbortError" ||
          name === "NotSupportedError"
        ) {
          return;
        }

        if (!disposed) {
          console.warn("Video resume play gagal:", error);
        }
      });
    }

    function runResumeStep() {
      const isSeeked = applyResumeSeek();

      if (isSeeked) {
        playWhenResumeReady();
      }
    }

    function handleNativeError() {
      if (!disposed) {
        moveToNextPlayableSource(activeSource.url);
      }
    }

    function setupPlayer() {
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.poster = poster ?? "";
      video.crossOrigin = "anonymous";
      resumeEvents.forEach((eventName) => {
        video.addEventListener(eventName, runResumeStep);
      });

      if (isHlsSource(activeSource)) {
        if (
          video.canPlayType("application/vnd.apple.mpegurl") ||
          video.canPlayType("application/x-mpegURL")
        ) {
          video.addEventListener("error", handleNativeError);
          video.src = mediaUrl;
          video.load();
          scheduleResumeStep(250);
          scheduleResumeStep(900);
          return;
        }

        moveToNextPlayableSource(activeSource.url);
        return;
      }

      video.addEventListener("error", handleNativeError);
      video.src = mediaUrl;
      video.load();
      scheduleResumeStep(250);
      scheduleResumeStep(900);
    }

    setupPlayer();

    return () => {
      disposed = true;
      resumeTimeoutIds.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      resumeEvents.forEach((eventName) => {
        video.removeEventListener(eventName, runResumeStep);
      });
      video.removeEventListener("error", handleNativeError);
      try {
        video.pause();
      } catch {
        // ignore
      }
      video.removeAttribute("src");
      try {
        video.load();
      } catch {
        // ignore
      }
      unlockOrientationIfPossible();
    };
  }, [
    autoPlay,
    defaultQuality,
    initialProgressSeconds,
    moveToNextPlayableSource,
    poster,
    selectedSource,
    stream?.accessToken,
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
    if (selectedSourceUrl) {
      dismissedRotateSourceUrlRef.current = selectedSourceUrl;
    }
    setShowRotateGate(false);
  }, [previewEnded, selectedSourceUrl]);

  React.useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    function handlePlaying() {
      if (selectedSourceUrl) {
        dismissedRotateSourceUrlRef.current = selectedSourceUrl;
      }
      setShowRotateGate(false);
    }

    video.addEventListener("playing", handlePlaying);

    return () => {
      video.removeEventListener("playing", handlePlaying);
    };
  }, [selectedSourceUrl]);

  React.useEffect(() => {
    const video = videoRef.current;

    if (!video || isVipActive || previewLimitSeconds <= 0) {
      return;
    }
    const currentVideo = video;

    function handleTimeUpdate() {
      if (currentVideo.currentTime < previewLimitSeconds) {
        return;
      }

      currentVideo.pause();
      setPreviewEnded(true);
      setShowRotateGate(false);
      revealChrome();
      clearHideChromeTimer();
    }

    currentVideo.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      currentVideo.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [
    clearHideChromeTimer,
    isVipActive,
    previewLimitSeconds,
    revealChrome,
    retryCount,
    selectedSourceUrl,
  ]);

  React.useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    function handlePlay() {
      setIsPlaying(true);
      scheduleHideChrome();
    }

    function handlePause() {
      setIsPlaying(false);
      revealChrome();
      clearHideChromeTimer();
    }

    function handleEnded() {
      setIsPlaying(false);
      revealChrome();
      clearHideChromeTimer();
    }

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, [clearHideChromeTimer, revealChrome, scheduleHideChrome, sources.length]);

  React.useEffect(() => {
    if (immersiveRequestId <= 0) {
      return;
    }

    void enterImmersive();
  }, [enterImmersive, immersiveRequestId]);

  React.useEffect(() => {
    if (!isImmersive) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      unlockOrientationIfPossible();
      notifyImmersiveState(false);
      revealChrome();
      clearHideChromeTimer();
      return;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    notifyImmersiveState(true);
    revealChrome();
    scheduleHideChrome();

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      notifyImmersiveState(false);
      unlockOrientationIfPossible();
      clearHideChromeTimer();
    };
  }, [
    clearHideChromeTimer,
    isImmersive,
    revealChrome,
    scheduleHideChrome,
  ]);

  React.useEffect(() => {
    if (!seekFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => setSeekFeedback(null), 650);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [seekFeedback]);

  React.useEffect(() => {
    if (!isImmersive) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closePlayer();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePlayer, isImmersive]);

  React.useEffect(() => {
    function handleImmersiveBack() {
      closePlayer();
    }

    window.addEventListener(
      "boxofice-immersive-back",
      handleImmersiveBack as EventListener,
    );

    return () => {
      window.removeEventListener(
        "boxofice-immersive-back",
        handleImmersiveBack as EventListener,
      );
    };
  }, [closePlayer]);

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
    seekFeedbackKeyRef.current += 1;
    setSeekFeedback({
      direction: seconds < 0 ? "backward" : "forward",
      key: seekFeedbackKeyRef.current,
    });
  }

  function handlePointerDoubleTap(area: PointerArea) {
    const isLeftSide = area.axisPosition < 0.5;
    seekBy(isLeftSide ? -10 : 10);
    pulseChrome();
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;

    if (target.closest("button")) {
      return;
    }

    pulseChrome();
    const bounds = event.currentTarget.getBoundingClientRect();
    handlePointerDoubleTap(
      getPointerAreaFromBounds({
        clientX: event.clientX,
        clientY: event.clientY,
        height: bounds.height,
        left: bounds.left,
        rotateImmersive: shouldRotateImmersive,
        top: bounds.top,
        width: bounds.width,
      }),
    );
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
    const pointerArea = getPointerAreaFromBounds({
      clientX: touch.clientX,
      clientY: touch.clientY,
      height: bounds.height,
      left: bounds.left,
      rotateImmersive: shouldRotateImmersive,
      top: bounds.top,
      width: bounds.width,
    });
    const now = event.timeStamp;
    const lastTap = lastTapRef.current;

    if (
      lastTap &&
      now - lastTap.time < 280 &&
      Math.abs(lastTap.x - pointerArea.axisPosition * pointerArea.primarySize) < 80
    ) {
      handlePointerDoubleTap(pointerArea);
      lastTapRef.current = null;
      return;
    }

    pulseChrome();
    lastTapRef.current = {
      time: now,
      x: pointerArea.axisPosition * pointerArea.primarySize,
    };
  }

  function selectSource(source: CachedStreamSource) {
    const video = videoRef.current;
    resumeSnapshotRef.current = {
      time: video?.currentTime ?? 0,
      shouldPlay: video ? !video.paused : false,
    };
    dismissedRotateSourceUrlRef.current = null;
    setSelectedSourceUrl(source.url);
    pulseChrome();
  }

  function retryLoad() {
    if (streamCacheKey) {
      clearCachedStream(streamCacheKey);
    }

    dismissedRotateSourceUrlRef.current = null;
    setPreviewEnded(false);
    setRetryCount((value) => value + 1);
  }

  const shouldRotateImmersive = false;

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
            Menyiapkan Film
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
        <Button onClick={retryLoad}>
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
          Belum tersedia
        </p>
        <Button onClick={retryLoad}>
          <RotateCw className="size-4" />
          Coba lagi
        </Button>
      </div>
    );
  }

  return (
    <div
      onMouseMove={pulseChrome}
      onTouchStart={pulseChrome}
      onDoubleClick={handleDoubleClick}
      onTouchEnd={handleTouchEnd}
      className={cn(
        "relative aspect-video overflow-hidden bg-black ring-1 ring-white/10 sm:rounded-md",
        isImmersive &&
          "fixed inset-0 z-[90] h-[100dvh] w-screen overflow-hidden rounded-none bg-black ring-0",
      )}
    >
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center bg-black",
          shouldRotateImmersive &&
            "absolute left-1/2 top-1/2 h-[100vw] w-[100dvh] -translate-x-1/2 -translate-y-1/2 rotate-90 transform-gpu",
        )}
      >
        <video
          ref={videoRef}
          className="h-full w-full bg-black object-contain"
          poster={poster ?? undefined}
          playsInline
          controls
          crossOrigin="anonymous"
        >
          {(stream?.subtitles ?? []).map((subtitle) => (
            <track
              key={subtitle.src}
              kind="subtitles"
              src={subtitle.src}
              srcLang={subtitle.lang}
              label={subtitle.label}
              default={subtitle.default}
            />
          ))}
        </video>
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-20 transition-opacity duration-300",
            !isImmersive || showChrome
              ? "opacity-100"
              : "pointer-events-none opacity-0",
          )}
        >
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/85 via-black/30 to-transparent" />
          <div className="relative flex items-start justify-between gap-3 p-3">
            {isImmersive ? (
              <button
                type="button"
                onClick={closePlayer}
                data-haptic="medium"
                className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-black/65 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.38)] backdrop-blur"
              >
                <Minimize className="size-4" />
                Tutup
              </button>
            ) : (
              <div />
            )}

            <div className="flex max-w-[calc(100%-4rem)] flex-wrap justify-end gap-2">
              {sources.length > 1 ? (
                <div className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/10 bg-black/65 p-1 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {sources.map((source) => (
                    <button
                      key={source.url}
                      type="button"
                      onClick={() => selectSource(source)}
                      data-haptic="light"
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                        source.url === selectedSource?.url
                          ? "bg-white text-neutral-950"
                          : "bg-transparent text-neutral-100 hover:bg-white/10",
                      )}
                    >
                      {source.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {!isImmersive ? (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  data-haptic="medium"
                  className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-black/65 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.32)] backdrop-blur"
                >
                  <Expand className="size-4" />
                  Layar penuh
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {isImmersive ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-20 transition-opacity duration-300",
              showChrome ? "opacity-100" : "opacity-0",
            )}
          >
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          </div>
        ) : null}
        {showRotateGate && !previewEnded ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/72 px-2.5">
            <div className="w-full max-w-[17.25rem] rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.96),rgba(8,8,8,0.98))] p-3 text-center shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur sm:max-w-[18rem]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-200">
                Aktifkan Auto Rotate
              </p>
              {manualSources.length ? (
                <div className="mt-2.5 rounded-[12px] border border-white/8 bg-white/[0.04] p-2 text-left">
                  <p className="mt-1 text-[11px] leading-4 text-neutral-300">
                    Pilih resolusi di bawah ini.
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {manualSources.map((source) => (
                      <button
                        key={`rotate-gate-${source.url}`}
                        type="button"
                        data-haptic="light"
                        onClick={() => {
                          selectSource(source);
                          dismissedRotateSourceUrlRef.current = source.url;
                          setShowRotateGate(false);
                        }}
                        className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/15"
                      >
                        {source.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-haptic="light"
                  onClick={() => {
                    dismissedRotateSourceUrlRef.current = selectedSourceUrl;
                    setShowRotateGate(false);
                  }}
                  className="h-9 border border-white/10 bg-white/10 px-2 text-[12px] text-white hover:bg-white/15"
                >
                  Lanjutkan
                </Button>
                <Button
                  type="button"
                  size="sm"
                  data-haptic="medium"
                  onClick={() => {
                    dismissedRotateSourceUrlRef.current = selectedSourceUrl;
                    setShowRotateGate(false);
                    void toggleFullscreen();
                  }}
                  className="h-9 bg-red-600 px-2 text-[12px] text-white hover:bg-red-500"
                >
                  Buka fullscreen
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {previewEnded && !isVipActive && previewLimitSeconds > 0 ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/78 px-4">
            <div className="w-full max-w-[17.5rem] rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.96),rgba(8,8,8,0.98))] p-3.5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur sm:max-w-[18.5rem]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-200">
                Preview selesai
              </p>
              <h3 className="mt-2 text-lg font-bold text-white">
                {stream?.paywallTitle ?? "Lanjutkan dengan VIP"}
              </h3>
              <p className="mt-1.5 text-[13px] leading-5 text-neutral-300">
                {stream?.paywallDescription ??
                  "Upgrade VIP untuk lanjut nonton tanpa batas dan buka semua katalog premium."}
              </p>
              <p className="mt-1.5 text-[11px] leading-4 text-neutral-500">
                Batas preview untuk akun gratis: {formatPreviewLimit(previewLimitSeconds)}
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-haptic="light"
                  onClick={closePlayer}
                  className="h-9 border border-white/10 bg-white/10 px-2 text-[12px] text-white hover:bg-white/15"
                >
                  Kembali ke detail
                </Button>
                <Button
                  asChild
                  type="button"
                  size="sm"
                  data-haptic="medium"
                  className="h-9 bg-red-600 px-2 text-[12px] text-white hover:bg-red-500"
                >
                  <a href={stream?.upgradeUrl ?? "/vip"}>
                    {stream?.upgradeLabel ?? "Buka VIP"}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {seekFeedback ? (
          <div
            key={seekFeedback.key}
            className={cn(
              "pointer-events-none absolute flex items-center justify-center bg-black/15 text-white",
              shouldRotateImmersive
                ? "inset-x-0 h-1/2 w-full"
                : "inset-y-0 w-1/2",
              shouldRotateImmersive
                ? seekFeedback.direction === "backward"
                  ? "bottom-0"
                  : "top-0"
                : seekFeedback.direction === "backward"
                  ? "left-0"
                  : "right-0",
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
    </div>
  );
}
