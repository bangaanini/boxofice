"use client";

import * as React from "react";

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function PaymentCountdown({
  expiresAt,
}: {
  expiresAt: string | null;
}) {
  const [remaining, setRemaining] = React.useState(() => {
    if (!expiresAt) {
      return null;
    }

    return Math.max(new Date(expiresAt).getTime() - Date.now(), 0);
  });

  React.useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRemaining(Math.max(new Date(expiresAt).getTime() - Date.now(), 0));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [expiresAt]);

  if (remaining === null) {
    return null;
  }

  return (
    <div className="inline-flex min-w-28 items-center justify-center rounded-full border border-indigo-400/20 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-100">
      {formatRemaining(remaining)}
    </div>
  );
}
