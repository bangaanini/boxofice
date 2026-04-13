"use client";

import * as React from "react";
import { Lock, RefreshCw } from "lucide-react";

import {
  changePasswordAction,
  type UserAuthFormState,
} from "@/app/user-auth/actions";
import { Button } from "@/components/ui/button";

const initialState: UserAuthFormState = {};

export function ChangePasswordForm() {
  const [state, formAction, isPending] = React.useActionState(
    changePasswordAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-300">
          Password lama
        </span>
        <span className="flex h-12 items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 text-neutral-100 transition-colors focus-within:border-red-400 focus-within:bg-white/[0.05]">
          <Lock className="size-5 text-neutral-500" />
          <input
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password lama"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-neutral-600"
          />
        </span>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-300">
          Password baru
        </span>
        <span className="flex h-12 items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 text-neutral-100 transition-colors focus-within:border-red-400 focus-within:bg-white/[0.05]">
          <Lock className="size-5 text-neutral-500" />
          <input
            name="newPassword"
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
          Konfirmasi password baru
        </span>
        <span className="flex h-12 items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 text-neutral-100 transition-colors focus-within:border-red-400 focus-within:bg-white/[0.05]">
          <Lock className="size-5 text-neutral-500" />
          <input
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Ulangi password baru"
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
          <Lock className="size-5" />
        )}
        {isPending ? "Menyimpan..." : "Simpan password baru"}
      </Button>
    </form>
  );
}
