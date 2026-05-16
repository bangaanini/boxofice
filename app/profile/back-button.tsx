"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";

export function ProfileBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Kembali"
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-neutral-200 transition hover:bg-white/[0.12] hover:text-white"
    >
      <X className="size-4" />
    </button>
  );
}
