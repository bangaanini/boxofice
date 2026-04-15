"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

type TelegramBackButton = {
  hide?: () => void;
  offClick?: (callback: () => void) => void;
  onClick?: (callback: () => void) => void;
  show?: () => void;
};

type TelegramClosingBehavior = {
  disableConfirmation?: () => void;
  enableConfirmation?: () => void;
};

type TelegramWebApp = {
  BackButton?: TelegramBackButton;
  ClosingBehavior?: TelegramClosingBehavior;
  disableVerticalSwipes?: () => void;
  expand?: () => void;
  ready?: () => void;
  setBackgroundColor?: (color: string) => void;
  setHeaderColor?: (color: string) => void;
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

function shouldManageTelegramChrome(pathname: string) {
  return !pathname.startsWith("/admin");
}

function shouldShowBackButton(pathname: string) {
  if (pathname === "/") {
    return false;
  }

  if (pathname.startsWith("/admin")) {
    return false;
  }

  return true;
}

export function TelegramAppChrome() {
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    const webApp = getTelegramWebApp();

    if (!webApp || !shouldManageTelegramChrome(pathname)) {
      return;
    }

    webApp.ready?.();
    webApp.expand?.();
    webApp.disableVerticalSwipes?.();
    webApp.setBackgroundColor?.("#050505");
    webApp.setHeaderColor?.("#050505");

    const backButton = webApp.BackButton;
    const closingBehavior = webApp.ClosingBehavior;
    const showBackButton = shouldShowBackButton(pathname);

    function handleBack() {
      if (document.body.dataset.playerImmersive === "true") {
        window.dispatchEvent(new CustomEvent("boxofice-immersive-back"));
        return;
      }

      if (window.history.length > 1) {
        router.back();
        return;
      }

      router.push("/");
    }

    if (showBackButton) {
      backButton?.show?.();
      backButton?.onClick?.(handleBack);
      closingBehavior?.enableConfirmation?.();
    } else {
      backButton?.hide?.();
      closingBehavior?.disableConfirmation?.();
    }

    return () => {
      backButton?.offClick?.(handleBack);
    };
  }, [pathname, router]);

  return null;
}
