"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Clapperboard,
  Home,
  Search,
  Ticket,
  UserRound,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  icon: typeof Home;
  label: string;
  match: (pathname: string) => boolean;
};

const items: NavItem[] = [
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
    href: "/",
    icon: Home,
    label: "HOME",
    match: (pathname: string) =>
      pathname === "/" || pathname.startsWith("/browse"),
  },
  {
    href: "/affiliate",
    icon: Ticket,
    label: "Affiliate",
    match: (pathname: string) => pathname.startsWith("/affiliate"),
  },
  {
    href: "/profile",
    icon: UserRound,
    label: "Profil",
    match: (pathname: string) => pathname.startsWith("/profile"),
  },
];

function shouldHideNav(pathname: string) {
  return pathname.startsWith("/admin");
}

export function MobileBottomNav() {
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

  return (
    <>
      <div className="h-20 sm:hidden" />
      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[linear-gradient(180deg,rgba(25,18,18,0.96),rgba(8,8,8,0.98))] pb-[calc(env(safe-area-inset-bottom)+6px)] pt-1.5 shadow-[0_-10px_40px_rgba(0,0,0,0.4)] backdrop-blur transition-all duration-200 sm:hidden",
          isImmersivePlayerOpen &&
            "pointer-events-none translate-y-full opacity-0",
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0))]" />
        <div className="mx-auto grid max-w-xl grid-cols-5 items-end gap-0.5 px-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.match(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                data-haptic="medium"
                className="flex flex-col items-center justify-end gap-1.5 px-1 pb-1.5 pt-2"
              >
                <span
                  className={cn(
                    "relative flex size-9 items-center justify-center rounded-full text-neutral-200 transition-colors",
                    isActive && "bg-red-500/12 text-white ring-1 ring-red-400/20",
                  )}
                >
                  <span
                    className={cn(
                      "absolute -top-1 h-0.5 w-4 rounded-full bg-transparent transition-colors",
                      isActive && "bg-red-400/80",
                    )}
                  />
                  <Icon className="size-5" />
                </span>
                <span
                  className={cn(
                    "text-[10px] font-medium leading-none text-neutral-500",
                    isActive && "text-white",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
