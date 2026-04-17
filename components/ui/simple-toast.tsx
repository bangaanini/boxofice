"use client";

import * as React from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastPayload = {
  message: string;
  type?: "success" | "error";
};

const TOAST_EVENT = "boxoffice:toast";

export function showToast(message: string, type: "success" | "error" = "success") {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ToastPayload>(TOAST_EVENT, {
      detail: { message, type },
    }),
  );
}

export function SimpleToastViewport() {
  const [toast, setToast] = React.useState<ToastPayload | null>(null);

  React.useEffect(() => {
    let timeoutId: number | undefined;

    function handleToast(event: Event) {
      const payload = (event as CustomEvent<ToastPayload>).detail;
      setToast(payload);

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        setToast(null);
      }, 2200);
    }

    window.addEventListener(TOAST_EVENT, handleToast as EventListener);

    return () => {
      window.removeEventListener(TOAST_EVENT, handleToast as EventListener);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  if (!toast) {
    return null;
  }

  const isError = toast.type === "error";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex justify-center px-4">
      <div
        className={cn(
          "flex min-h-12 items-center gap-2 rounded-[14px] border px-4 py-3 text-sm font-medium text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur",
          isError
            ? "border-red-400/25 bg-red-500/85"
            : "border-emerald-400/20 bg-emerald-500/85",
        )}
      >
        {isError ? (
          <CircleAlert className="size-4 shrink-0" />
        ) : (
          <CheckCircle2 className="size-4 shrink-0" />
        )}
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
