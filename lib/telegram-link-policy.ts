export function isTelegramHostname(hostname: string) {
  return hostname === "t.me" || hostname === "telegram.me";
}

export function getTelegramDeepLinkPayload(url: URL) {
  if (!isTelegramHostname(url.hostname)) {
    return null;
  }

  const payload =
    url.searchParams.get("startapp") ?? url.searchParams.get("start");

  if (payload == null) {
    return null;
  }

  return payload.trim();
}

export function isDynamicTelegramDeepLink(url: URL) {
  const payload = getTelegramDeepLinkPayload(url);

  if (!payload) {
    return false;
  }

  return payload.includes("__");
}
