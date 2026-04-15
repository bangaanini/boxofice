import { NextResponse, type NextRequest } from "next/server";

import {
  registerAffiliateClick,
  saveTelegramReferralIntent,
} from "@/lib/affiliate";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";
import { buildAffiliateStartParam } from "@/lib/telegram-miniapp";
import {
  buildPartnerBotOwnerSettingsUrl,
  getPartnerBotForWebhook,
  resolvePartnerBotSettings,
} from "@/lib/telegram-partner-bots";
import {
  isStartCommand,
  sendTelegramWelcomeMessage,
} from "@/lib/telegram-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUpdate = {
  message?: {
    chat?: {
      id?: number;
    };
    from?: {
      first_name?: string;
      id?: number;
      username?: string;
    };
    text?: string;
  };
};

type RouteContext = {
  params: Promise<{
    partnerId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { partnerId } = await context.params;
  const partnerBot = await getPartnerBotForWebhook(partnerId);

  if (!partnerBot?.active || !partnerBot.botToken || !partnerBot.webhookSecret) {
    return NextResponse.json(
      { error: "Partner bot belum aktif atau belum lengkap." },
      { status: 404 },
    );
  }

  const secret = request.headers.get("x-telegram-bot-api-secret-token");

  if (secret !== partnerBot.webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret partner tidak valid." },
      { status: 401 },
    );
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;

  if (!isStartCommand(update?.message?.text)) {
    return NextResponse.json({ ok: true, skipped: "not_start" });
  }

  const ownerReferralCode = partnerBot.owner.affiliateProfile?.referralCode;

  if (!ownerReferralCode) {
    return NextResponse.json(
      { ok: true, skipped: "missing_owner_referral" },
      { status: 200 },
    );
  }

  const referralCode = ownerReferralCode;
  const startParam = buildAffiliateStartParam(ownerReferralCode);

  await registerAffiliateClick(referralCode).catch(() => undefined);
  await saveTelegramReferralIntent({
    referralCode,
    telegramId: update?.message?.from?.id,
  }).catch(() => undefined);

  const botSettings = await getTelegramBotSettingsSafe();
  const resolvedSettings = resolvePartnerBotSettings(
    botSettings.settings,
    partnerBot.settingsOverrides,
  );
  const isOwnerChat =
    String(partnerBot.owner.telegramId ?? "") ===
    String(update?.message?.from?.id ?? "");
  const settingsUrl = buildPartnerBotOwnerSettingsUrl(
    botSettings.runtime.publicAppUrl,
    partnerBot.id,
  );
  const extraRows = isOwnerChat
    ? [
        [
          {
            text: resolvedSettings.settingsLabel,
            web_app: {
              url: settingsUrl,
            },
          },
        ],
      ]
    : undefined;

  await sendTelegramWelcomeMessage({
    botToken: partnerBot.botToken,
    extraRows,
    message: {
      chatId:
        typeof update?.message?.chat?.id === "number" ? update.message.chat.id : null,
      firstName: update?.message?.from?.first_name,
      telegramId: update?.message?.from?.id,
      username: update?.message?.from?.username,
    },
    settings: resolvedSettings.settings,
    startParam,
  }).catch((error) => {
    console.error("Partner Telegram webhook sendMessage failed", error);
  });

  return NextResponse.json({ ok: true });
}
