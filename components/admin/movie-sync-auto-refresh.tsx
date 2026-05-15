"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

export function MovieSyncAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  React.useEffect(() => {
    if (!active) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [active, router]);

  return null;
}
