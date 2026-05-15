"use client";

import * as React from "react";
import { Bookmark, Check, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  isTelegramMiniAppBrowser,
  openTelegramShareComposer,
} from "@/lib/telegram-share-client";
import { cn } from "@/lib/utils";

type MovieActionButtonsProps = {
  authUrl?: string | null;
  initialSaved?: boolean;
  movieId: string;
  shareText?: string;
  shareUrl?: string;
  telegramShareUrl?: string | null;
  title: string;
  className?: string;
  requiresAuth?: boolean;
};

export function MovieActionButtons({
  authUrl,
  initialSaved = false,
  movieId,
  requiresAuth = false,
  shareText,
  shareUrl,
  telegramShareUrl,
  title,
  className,
}: MovieActionButtonsProps) {
  const router = useRouter();
  const [isSaved, setIsSaved] = React.useState(initialSaved);
  const [isSaving, setIsSaving] = React.useState(false);
  const [shareLabel, setShareLabel] = React.useState("Bagikan");
  const [isTelegram, setIsTelegram] = React.useState(false);

  React.useEffect(() => {
    setIsSaved(initialSaved);
  }, [initialSaved]);

  React.useEffect(() => {
    setIsTelegram(isTelegramMiniAppBrowser());
  }, []);

  async function toggleSave() {
    if (requiresAuth) {
      window.location.href = authUrl || "/admin/login";
      return;
    }

    const nextSaved = !isSaved;

    setIsSaving(true);
    setIsSaved(nextSaved);

    try {
      const response = await fetch("/api/library/favorites", {
        body: JSON.stringify({
          movieId,
          saved: nextSaved,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (response.status === 401) {
        setIsSaved(isSaved);
        router.push("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Gagal menyimpan film");
      }

      const payload = (await response.json()) as { saved?: boolean };
      setIsSaved(Boolean(payload.saved));
      router.refresh();
    } catch {
      setIsSaved(isSaved);
    } finally {
      setIsSaving(false);
    }
  }

  async function shareMovie() {
    const webUrl = shareUrl || window.location.href;
    const telegramUrl = telegramShareUrl || webUrl;
    const text = shareText || `Tonton ${title} di Layar BoxOffice`;

    try {
      if (isTelegramMiniAppBrowser()) {
        openTelegramShareComposer({
          text,
          url: telegramUrl,
        });
      } else if (navigator.share) {
        await navigator.share({
          title,
          text,
          url: webUrl,
        });
      } else {
        await navigator.clipboard.writeText(webUrl);
        setShareLabel("Link tersalin");
        window.setTimeout(() => setShareLabel("Bagikan"), 1600);
      }
    } catch {
      // User cancelled the native share sheet.
    }
  }

  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:flex", className)}>
      <Button
        type="button"
        variant="secondary"
        onClick={toggleSave}
        data-haptic={isSaved ? "success" : "light"}
        disabled={isSaving}
        className="h-12 border border-white/10 bg-white/10 px-4 text-white hover:bg-white/15"
        aria-pressed={isSaved}
      >
        {isSaved ? <Check className="size-4" /> : <Bookmark className="size-4" />}
        {isSaved ? "Tersimpan" : "Simpan"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={shareMovie}
        data-haptic="light"
        className="h-12 border border-white/10 bg-white/10 px-4 text-white hover:bg-white/15"
      >
        <Share2 className="size-4" />
        {isTelegram ? "Bagikan Telegram" : shareLabel}
      </Button>
    </div>
  );
}
