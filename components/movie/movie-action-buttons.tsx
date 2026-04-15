"use client";

import * as React from "react";
import { Bookmark, Check, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MovieActionButtonsProps = {
  initialSaved?: boolean;
  movieId: string;
  title: string;
  className?: string;
};

export function MovieActionButtons({
  initialSaved = false,
  movieId,
  title,
  className,
}: MovieActionButtonsProps) {
  const router = useRouter();
  const [isSaved, setIsSaved] = React.useState(initialSaved);
  const [isSaving, setIsSaving] = React.useState(false);
  const [shareLabel, setShareLabel] = React.useState("Bagikan");

  React.useEffect(() => {
    setIsSaved(initialSaved);
  }, [initialSaved]);

  async function toggleSave() {
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
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `Tonton ${title} di Box Office`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
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
        {shareLabel}
      </Button>
    </div>
  );
}
