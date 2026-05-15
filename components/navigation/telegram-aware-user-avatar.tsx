"use client";

import Image from "next/image";
import * as React from "react";

import appIcon from "@/app/icon.png";

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

type TelegramAwareUserAvatarProps = {
  alt: string;
  className?: string;
  fallbackChar: string;
  fallbackClassName?: string;
  imageSizes?: string;
  photoUrl?: string | null;
};

export function TelegramAwareUserAvatar({
  alt,
  className,
  fallbackChar,
  fallbackClassName = "text-sm font-semibold text-white",
  imageSizes = "44px",
  photoUrl,
}: TelegramAwareUserAvatarProps) {
  const [isMiniApp, setIsMiniApp] = React.useState(false);

  React.useEffect(() => {
    setIsMiniApp(isTelegramMiniAppBrowser());
  }, []);

  return (
    <span
      className={[
        "relative flex shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isMiniApp && photoUrl ? (
        <Image
          src={photoUrl}
          alt={alt}
          fill
          unoptimized
          sizes={imageSizes}
          className="object-cover"
        />
      ) : isMiniApp ? (
        <span
          className={[
            "flex h-full w-full items-center justify-center",
            fallbackClassName,
          ].join(" ")}
        >
          {fallbackChar}
        </span>
      ) : (
        <Image
          src={appIcon}
          alt=""
          fill
          sizes={imageSizes}
          className="object-cover"
        />
      )}
    </span>
  );
}
