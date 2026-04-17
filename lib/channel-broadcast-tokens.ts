const CHANNEL_BROADCAST_PREFIX = "post_";

export function buildChannelBroadcastStartParam(token: string) {
  return `${CHANNEL_BROADCAST_PREFIX}${token}`;
}

export function extractChannelBroadcastTokenFromStartParam(
  startParam: string | null,
) {
  if (!startParam) {
    return null;
  }

  const normalized = startParam.trim();
  const match = normalized.match(
    new RegExp(`(?:^|__)${CHANNEL_BROADCAST_PREFIX}([a-z0-9]+)`, "i"),
  );
  const token = match?.[1]?.trim().toLowerCase() ?? "";

  if (!token || !/^[a-z0-9]+$/i.test(token)) {
    return null;
  }

  return token;
}
