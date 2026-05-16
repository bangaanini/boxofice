type TelegramWebApp = {
  initData?: string;
  openLink?: (
    url: string,
    options?: {
      try_browser?: boolean;
      try_instant_view?: boolean;
    },
  ) => void;
  openTelegramLink?: (url: string) => void;
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

export function isTelegramMiniAppBrowser() {
  return Boolean(getTelegramWebApp()?.initData?.trim());
}

export function buildTelegramShareComposerUrl(input: {
  text?: string | null;
  url: string;
}) {
  const composerUrl = new URL("https://t.me/share/url");

  composerUrl.searchParams.set("url", input.url);

  if (input.text?.trim()) {
    composerUrl.searchParams.set("text", input.text.trim());
  }

  return composerUrl.toString();
}

export function openTelegramShareComposer(input: {
  text?: string | null;
  url: string;
}) {
  const composerUrl = buildTelegramShareComposerUrl(input);
  const webApp = getTelegramWebApp();

  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(composerUrl);
    return true;
  }

  if (webApp?.openLink) {
    webApp.openLink(composerUrl, { try_browser: false, try_instant_view: false });
    return true;
  }

  if (typeof window !== "undefined") {
    window.open(composerUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  return false;
}
