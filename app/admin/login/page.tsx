import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { LoginForm } from "@/components/admin/login-form";
import {
  getAdminEmail,
  getDefaultAdminPasswordHint,
  sanitizeAdminRedirectPath,
  usesDefaultAdminCredentials,
} from "@/lib/admin-auth";

type AdminLoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
  }>;
};

export default async function AdminLoginPage({
  searchParams,
}: AdminLoginPageProps) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = sanitizeAdminRedirectPath(rawNext ?? null);

  return (
    <main className="flex min-h-screen items-center bg-black px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Kembali ke katalog
        </Link>

        <div className="rounded-md border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-red-950/20 sm:p-7">
          <div className="mb-7">
            <div className="mb-4 flex size-12 items-center justify-center rounded-md bg-red-600/15 text-red-300 ring-1 ring-red-400/20">
              <ShieldCheck className="size-6" />
            </div>
            <p className="text-sm font-semibold text-red-400">Admin Panel</p>
            <h1 className="mt-2 text-3xl font-black leading-none text-white">
              Masuk untuk mengelola Box Office
            </h1>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Area ini dikunci dengan sesi admin HttpOnly.
            </p>
          </div>

          <LoginForm defaultEmail={getAdminEmail()} nextPath={nextPath} />

          {usesDefaultAdminCredentials() ? (
            <div className="mt-5 rounded-md border border-yellow-400/20 bg-yellow-400/10 p-3 text-sm leading-6 text-yellow-100">
              Default lokal: <strong>{getAdminEmail()}</strong> /{" "}
              <strong>{getDefaultAdminPasswordHint()}</strong>. Ganti lewat
              env sebelum deploy.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
