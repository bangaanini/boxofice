import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPlaylistUrl(url: string) {
  return decodeURIComponent(url).toLowerCase().includes(".m3u8");
}

function proxiedUrl(url: string) {
  return `/api/hls?url=${encodeURIComponent(url)}`;
}

function rewritePlaylist(playlist: string, playlistUrl: string) {
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
          return `URI="${proxiedUrl(absolute)}"`;
        });
      }

      return proxiedUrl(new URL(trimmed, playlistUrl).toString());
    })
    .join("\n");
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
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

  const response = await fetch(upstreamUrl, {
    headers: {
      Accept: "*/*",
      "User-Agent": "Mozilla/5.0 Boxofice/1.0",
      Referer: upstreamUrl.origin,
    },
    next: {
      revalidate: isPlaylistUrl(upstreamUrl.toString()) ? 300 : 0,
    },
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    return NextResponse.json(
      { error: `Upstream media failed with ${response.status}` },
      { status: 502 },
    );
  }

  if (
    isPlaylistUrl(upstreamUrl.toString()) ||
    contentType.includes("mpegurl") ||
    contentType.includes("application/vnd.apple")
  ) {
    const playlist = await response.text();
    const rewritten = rewritePlaylist(playlist, upstreamUrl.toString());

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

  return new NextResponse(response.body, {
    headers: {
      "Content-Type": contentType || "video/mp2t",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=300",
    },
  });
}
