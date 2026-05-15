import { redirect } from "next/navigation";

import { TelegramEntryGate } from "@/components/telegram/telegram-entry-gate";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";
import {
  buildTelegramBotChatUrlForUsername,
  buildTelegramMainMiniAppUrlForUsername,
} from "@/lib/telegram-miniapp";
import { getCurrentUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

type LoginTelegramPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

function sanitizeNextPath(value: string | undefined): string {
  if (!value) {
    return "/";
  }

  if (!value.startsWith("/")) {
    return "/";
  }

  if (value.startsWith("//") || value.startsWith("/api/")) {
    return "/";
  }

  return value;
}

export default async function LoginTelegramPage({
  searchParams,
}: LoginTelegramPageProps) {
  const [{ next }, user] = await Promise.all([
    searchParams,
    getCurrentUserSession(),
  ]);
  const successPath = sanitizeNextPath(next);

  if (user) {
    redirect(successPath);
  }

  const telegram = await getTelegramBotSettingsSafe();

  return (
    <TelegramEntryGate
      adminLoginUrl="/admin/login"
      botChatUrl={buildTelegramBotChatUrlForUsername(
        telegram.runtime.botUsername,
      )}
      miniAppUrl={buildTelegramMainMiniAppUrlForUsername(
        telegram.runtime.botUsername,
      )}
      successRedirectPath={successPath}
    />
  );
}
