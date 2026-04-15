import { NextResponse } from "next/server";

import {
  getOrderPaymentMetadata,
  getVipPaymentOrderForUser,
} from "@/lib/payments";
import { getCurrentUserSession } from "@/lib/user-auth";
import { syncVipOrderFromPaymenkuStatus } from "@/lib/vip-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const [user, { orderId }] = await Promise.all([
    getCurrentUserSession(),
    context.params,
  ]);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!orderId) {
    return NextResponse.json(
      { error: "Order pembayaran tidak ditemukan." },
      { status: 400 },
    );
  }

  try {
    const result = await syncVipOrderFromPaymenkuStatus({
      orderId,
      userId: user.id,
    });
    const order = await getVipPaymentOrderForUser({
      orderId,
      userId: user.id,
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order pembayaran tidak ditemukan." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      order: {
        amount: order.amount,
        checkoutUrl: order.checkoutUrl,
        currency: order.currency,
        expiresAt: order.expiresAt?.toISOString() ?? null,
        id: order.id,
        metadata: getOrderPaymentMetadata(order),
        paidAt: order.paidAt?.toISOString() ?? null,
        status: order.status,
      },
      status: result.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Status pembayaran belum bisa dicek sekarang.",
      },
      { status: 500 },
    );
  }
}
