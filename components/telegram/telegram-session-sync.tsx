"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
};

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
};

function getTelegramWebApp() {
  if (typeof window === "undefined") {
    return null;
  }

  return (window as TelegramWindow).Telegram?.WebApp ?? null;
}

function readInitDataIdentity(initData: string) {
  const params = new URLSearchParams(initData);
  const userRaw = params.get("user");

  if (!userRaw) {
    return null;
  }

  try {
    const user = JSON.parse(userRaw) as { id?: number | string };
    const telegramId = user.id ? String(user.id) : "";

    if (!telegramId) {
      return null;
    }

    return {
      authDate: params.get("auth_date") ?? "",
      startParam: params.get("start_param") ?? "",
      telegramId,
    };
  } catch {
    return null;
  }
}

export function TelegramSessionSync() {
  const router = useRouter();
  const [isSwitchingAccount, setIsSwitchingAccount] = React.useState(false);

  React.useEffect(() => {
    const webApp = getTelegramWebApp();
    const initData = webApp?.initData?.trim();

    if (!initData) {
      return;
    }

    webApp?.ready?.();

    const identity = readInitDataIdentity(initData);

    if (!identity) {
      return;
    }

    const activeIdentity = identity;
    const storageKey = [
      "boxofice_telegram_sync",
      activeIdentity.telegramId,
      activeIdentity.authDate,
      activeIdentity.startParam,
    ].join(":");
    const lastTelegramId = window.localStorage.getItem(
      "boxofice_last_telegram_id",
    );
    const alreadySynced = window.sessionStorage.getItem(storageKey) === "1";
    const shouldShowOverlay =
      Boolean(lastTelegramId) && lastTelegramId !== activeIdentity.telegramId;

    if (alreadySynced) {
      return;
    }

    let cancelled = false;

    async function syncTelegramSession() {
      if (shouldShowOverlay) {
        setIsSwitchingAccount(true);
      }

      try {
        const response = await fetch("/api/telegram/auth", {
          body: JSON.stringify({ initData }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean }
          | null;

        if (!response.ok || !payload?.ok || cancelled) {
          return;
        }

        window.sessionStorage.setItem(storageKey, "1");
        window.localStorage.setItem(
          "boxofice_last_telegram_id",
          activeIdentity.telegramId,
        );
        router.refresh();
      } finally {
        if (!cancelled) {
          setIsSwitchingAccount(false);
        }
      }
    }

    void syncTelegramSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!isSwitchingAccount) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 px-6 text-center text-white backdrop-blur-md">
      <div>
        <div className="mx-auto size-10 animate-spin rounded-full border-2 border-red-500/25 border-t-red-500" />
        <p className="mt-5 text-base font-semibold">
          Menyesuaikan akun Telegram...
        </p>
        <p className="mt-2 text-sm leading-6 text-neutral-400">
          Kami sedang mengganti session ke akun Telegram yang sedang kamu pakai.
        </p>
      </div>
    </div>
  );
}
