"use client";

import * as React from "react";
import Link from "next/link";
import { MessageCircle, ShieldCheck, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { extractChannelBroadcastTokenFromStartParam } from "@/lib/channel-broadcast-tokens";
import { extractMovieIdFromStartParam } from "@/lib/telegram-miniapp";

type TelegramWebApp = {
  disableVerticalSwipes?: () => void;
  expand?: () => void;
  initData?: string;
  ready?: () => void;
  setBackgroundColor?: (color: string) => void;
  setHeaderColor?: (color: string) => void;
};

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
};

type TelegramEntryGateProps = {
  adminLoginUrl: string;
  botChatUrl: string;
  miniAppUrl: string;
  successRedirectPath?: string;
};

function getTelegramWebApp() {
  if (typeof window === "undefined") {
    return null;
  }

  return (window as TelegramWindow).Telegram?.WebApp ?? null;
}

function readStartParamFromLocation() {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);

  return (
    params.get("start_param") ??
    params.get("startapp") ??
    params.get("tgWebAppStartParam") ??
    params.get("ref") ??
    ""
  );
}

function readStartParamFromInitData(initData: string | undefined) {
  if (!initData) {
    return "";
  }

  return new URLSearchParams(initData).get("start_param") ?? "";
}

function getTelegramStartTargetPath(startParam?: string | null) {
  const resolvedStartParam = startParam || readStartParamFromLocation();
  const movieId = extractMovieIdFromStartParam(resolvedStartParam);

  if (movieId) {
    return `/movie/${movieId}`;
  }

  const broadcastToken = extractChannelBroadcastTokenFromStartParam(
    resolvedStartParam,
  );

  if (broadcastToken) {
    return "/";
  }

  return null;
}

export function TelegramEntryGate({
  adminLoginUrl,
  botChatUrl,
  miniAppUrl,
  successRedirectPath = "/",
}: TelegramEntryGateProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState(
    "Menyambungkan akun Telegram kamu...",
  );
  const [isLoading, setIsLoading] = React.useState(true);

  const authenticateWithTelegram = React.useCallback(async () => {
    const webApp = getTelegramWebApp();
    const initData = webApp?.initData?.trim();
    const resolvedStartParam =
      readStartParamFromLocation() || readStartParamFromInitData(initData);

    if (!initData) {
      setStatus("Membuka bot Telegram...");
      setIsLoading(false);

      window.setTimeout(() => {
        window.location.replace(botChatUrl);
      }, 900);

      return;
    }

    setError(null);
    setIsLoading(true);
    setStatus("Memverifikasi akun Telegram kamu...");

    try {
      const response = await fetch("/api/telegram/auth", {
        body: JSON.stringify({
          initData,
          startParam: resolvedStartParam,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

        const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            ok?: boolean;
            redirectPath?: string | null;
          }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error ??
            "Mini App belum bisa menyambungkan akun Telegram sekarang.",
        );
      }

      setStatus("Akun siap. Membuka Box Office...");
      window.location.replace(
        payload?.redirectPath ??
          getTelegramStartTargetPath(resolvedStartParam) ??
          successRedirectPath,
      );
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Gagal masuk dengan Telegram.",
      );
      setStatus("Koneksi Telegram butuh dicoba lagi.");
      setIsLoading(false);
    }
  }, [botChatUrl, successRedirectPath]);

  React.useEffect(() => {
    const webApp = getTelegramWebApp();

    webApp?.ready?.();
    webApp?.expand?.();
    webApp?.disableVerticalSwipes?.();
    webApp?.setBackgroundColor?.("#050505");
    webApp?.setHeaderColor?.("#050505");

    void authenticateWithTelegram();
  }, [authenticateWithTelegram]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(220,38,38,0.2),transparent_26%),radial-gradient(circle_at_50%_18%,rgba(255,115,0,0.16),transparent_32%),linear-gradient(180deg,#120909_0%,#050505_58%,#020202_100%)]" />

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.9),rgba(8,8,8,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl">
          <div className="inline-flex rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-red-200">
            Telegram Mini App
          </div>

          <h1 className="mt-5 text-4xl font-black leading-none text-white">
            Box Office hidup di Telegram
          </h1>
          <p className="mt-4 text-sm leading-7 text-neutral-300">
            User tidak perlu signup lagi. Begitu Mini App dibuka dari bot,
            akun Telegram akan langsung dipakai sebagai identitas masuk.
          </p>

          <div className="mt-6 rounded-[22px] border border-white/10 bg-black/30 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-red-500/10 text-red-200 ring-1 ring-red-400/20">
                {isLoading ? (
                  <span className="size-5 animate-spin rounded-full border-2 border-red-400/25 border-t-red-400" />
                ) : (
                  <Smartphone className="size-5" />
                )}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{status}</p>
                <p className="mt-1 text-xs leading-5 text-neutral-400">
                  Kalau halaman ini dibuka di browser biasa, kamu akan diarahkan
                  ke bot Telegram.
                </p>
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-[20px] border border-red-400/20 bg-red-500/10 p-4">
              <p className="text-sm font-semibold text-red-100">{error}</p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={() => void authenticateWithTelegram()}
                  className="h-11 bg-red-600 text-white hover:bg-red-500"
                >
                  Coba lagi
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  className="h-11 border border-white/10 bg-white/[0.08] text-white hover:bg-white/[0.14]"
                >
                  <a href={miniAppUrl}>Buka via Telegram</a>
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            <a
              href={miniAppUrl}
              className="flex h-12 items-center justify-center gap-2 rounded-md bg-red-600 text-sm font-semibold text-white transition-colors hover:bg-red-500"
            >
              <MessageCircle className="size-4" />
              Buka Mini App
            </a>
            <a
              href={botChatUrl}
              className="flex h-12 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.05] text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
            >
              <MessageCircle className="size-4" />
              Buka chat bot
            </a>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-5">
            <p className="text-xs leading-5 text-neutral-500">
              Halaman web publik sekarang hanya jadi pintu masuk ke Telegram.
            </p>
            <Link
              href={adminLoginUrl}
              className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-300 transition-colors hover:text-white"
            >
              <ShieldCheck className="size-4" />
              Admin login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
