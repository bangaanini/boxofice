import { NextResponse } from "next/server";

import { getPaymentGatewaySettingsSafe } from "@/lib/payments";
import { handlePaymenkuWebhook } from "@/lib/vip-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const settings = await getPaymentGatewaySettingsSafe();
  const runtime = settings.runtime;
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("token")?.trim() ?? "";

  if (runtime.callbackToken && token !== runtime.callbackToken) {
    return NextResponse.json(
      { error: "Token callback Paymenku tidak valid." },
      { status: 401 },
    );
  }

  let payload: {
    amount?: string;
    amount_fee?: string;
    amount_received?: string;
    customer_email?: string;
    customer_name?: string;
    event?: string;
    paid_at?: string;
    payment_channel?: string;
    reference_id?: string;
    status?: string;
    trx_id?: string;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { error: "Payload webhook Paymenku tidak valid." },
      { status: 400 },
    );
  }

  if (payload.event !== "payment.status_updated") {
    return NextResponse.json({ received: true });
  }

  try {
    await handlePaymenkuWebhook({
      amount: payload.amount,
      amountFee: payload.amount_fee,
      amountReceived: payload.amount_received,
      customerEmail: payload.customer_email,
      customerName: payload.customer_name,
      paidAt: payload.paid_at,
      paymentChannel: payload.payment_channel,
      referenceId: payload.reference_id,
      status: payload.status,
      trxId: payload.trx_id,
    });
  } catch (error) {
    console.error("Paymenku webhook handling failed", error);

    return NextResponse.json(
      { error: "Webhook Paymenku tidak bisa diproses." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
