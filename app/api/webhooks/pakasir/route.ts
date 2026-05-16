import { NextResponse } from "next/server";

import { getPaymentGatewaySettingsSafe } from "@/lib/payments";
import { handlePakasirWebhook } from "@/lib/vip-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const settings = await getPaymentGatewaySettingsSafe();
  const runtime = settings.runtime;
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("token")?.trim() ?? "";

  if (runtime.callbackToken && token !== runtime.callbackToken) {
    return NextResponse.json(
      { error: "Token callback Pakasir tidak valid." },
      { status: 401 },
    );
  }

  let payload: {
    amount?: number | string;
    completed_at?: string;
    order_id?: string;
    payment_method?: string;
    project?: string;
    status?: string;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { error: "Payload webhook Pakasir tidak valid." },
      { status: 400 },
    );
  }

  try {
    await handlePakasirWebhook({
      amount: payload.amount,
      completedAt: payload.completed_at,
      orderId: payload.order_id,
      paymentMethod: payload.payment_method,
      project: payload.project,
      status: payload.status,
    });
  } catch (error) {
    console.error("Pakasir webhook handling failed", error);

    return NextResponse.json(
      { error: "Webhook Pakasir tidak bisa diproses." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
