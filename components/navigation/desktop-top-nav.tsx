"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Clapperboard,
  Home,
  LogIn,
  Search,
  Ticket,
  UserRound,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { TelegramAwareUserAvatar } from "@/components/navigation/telegram-aware-user-avatar";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  icon: typeof Home;
  label: string;
  match: (pathname: string) => boolean;
};

const items: NavItem[] = [
  {
    href: "/",
    icon: Home,
    label: "Beranda",
    match: (pathname: string) =>
      pathname === "/" || pathname.startsWith("/browse"),
  },
  {
    href: "/search",
    icon: Search,
    label: "Cari",
    match: (pathname: string) => pathname.startsWith("/search"),
  },
  {
    href: "/library",
    icon: Clapperboard,
    label: "Perpustakaan",
    match: (pathname: string) => pathname.startsWith("/library"),
  },
  {
    href: "/affiliate",
    icon: Ticket,
    label: "Affiliate",
    match: (pathname: string) => pathname.startsWith("/affiliate"),
  },
];

function shouldHideNav(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/login-telegram") ||
    pathname.startsWith("/watch")
  );
}

type DesktopTopNavProps = {
  isAuthenticated: boolean;
  displayName?: string | null;
  initialChar?: string | null;
};

export function DesktopTopNav({
  isAuthenticated,
  displayName,
  initialChar,
}: DesktopTopNavProps) {
  const pathname = usePathname();
  const [isImmersivePlayerOpen, setIsImmersivePlayerOpen] = useState(false);

  useEffect(() => {
    function syncImmersiveState() {
      setIsImmersivePlayerOpen(
        document.body.dataset.playerImmersive === "true",
      );
    }

    syncImmersiveState();
    window.addEventListener(
      "boxofice-immersive-change",
      syncImmersiveState as EventListener,
    );

    return () => {
      window.removeEventListener(
        "boxofice-immersive-change",
        syncImmersiveState as EventListener,
      );
    };
  }, []);

  if (shouldHideNav(pathname)) {
    return null;
  }

  if (isImmersivePlayerOpen) {
    return null;
  }

  const fallbackChar = (
    initialChar ??
    displayName?.trim().charAt(0).toUpperCase() ??
    "B"
  );

  return (
    <header className="sticky top-0 z-40 hidden border-b border-white/10 bg-[linear-gradient(180deg,rgba(8,8,8,0.92),rgba(8,8,8,0.78))] backdrop-blur-xl sm:block">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-6 lg:px-10">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-black tracking-tight text-white"
        >
          <span className="rounded-md bg-red-600 px-2 py-1 text-xs font-bold uppercase">
            Box
          </span>
          Office
        </Link>

        <nav className="flex flex-1 items-center gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.match(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-neutral-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {isAuthenticated ? (
          <Link
            href="/profile"
            prefetch
            className={cn(
              "inline-flex items-center gap-3 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              pathname.startsWith("/profile")
                ? "bg-white/10 text-white"
                : "text-neutral-300 hover:bg-white/5 hover:text-white",
            )}
            aria-label="Buka profil"
          >
            <TelegramAwareUserAvatar
              alt={displayName ?? "Profil"}
              className="size-8"
              fallbackClassName="text-xs font-bold text-white"
              fallbackChar={fallbackChar}
              imageSizes="32px"
            />
            <span className="hidden md:inline">
              {displayName ?? "Profil"}
            </span>
            <UserRound className="size-4 md:hidden" />
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              prefetch
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/10"
            >
              <LogIn className="size-4" />
              Masuk
            </Link>
            <Link
              href="/signup"
              prefetch
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500"
            >
              Daftar
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
