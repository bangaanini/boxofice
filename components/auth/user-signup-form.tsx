"use client";

import * as React from "react";
import Link from "next/link";
import { Lock, Mail, RefreshCw, User, UserPlus } from "lucide-react";

import {
  signupUserAction,
  type UserAuthFormState,
} from "@/app/user-auth/actions";
import { Button } from "@/components/ui/button";

const initialState: UserAuthFormState = {};

export function UserSignupForm() {
  const [state, formAction, isPending] = React.useActionState(
    signupUserAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-300">
          Nama
        </span>
        <span className="flex h-12 items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 text-neutral-100 transition-colors focus-within:border-red-400 focus-within:bg-white/[0.05]">
          <User className="size-5 text-neutral-500" />
          <input
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Nama kamu"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-neutral-600"
          />
        </span>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-300">
          Email
        </span>
        <span className="flex h-12 items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 text-neutral-100 transition-colors focus-within:border-red-400 focus-within:bg-white/[0.05]">
          <Mail className="size-5 text-neutral-500" />
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="kamu@email.com"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-neutral-600"
          />
        </span>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-300">
          Password
        </span>
        <span className="flex h-12 items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 text-neutral-100 transition-colors focus-within:border-red-400 focus-within:bg-white/[0.05]">
          <Lock className="size-5 text-neutral-500" />
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-neutral-600"
          />
        </span>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-300">
          Konfirmasi password
        </span>
        <span className="flex h-12 items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 text-neutral-100 transition-colors focus-within:border-red-400 focus-within:bg-white/[0.05]">
          <Lock className="size-5 text-neutral-500" />
          <input
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Ulangi password"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-neutral-600"
          />
        </span>
      </label>

      {state.error ? (
        <p className="rounded-md border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-sm text-orange-100">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={isPending}
        className="h-12 w-full rounded-full bg-red-600 text-white shadow-[0_14px_34px_rgba(220,38,38,0.3)] hover:bg-red-500"
      >
        {isPending ? (
          <RefreshCw className="size-5 animate-spin" />
        ) : (
          <UserPlus className="size-5" />
        )}
        {isPending ? "Membuat akun..." : "Buat akun"}
      </Button>

      <Link
        href="/login"
        className="flex h-12 items-center justify-center rounded-full border border-white/10 bg-black/30 px-4 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/[0.04]"
      >
        Sudah punya akun? Masuk di sini
      </Link>
    </form>
  );
}
