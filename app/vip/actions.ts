"use server";

import { redirect } from "next/navigation";

import { requireUserSession } from "@/lib/user-auth";
import {
  createVipPaymentForUser,
  syncVipOrderFromPaymenkuStatus,
} from "@/lib/vip-checkout";

export async function startVipPayment(formData: FormData) {
  const user = await requireUserSession();
  const channelCode = String(formData.get("channelCode") ?? "").trim();
  const planId = String(formData.get("planId") ?? "").trim();

  if (!planId) {
    redirect("/vip?payment=error&message=Paket+VIP+belum+dipilih.");
  }

  if (!channelCode) {
    redirect(`/vip?plan=${encodeURIComponent(planId)}&payment=error&message=Metode+pembayaran+belum+dipilih.`);
  }

  try {
    const orderId = await createVipPaymentForUser({
      channelCode,
      planId,
      userId: user.id,
    });

    redirect(`/vip/pay/${orderId}`);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Pembayaran VIP belum bisa dijalankan sekarang.";

    redirect(
      `/vip?plan=${encodeURIComponent(planId)}&payment=error&message=${encodeURIComponent(message)}`,
    );
  }
}

export async function checkVipPaymentStatus(formData: FormData) {
  const user = await requireUserSession();
  const orderId = String(formData.get("orderId") ?? "").trim();

  if (!orderId) {
    redirect("/vip?payment=error&message=Order+pembayaran+tidak+ditemukan.");
  }

  try {
    const result = await syncVipOrderFromPaymenkuStatus({
      orderId,
      userId: user.id,
    });

    if (result.status === "paid") {
      redirect(
        `/vip?payment=paid&orderId=${encodeURIComponent(orderId)}&message=${encodeURIComponent("Pembayaran terkonfirmasi. VIP kamu sudah aktif.")}`,
      );
    }

    redirect(
      `/vip/pay/${encodeURIComponent(orderId)}?status=${encodeURIComponent(result.status)}&message=${encodeURIComponent("Status pembayaran sudah diperbarui.")}`,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Status pembayaran belum bisa dicek sekarang.";

    redirect(
      `/vip/pay/${encodeURIComponent(orderId)}?status=error&message=${encodeURIComponent(message)}`,
    );
  }
}
