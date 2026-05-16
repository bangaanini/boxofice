"use client";

import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { LogIn, MessageCircle } from "lucide-react";

import appIcon from "@/app/icon.png";
import { TelegramAwareUserAvatar } from "@/components/navigation/telegram-aware-user-avatar";

type TelegramWebApp = {
  initData?: string;
};

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
};

function isTelegramMiniAppBrowser() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(
    (window as TelegramWindow).Telegram?.WebApp?.initData?.trim(),
  );
}

function BrandIdentity() {
  return (
    <Link href="/" prefetch className="flex min-w-0 items-center gap-3">
      <span className="relative size-11 shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
        <Image
          src={appIcon}
          alt=""
          fill
          sizes="44px"
          className="object-cover"
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold text-white">
          Layar Box Office
        </span>

      </span>
    </Link>
  );
}

type MobileHomeIdentityProps = {
  displayName?: string | null;
  isAuthenticated: boolean;
  photoUrl?: string | null;
  usernameLabel?: string | null;
};

export function MobileHomeIdentity({
  displayName,
  isAuthenticated,
  photoUrl,
  usernameLabel,
}: MobileHomeIdentityProps) {
  const [isMiniApp, setIsMiniApp] = React.useState(false);

  React.useEffect(() => {
    setIsMiniApp(isTelegramMiniAppBrowser());
  }, []);

  if (isMiniApp) {
    if (isAuthenticated && displayName) {
      return (
        <div className="flex items-center gap-3">
          <TelegramAwareUserAvatar
            alt={displayName}
            className="size-11"
            fallbackChar={displayName.charAt(0).toUpperCase()}
            photoUrl={photoUrl}
          />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">
              {displayName}
            </p>
            <p className="truncate text-xs text-neutral-400">
              {usernameLabel}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-white">Box Office</p>
          <p className="text-xs text-neutral-400">Pratinjau katalog publik</p>
        </div>
        <Link
          href="/login-telegram"
          prefetch={false}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-red-400/30 bg-red-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-red-500"
        >
          <MessageCircle className="size-4" />
          Buka via Telegram
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <BrandIdentity />
      {!isAuthenticated ? (
        <Link
          href="/login"
          prefetch
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-red-400/30 bg-red-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-red-500"
        >
          <LogIn className="size-4" />
          Login / Daftar
        </Link>
      ) : null}
    </div>
  );
}
