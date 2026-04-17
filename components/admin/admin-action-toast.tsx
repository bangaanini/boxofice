"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { showToast } from "@/components/ui/simple-toast";

const TOAST_MESSAGE_PARAM = "message";

export function AdminActionToast() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastToastKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!pathname.startsWith("/admin")) {
      return;
    }

    const message = searchParams.get(TOAST_MESSAGE_PARAM);
    if (!message) {
      return;
    }

    const serialized = searchParams.toString();
    const toastKey = `${pathname}?${serialized}`;
    if (lastToastKeyRef.current === toastKey) {
      return;
    }

    const hasError = searchParams
      .entries()
      .some(([key, value]) => key !== TOAST_MESSAGE_PARAM && value === "error");

    showToast(message, hasError ? "error" : "success");
    lastToastKeyRef.current = toastKey;
  }, [pathname, searchParams]);

  return null;
}
