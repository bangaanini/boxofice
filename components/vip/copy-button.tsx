"use client";

import * as React from "react";
import { Copy, CopyCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CopyButton({
  label = "Salin",
  value,
}: {
  label?: string;
  value: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={handleCopy}
      data-haptic="light"
      className="h-12 rounded-[16px] border border-indigo-400/20 bg-indigo-500/15 px-4 text-white hover:bg-indigo-500/20"
    >
      {copied ? <CopyCheck className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Tersalin" : label}
    </Button>
  );
}
