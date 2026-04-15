"use server";

import { revalidatePath } from "next/cache";

import {
  recordAffiliateInteraction,
  requestAffiliatePayout,
} from "@/lib/affiliate";
import { requireUserSession } from "@/lib/user-auth";

export type AffiliateActionState = {
  error?: string;
  success?: string;
};

export async function requestAffiliatePayoutAction(
  _previousState: AffiliateActionState,
  formData: FormData,
): Promise<AffiliateActionState> {
  const user = await requireUserSession();
  const amount = Number(formData.get("amount") ?? 0);
  const payoutMethod = String(formData.get("payoutMethod") ?? "");
  const payoutProvider = String(formData.get("payoutProvider") ?? "");
  const recipientName = String(formData.get("recipientName") ?? "");
  const accountNumber = String(formData.get("accountNumber") ?? "");

  try {
    const payout = await requestAffiliatePayout({
      accountNumber,
      amount,
      payoutMethod,
      payoutProvider,
      recipientName,
      userId: user.id,
    });

    revalidatePath("/affiliate");

    return {
      success:
        `Permintaan penarikan Rp ${new Intl.NumberFormat("id-ID").format(payout.amount)} ` +
        `ke ${payout.payoutProvider} atas nama ${payout.recipientName} sudah dikirim.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Tidak bisa mengajukan penarikan sekarang.",
    };
  }
}

export async function recordAffiliateInteractionAction(
  type: "copy_link" | "share_link",
) {
  const user = await requireUserSession();

  await recordAffiliateInteraction({
    type,
    userId: user.id,
  }).catch(() => undefined);

  revalidatePath("/affiliate");
}
