import { NextResponse, type NextRequest } from "next/server";

import { verifyPlaybackAccessToken } from "@/lib/vip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPlaylistUrl(url: string) {
  return decodeURIComponent(url).toLowerCase().includes(".m3u8");
}

function proxiedUrl(url: string, token: string) {
  const params = new URLSearchParams({
    token,
    url,
  });

  return `/api/hls?${params.toString()}`;
}

function rewritePlaylist(playlist: string, playlistUrl: string, token: string) {
  return playlist
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return line;
      }

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          const absolute = new URL(uri, playlistUrl).toString();
          return `URI="${proxiedUrl(absolute, token)}"`;
        });
      }

      return proxiedUrl(new URL(trimmed, playlistUrl).toString(), token);
    })
    .join("\n");
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "Missing playback token" }, { status: 401 });
  }

  try {
    verifyPlaybackAccessToken(token);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Token playback tidak valid.",
      },
      { status: 402 },
    );
  }

  let upstreamUrl: URL;

  try {
    upstreamUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!["https:", "http:"].includes(upstreamUrl.protocol)) {
    return NextResponse.json({ error: "Unsupported url" }, { status: 400 });
  }

  const range = request.headers.get("range");
  const isPlaylist = isPlaylistUrl(upstreamUrl.toString());
  const response = await fetch(upstreamUrl, {
    cache: isPlaylist ? undefined : "no-store",
    headers: {
      Accept: "*/*",
      ...(range ? { Range: range } : {}),
      "User-Agent": "Mozilla/5.0 Boxofice/1.0",
      Referer: upstreamUrl.origin,
    },
    ...(isPlaylist ? { next: { revalidate: 300 } } : {}),
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    return NextResponse.json(
      { error: `Upstream media failed with ${response.status}` },
      { status: 502 },
    );
  }

  if (
    isPlaylist ||
    contentType.includes("mpegurl") ||
    contentType.includes("application/vnd.apple")
  ) {
    const playlist = await response.text();
    const rewritten = rewritePlaylist(playlist, upstreamUrl.toString(), token);

    return new NextResponse(rewritten, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "s-maxage=300, stale-while-revalidate=60",
      },
    });
  }

  if (contentType.includes("text/html")) {
    return NextResponse.json(
      { error: "Upstream returned HTML instead of media" },
      { status: 502 },
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType || "video/mp2t");
  headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=300");

  for (const header of [
    "accept-ranges",
    "content-length",
    "content-range",
  ]) {
    const value = response.headers.get(header);

    if (value) {
      headers.set(header, value);
    }
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      ...Object.fromEntries(headers.entries()),
    },
  });
}
