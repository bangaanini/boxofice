"use client";

import * as React from "react";
import { Download, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

type TelegramHomeScreenStatus =
  | "added"
  | "checking"
  | "missed"
  | "unknown"
  | "unsupported";

type TelegramWebApp = {
  addToHomeScreen?: () => void;
  checkHomeScreenStatus?: (callback?: (status: TelegramHomeScreenStatus) => void) => void;
  isVersionAtLeast?: (version: string) => boolean;
  offEvent?: (eventType: string, eventHandler: (...args: unknown[]) => void) => void;
  onEvent?: (eventType: string, eventHandler: (...args: unknown[]) => void) => void;
};

function isIosDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (typeof navigator !== "undefined" &&
      "standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isTelegramMiniApp() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(
    (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp,
  );
}

function getTelegramWebApp() {
  if (typeof window === "undefined") {
    return null;
  }

  return (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram
    ?.WebApp ?? null;
}

export function AddToHomeScreenCard() {
  const [deferredPrompt, setDeferredPrompt] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [isInstalled, setIsInstalled] = React.useState(false);

  React.useEffect(() => {
    setIsInstalled(isStandaloneDisplayMode());
    const telegramWebApp = getTelegramWebApp();

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setFeedback("Aplikasi sudah ditambahkan ke layar utama.");
    }

    function handleTelegramStatus(status?: unknown) {
      if (status === "added") {
        setIsInstalled(true);
        setFeedback("Layar BoxOffice sudah ditambahkan ke layar utama.");
        return;
      }

      if (status === "checking") {
        setFeedback("Telegram sedang menyiapkan pilihan tambah ke layar utama.");
        return;
      }

      if (status === "missed") {
        setFeedback(
          "Tambahkan ke layar utama.",
        );
        return;
      }

      if (status === "unsupported") {
        setFeedback(
          "Versi Telegram ini belum mendukung tombol homescreen otomatis.",
        );
      }
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Telegram homescreen API hanya tersedia di Telegram client v8+. Hindari panggil
    // method-nya di browser biasa atau Telegram lama supaya tidak bocor warning.
    const telegramSupportsHomescreen = Boolean(
      telegramWebApp?.isVersionAtLeast?.("8.0"),
    );

    if (telegramSupportsHomescreen && telegramWebApp) {
      telegramWebApp.onEvent?.("homeScreenAdded", onInstalled);
      telegramWebApp.onEvent?.(
        "homeScreenChecked",
        handleTelegramStatus as (...args: unknown[]) => void,
      );
      try {
        telegramWebApp.checkHomeScreenStatus?.(handleTelegramStatus);
      } catch {
        // Telegram lama bisa throw walau method ada di prototype.
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);

      if (telegramSupportsHomescreen && telegramWebApp) {
        telegramWebApp.offEvent?.("homeScreenAdded", onInstalled);
        telegramWebApp.offEvent?.(
          "homeScreenChecked",
          handleTelegramStatus as (...args: unknown[]) => void,
        );
      }
    };
  }, []);

  async function installApp() {
    if (isInstalled) {
      setFeedback("Layar BoxOffice sudah tersedia di layar utama perangkat ini.");
      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);

      if (choice?.outcome === "accepted") {
        setFeedback("Sip, Layar BoxOffice sedang ditambahkan ke layar utama.");
      } else {
        setFeedback("Kamu bisa pasang lagi kapan saja dari tombol ini.");
      }

      setDeferredPrompt(null);
      return;
    }

    if (isTelegramMiniApp()) {
      const telegramWebApp = getTelegramWebApp();
      const supportsAddToHomeScreen = Boolean(
        telegramWebApp?.isVersionAtLeast?.("8.0"),
      );

      if (supportsAddToHomeScreen && telegramWebApp?.addToHomeScreen) {
        try {
          telegramWebApp.addToHomeScreen();
          setFeedback("Telegram sedang membuka prompt homescreen.");
          return;
        } catch {
          // Telegram lama bisa throw walau method ada di prototype.
        }
      }

      setFeedback("Telegram di perangkat ini belum membuka prompt homescreen otomatis.");
      return;
    }

    if (isIosDevice()) {
      setFeedback(
        "Di iPhone atau iPad, buka menu Share lalu pilih Add to Home Screen.",
      );
      return;
    }

    setFeedback(
      "Buka menu browser lalu pilih Install app atau Add to Home Screen.",
    );
  }

  if (isInstalled) {
    return null;
  }

  return (
    <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.05] p-4">
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
        <Smartphone className="size-4 text-red-300" />
        Tambahkan ke homescreen
      </p>
      <p className="mt-2 text-sm leading-6 text-neutral-300">
        Pasang Layar BoxOffice ke layar utama.
      </p>
      <Button
        type="button"
        onClick={() => void installApp()}
        data-haptic="light"
        className="mt-4 h-11 bg-red-600 text-white hover:bg-red-500"
      >
        <Download className="size-4" />
        {isInstalled ? "Sudah terpasang" : "Tambahkan sekarang"}
      </Button>
      {feedback ? (
        <p className="mt-3 text-sm leading-6 text-neutral-400">{feedback}</p>
      ) : null}
    </div>
  );
}
