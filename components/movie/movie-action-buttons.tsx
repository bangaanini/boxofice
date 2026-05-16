"use client";

import * as React from "react";
import { Bookmark, Check, Copy, MessageCircle, Send, Share2, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  buildTelegramShareComposerUrl,
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
  const [isShareOpen, setIsShareOpen] = React.useState(false);
  const [shareLabel, setShareLabel] = React.useState("Bagikan");
  const [isTelegram, setIsTelegram] = React.useState(false);
  const webUrl = shareUrl || "";
  const text = shareText || `Tonton ${title} di Layar BoxOffice`;
  const resolvedWebUrl =
    webUrl || (typeof window !== "undefined" ? window.location.href : "");
  const telegramUrl = telegramShareUrl || resolvedWebUrl;
  const encodedWebUrl = encodeURIComponent(resolvedWebUrl);
  const encodedText = encodeURIComponent(text);

  React.useEffect(() => {
    setIsSaved(initialSaved);
  }, [initialSaved]);

  React.useEffect(() => {
    setIsTelegram(isTelegramMiniAppBrowser());
  }, []);

  React.useEffect(() => {
    if (!isShareOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsShareOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isShareOpen]);

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
    try {
      if (isTelegramMiniAppBrowser()) {
        openTelegramShareComposer({
          text,
          url: telegramUrl,
        });
      } else {
        setIsShareOpen(true);
      }
    } catch {
      // User cancelled the native share sheet.
    }
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(resolvedWebUrl);
      setShareLabel("Link tersalin");
      window.setTimeout(() => setShareLabel("Bagikan"), 1600);
    } catch {
      setShareLabel("Gagal salin");
      window.setTimeout(() => setShareLabel("Bagikan"), 1600);
    }
  }

  const socialLinks = [
    {
      href: `https://wa.me/?text=${encodeURIComponent(`${text}\n${resolvedWebUrl}`)}`,
      icon: MessageCircle,
      label: "WhatsApp",
    },
    {
      href: buildTelegramShareComposerUrl({
        text,
        url: resolvedWebUrl,
      }),
      icon: Send,
      label: "Telegram",
    },
    {
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedWebUrl}`,
      icon: Share2,
      label: "Facebook",
    },
    {
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedWebUrl}`,
      icon: X,
      label: "X",
    },
  ];

  return (
    <>
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

      {isShareOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-10 sm:items-center sm:pb-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="movie-share-title"
          onClick={() => setIsShareOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[24px] border border-white/10 bg-neutral-950 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="movie-share-title"
                  className="text-lg font-bold text-white"
                >
                  Bagikan film
                </h2>
                <p className="mt-1 text-sm leading-6 text-neutral-400">
                  Pilih aplikasi atau salin link untuk dibagikan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsShareOpen(false)}
                className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white"
                aria-label="Tutup"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {socialLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </a>
                );
              })}
            </div>

            <div className="mt-4 rounded-[14px] border border-white/10 bg-black/35 p-2">
              <p className="truncate px-2 py-1 text-xs text-neutral-400">
                {resolvedWebUrl}
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={copyShareLink}
                className="mt-2 h-11 w-full border border-white/10 bg-white/10 text-white hover:bg-white/15"
              >
                <Copy className="size-4" />
                Salin link
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
