import { NextResponse, type NextRequest } from "next/server";

import { verifyPlaybackAccessToken } from "@/lib/vip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBTITLE_HOST_ALLOWLIST = new Set([
  "cacdn.hakunaymatata.com",
  "cdn.aoneroom.com",
]);

function srtToVtt(input: string) {
  const normalized = input.replace(/\r\n?/g, "\n");
  const withoutBom = normalized.replace(/^﻿/, "");
  const cueText = withoutBom
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
    .replace(
      /^\s*\d+\s*\n(\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3})/gm,
      "$1",
    );

  return `WEBVTT\n\n${cueText.trimStart()}`;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const token = request.nextUrl.searchParams.get("token");

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  if (token) {
    try {
      verifyPlaybackAccessToken(token);
    } catch {
      // Soft-fail: subtitle proxy boleh tetap dilayani; akses video utama tetap di /api/stream.
    }
  }

  let upstream: URL;

  try {
    upstream = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!["https:", "http:"].includes(upstream.protocol)) {
    return NextResponse.json({ error: "Unsupported url" }, { status: 400 });
  }

  if (!SUBTITLE_HOST_ALLOWLIST.has(upstream.hostname)) {
    return NextResponse.json(
      { error: "Subtitle host tidak diizinkan." },
      { status: 403 },
    );
  }

  let response: Response;

  try {
    response = await fetch(upstream, {
      cache: "no-store",
      headers: {
        Accept: "*/*",
        "User-Agent": "Mozilla/5.0 Boxofice/1.0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Subtitle gagal di-load.",
      },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: `Subtitle upstream error ${response.status}` },
      { status: 502 },
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  const isAlreadyVtt =
    contentType.toLowerCase().includes("vtt") ||
    upstream.pathname.toLowerCase().endsWith(".vtt") ||
    body.startsWith("WEBVTT");
  const vtt = isAlreadyVtt ? body : srtToVtt(body);

  return new NextResponse(vtt, {
    headers: {
      "Cache-Control": "public, max-age=600, s-maxage=3600",
      "Content-Type": "text/vtt; charset=utf-8",
    },
  });
}
