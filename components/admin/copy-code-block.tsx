"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/simple-toast";

async function copyText(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard tidak tersedia.");
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const successful = document.execCommand("copy");
    if (!successful) {
      throw new Error("Gagal menyalin teks.");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

export function CopyCodeBlock({
  code,
  copyValue,
  title,
}: {
  code: string;
  copyValue?: string;
  title: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const [isCopying, setIsCopying] = React.useState(false);

  async function handleCopy() {
    try {
      setIsCopying(true);
      await copyText(copyValue ?? code);
      setCopied(true);
      showToast(`${title} berhasil disalin.`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      showToast(`Gagal menyalin ${title.toLowerCase()}.`, "error");
    } finally {
      setIsCopying(false);
    }
  }

  return (
    <div className="rounded-[18px] border border-white/10 bg-black/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
          {title}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={handleCopy}
          disabled={isCopying}
          data-haptic="light"
          className="h-9 rounded-[12px] border border-white/10 bg-white/10 px-3 text-xs text-white hover:bg-white/15"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {isCopying ? "Menyalin..." : copied ? "Tersalin" : "Salin"}
        </Button>
      </div>
      <pre className="mt-3 overflow-x-auto whitespace-pre text-xs leading-6 text-neutral-200">
        {code}
      </pre>
    </div>
  );
}
