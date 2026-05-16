import { redirect } from "next/navigation";

import { PaymentStatusSheet } from "@/components/vip/payment-status-sheet";
import {
  formatCurrency,
  getOrderPaymentMetadata,
  getPaymentProviderLabel,
  getVipPaymentOrderForUser,
} from "@/lib/payments";
import { requireUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

type VipPaymentDetailPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function VipPaymentDetailPage({
  params,
}: VipPaymentDetailPageProps) {
  const [{ orderId }, user] = await Promise.all([params, requireUserSession()]);
  const order = await getVipPaymentOrderForUser({
    orderId,
    userId: user.id,
  });

  if (!order) {
    redirect("/vip?payment=error&message=Order+pembayaran+tidak+ditemukan.");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <PaymentStatusSheet
        amountLabel={formatCurrency(order.amount, order.currency)}
        checkoutUrl={order.checkoutUrl}
        initialExpiresAt={order.expiresAt?.toISOString() ?? null}
        initialMetadata={getOrderPaymentMetadata(order)}
        initialStatus={order.status}
        orderId={order.id}
        planDurationLabel={`${order.plan.durationDays} hari`}
        planTitle={order.plan.title}
        providerLabel={getPaymentProviderLabel(order.provider)}
      />
    </main>
  );
}
