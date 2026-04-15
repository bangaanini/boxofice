"use client";

import Link from "next/link";
import {
  Bot,
  Crown,
  Home,
  Landmark,
  Percent,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type AdminSidebarProps = {
  email: string;
};

const items = [
  {
    description: "Ringkasan kontrol utama",
    href: "/admin",
    icon: Home,
    label: "Dashboard",
    match: (pathname: string) => pathname === "/admin",
  },
  {
    description: "Referensi akun dan referral",
    href: "/admin/users",
    icon: Users,
    label: "Tabel user",
    match: (pathname: string) => pathname.startsWith("/admin/users"),
  },
  {
    description: "Kelola sinkronisasi katalog",
    href: "/admin/sync",
    icon: RefreshCw,
    label: "Sync",
    match: (pathname: string) => pathname.startsWith("/admin/sync"),
  },
  {
    description: "Telegram bot, webhook, dan Mini App",
    href: "/admin/settings",
    icon: Bot,
    label: "Settings bot",
    match: (pathname: string) => pathname.startsWith("/admin/settings"),
  },
  {
    description: "Atur presentase komisi affiliate",
    href: "/admin/commission",
    icon: Percent,
    label: "Komisi affiliate",
    match: (pathname: string) => pathname.startsWith("/admin/commission"),
  },
  {
    description: "Atur preview gratis dan paywall VIP",
    href: "/admin/vip",
    icon: Crown,
    label: "Pengaturan VIP",
    match: (pathname: string) => pathname.startsWith("/admin/vip"),
  },
  {
    description: "Gateway pembayaran dan paket VIP",
    href: "/admin/payments",
    icon: Landmark,
    label: "Payment gateway",
    match: (pathname: string) => pathname.startsWith("/admin/payments"),
  },
] as const;

export function AdminSidebar({ email }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="space-y-4">
      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(29,19,16,0.96),rgba(12,9,8,0.98))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
          <ShieldCheck className="size-3.5" />
          Admin dashboard
        </p>
        <h2 className="mt-4 text-2xl font-black text-white">
          Box Office Admin
        </h2>
        <p className="mt-2 text-sm text-neutral-400">{email}</p>
      </div>

      <nav className="space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.match(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-start gap-4 rounded-[22px] border px-4 py-4 transition-colors",
                isActive
                  ? "border-orange-300/20 bg-[linear-gradient(180deg,rgba(127,61,34,0.52),rgba(66,33,20,0.58))] text-white shadow-[0_18px_40px_rgba(0,0,0,0.24)]"
                  : "border-white/10 bg-[linear-gradient(180deg,rgba(31,22,19,0.92),rgba(17,12,11,0.96))] text-neutral-300 hover:bg-white/[0.06]",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full ring-1",
                  isActive
                    ? "bg-orange-400 text-white ring-orange-300/20"
                    : "bg-black/25 text-neutral-300 ring-white/10",
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-inherit">
                  {item.label}
                </span>
                <span className="mt-1 block text-sm leading-6 text-neutral-400">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
