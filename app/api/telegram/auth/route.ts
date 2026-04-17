import { NextResponse, type NextRequest } from "next/server";

import {
  attachAffiliateReferral,
  consumeTelegramReferralIntent,
  registerAffiliateClick,
} from "@/lib/affiliate";
import { resolveChannelBroadcastStartParam } from "@/lib/channel-broadcasts";
import {
  extractAffiliateCodeFromStartParam,
} from "@/lib/telegram-miniapp";
import { setActiveBotContextCookie } from "@/lib/bot-access";
import { validateTelegramInitDataWithKnownBots } from "@/lib/telegram-partner-bots";
import { createUserSession, upsertTelegramUser } from "@/lib/user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramAuthRequestBody = {
  initData?: unknown;
  startParam?: unknown;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | TelegramAuthRequestBody
    | null;
  const initData =
    typeof body?.initData === "string" ? body.initData.trim() : "";

  if (!initData) {
    return NextResponse.json(
      { error: "initData Telegram wajib diisi." },
      { status: 400 },
    );
  }

  try {
    const { matchedBot, telegram } =
      await validateTelegramInitDataWithKnownBots(initData);
    const user = await upsertTelegramUser(telegram);
    const fallbackStartParam =
      typeof body?.startParam === "string" ? body.startParam.trim() : "";
    const referralCodeFromInitData = extractAffiliateCodeFromStartParam(
      telegram.startParam,
    );
    const referralCodeFromUrl =
      extractAffiliateCodeFromStartParam(fallbackStartParam);
    const referralCodeFromIntent =
      !referralCodeFromInitData && !referralCodeFromUrl
        ? await consumeTelegramReferralIntent({ telegramId: telegram.user.id })
        : null;
    const partnerReferralCode =
      matchedBot.kind === "partner" ? matchedBot.ownerReferralCode : null;
    const broadcastTarget =
      (await resolveChannelBroadcastStartParam(
        telegram.startParam ?? fallbackStartParam,
      ).catch(() => null)) ?? null;
    const referralCode =
      partnerReferralCode ??
      referralCodeFromInitData ??
      referralCodeFromUrl ??
      referralCodeFromIntent;

    if (referralCode) {
      if (partnerReferralCode || referralCodeFromInitData || referralCodeFromUrl) {
        await registerAffiliateClick(referralCode).catch(() => undefined);
      }

      await attachAffiliateReferral({
        referralCode,
        referredUserId: user.id,
      }).catch(() => undefined);
    }

    await createUserSession(user);
    await setActiveBotContextCookie(
      matchedBot.kind === "partner"
        ? {
            kind: "partner",
            partnerBotId: matchedBot.id,
          }
        : { kind: "default" },
    );

    return NextResponse.json({
      ok: true,
      redirectPath: broadcastTarget ? `/movie/${broadcastTarget.movieId}` : null,
      user: {
        id: user.id,
        name: user.name,
        telegramUsername: user.telegramUsername,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Autentikasi Telegram gagal.",
      },
      { status: 401 },
    );
  }
}
