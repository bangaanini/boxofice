"use client";

import { RefreshCw } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SyncSubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  target: string;
};

export function SyncSubmitButton({
  label,
  pendingLabel = "Menyinkronkan...",
  target,
}: SyncSubmitButtonProps) {
  const { data, pending } = useFormStatus();
  const activeTarget = data?.get("target");
  const isActive = pending && activeTarget === target;

  return (
    <Button
      type="submit"
      name="target"
      value={target}
      variant="secondary"
      disabled={pending}
      aria-busy={isActive}
      className={cn(
        "h-12 w-full border border-white/10 bg-white/10 text-white hover:bg-white/15",
        pending && "cursor-not-allowed opacity-70",
      )}
    >
      <RefreshCw className={cn("size-4", isActive && "animate-spin")} />
      {isActive ? pendingLabel : label}
    </Button>
  );
}
