import {
  AdminMetricCard,
  AdminSurface,
} from "@/components/admin/admin-surface";
import { PaymentGatewaySettingsForm } from "@/components/admin/payment-gateway-settings-form";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import {
  createOrUpdateVipPlan,
} from "@/app/admin/actions";
import {
  formatCurrency,
  getAdminPaymentData,
} from "@/lib/payments";

export const dynamic = "force-dynamic";

type AdminPaymentsPageProps = {
  searchParams: Promise<{
    message?: string;
    payment?: string;
    plan?: string;
  }>;
};

function Field({
  defaultValue,
  label,
  name,
  placeholder,
  type = "text",
}: {
  defaultValue: string;
  label: string;
  name: string;
  placeholder?: string;
  type?: "number" | "text";
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300">
        {label}
      </label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-[18px] border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-neutral-500"
      />
    </div>
  );
}

export default async function AdminPaymentsPage({
  searchParams,
}: AdminPaymentsPageProps) {
  const params = await searchParams;
  const paymentData = await getAdminPaymentData();
  const runtime = paymentData.settingsResult.runtime;
  const settings = paymentData.settingsResult.settings;
  const recentOrders = paymentData.recentOrders;
  const provider =
    runtime.provider === "pakasir" || settings.provider === "pakasir"
      ? "pakasir"
      : "paymenku";

  return (
    <div className="space-y-6">
      <AdminSurface>
        <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
          Payment
        </p>
        <h1 className="mt-4 text-4xl font-black text-white">
          Payment gateway & paket VIP
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-neutral-400">
          Atur integrasi Paymenku atau Pakasir untuk QRIS dan Virtual Account,
          siapkan paket VIP, lalu pantau order yang masuk dari Mini App dengan
          alur yang sama.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard
            label="Gateway"
            value={runtime.enabled ? "Aktif" : "Belum aktif"}
          />
          <AdminMetricCard
            label="Paket aktif"
            value={paymentData.plansResult.plans.filter((plan) => plan.active).length}
          />
          <AdminMetricCard label="Order dibayar" value={paymentData.paidOrders} />
          <AdminMetricCard
            label="Omzet VIP"
            value={formatCurrency(paymentData.totalRevenue)}
          />
        </div>
      </AdminSurface>

      {params.payment ? (
        <AdminSurface className="text-sm leading-6 text-neutral-200">
          {params.payment === "error" ? (
            <span className="text-red-200">
              {params.message ?? "Pengaturan payment gagal diperbarui."}
            </span>
          ) : (
            <span className="text-emerald-100">
              {params.message ?? "Pengaturan payment berhasil diperbarui."}
            </span>
          )}
        </AdminSurface>
      ) : null}

      {params.plan ? (
        <AdminSurface className="text-sm leading-6 text-neutral-200">
          {params.plan === "error" ? (
            <span className="text-red-200">
              {params.message ?? "Paket VIP gagal disimpan."}
            </span>
          ) : (
            <span className="text-emerald-100">
              {params.message ?? "Paket VIP berhasil disimpan."}
            </span>
          )}
        </AdminSurface>
      ) : null}

      {!paymentData.settingsResult.schemaReady || !paymentData.plansResult.schemaReady ? (
        <AdminSurface className="text-sm leading-6 text-amber-100">
          <p className="font-semibold text-white">Payment fallback aktif</p>
          <p className="mt-2">
            {paymentData.settingsResult.schemaIssue ??
              paymentData.plansResult.schemaIssue ??
              paymentData.schemaIssue ??
              "Database runtime belum siap penuh untuk modul payment."}
          </p>
        </AdminSurface>
      ) : null}

      <AdminSurface>
        <p className="text-sm font-semibold text-orange-200">
          Gateway payment
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Atur provider, API key, dan callback
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">
          Database jadi sumber utama. Kalau field kosong, aplikasi akan fallback
          ke env server. Jadi admin tetap bisa ganti konfigurasi tanpa sentuh
          file server setiap saat.
        </p>

        <PaymentGatewaySettingsForm
          defaultApiKey={settings.stripeSecretKey ?? ""}
          defaultCheckoutButtonLabel={settings.checkoutButtonLabel}
          defaultEnabled={runtime.enabled || settings.enabled}
          defaultProjectSlug={settings.stripePublishableKey ?? ""}
          defaultWebhookToken={settings.stripeWebhookSecret ?? ""}
          initialProvider={provider}
          publicAppUrl={runtime.publicAppUrl}
        />
      </AdminSurface>

      <AdminSurface>
        <p className="text-sm font-semibold text-orange-200">Paket VIP</p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Kelola paket yang dijual
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">
          Paket ini dipakai halaman VIP dan langsung dikirim ke provider
          payment aktif saat user membuat transaksi.
        </p>

        <div className="mt-6 space-y-4">
          {paymentData.plansResult.plans.map((plan) => (
            <form
              key={plan.id}
              action={createOrUpdateVipPlan}
              className="rounded-[22px] border border-white/10 bg-black/20 p-5"
            >
              <input type="hidden" name="redirectTo" value="/admin/payments" />
              <input type="hidden" name="planId" value={plan.id} />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field defaultValue={plan.title} label="Judul" name="title" />
                <Field defaultValue={plan.slug} label="Slug" name="slug" />
                <Field
                  defaultValue={plan.badge ?? ""}
                  label="Badge"
                  name="badge"
                />
                <Field
                  defaultValue={plan.ctaLabel}
                  label="Label CTA"
                  name="ctaLabel"
                />
                <Field
                  defaultValue={String(plan.durationDays)}
                  label="Durasi (hari)"
                  name="durationDays"
                  type="number"
                />
                <Field
                  defaultValue={String(plan.priceAmount)}
                  label="Harga (IDR)"
                  name="priceAmount"
                  type="number"
                />
                <Field
                  defaultValue={plan.currency}
                  label="Mata uang"
                  name="currency"
                />
                <Field
                  defaultValue={String(plan.sortOrder)}
                  label="Urutan"
                  name="sortOrder"
                  type="number"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-neutral-300">
                  Deskripsi paket
                </label>
                <textarea
                  name="description"
                  defaultValue={plan.description}
                  rows={3}
                  className="mt-2 w-full rounded-[20px] border border-white/10 bg-black/25 px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-neutral-500"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-4">
                <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-black/25 px-4 py-3 text-sm text-white">
                  <input
                    name="highlight"
                    type="checkbox"
                    defaultChecked={plan.highlight}
                    className="size-4 rounded border-white/20 bg-black"
                  />
                  Paket unggulan
                </label>
                <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-black/25 px-4 py-3 text-sm text-white">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={plan.active}
                    className="size-4 rounded border-white/20 bg-black"
                  />
                  Tampilkan di halaman VIP
                </label>
              </div>

              <PendingSubmitButton
                pendingLabel="Menyimpan..."
                className="mt-5 h-11 bg-red-600 text-white hover:bg-red-500"
              >
                Simpan paket
              </PendingSubmitButton>
            </form>
          ))}
        </div>

        <form
          action={createOrUpdateVipPlan}
          className="mt-6 rounded-[22px] border border-dashed border-white/10 bg-black/15 p-5"
        >
          <input type="hidden" name="redirectTo" value="/admin/payments" />
          <p className="text-sm font-semibold text-white">Tambah paket baru</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field defaultValue="" label="Judul" name="title" />
            <Field defaultValue="" label="Slug" name="slug" />
            <Field defaultValue="" label="Badge" name="badge" />
            <Field
              defaultValue="Pilih metode pembayaran"
              label="Label CTA"
              name="ctaLabel"
            />
            <Field
              defaultValue="30"
              label="Durasi (hari)"
              name="durationDays"
              type="number"
            />
            <Field
              defaultValue="49000"
              label="Harga (IDR)"
              name="priceAmount"
              type="number"
            />
            <Field defaultValue="IDR" label="Mata uang" name="currency" />
            <Field defaultValue="10" label="Urutan" name="sortOrder" type="number" />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-neutral-300">
              Deskripsi paket
            </label>
            <textarea
              name="description"
              rows={3}
              className="mt-2 w-full rounded-[20px] border border-white/10 bg-black/25 px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-neutral-500"
              placeholder="Jelaskan singkat kenapa paket ini menarik untuk user."
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-4">
            <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-black/25 px-4 py-3 text-sm text-white">
              <input
                name="highlight"
                type="checkbox"
                className="size-4 rounded border-white/20 bg-black"
              />
              Paket unggulan
            </label>
            <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-black/25 px-4 py-3 text-sm text-white">
              <input
                name="active"
                type="checkbox"
                defaultChecked
                className="size-4 rounded border-white/20 bg-black"
              />
              Langsung aktif
            </label>
          </div>

          <PendingSubmitButton
            pendingLabel="Menambahkan..."
            className="mt-5 h-11 bg-white text-neutral-950 hover:bg-neutral-200"
          >
            Tambah paket VIP
          </PendingSubmitButton>
        </form>
      </AdminSurface>

      <AdminSurface>
        <p className="text-sm font-semibold text-orange-200">Order terbaru</p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Pantau transaksi VIP
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">
          Riwayat ini membantu admin melihat order yang masih pending, yang
          sudah dibayar, dan order yang perlu dicek ulang.
        </p>

        <div className="mt-5 overflow-hidden rounded-[22px] border border-white/10">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)] gap-4 border-b border-white/10 bg-white/[0.04] px-5 py-3 text-xs uppercase tracking-[0.16em] text-neutral-500">
            <p>User</p>
            <p>Paket</p>
            <p>Status</p>
            <p>Nilai</p>
          </div>
          {recentOrders.length ? (
            recentOrders.map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)] gap-4 border-b border-white/5 px-5 py-4 text-sm text-neutral-200 last:border-b-0"
              >
                <div>
                  <p className="font-semibold text-white">{order.user.name}</p>
                  <p className="mt-1 text-neutral-400">
                    {order.user.telegramUsername
                      ? `@${order.user.telegramUsername}`
                      : "User Telegram"}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-white">{order.plan.title}</p>
                  <p className="mt-1 text-neutral-400">
                    {new Intl.DateTimeFormat("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(order.createdAt)}
                  </p>
                </div>
                <div>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                    {order.status}
                  </span>
                </div>
                <div className="font-semibold text-white">
                  {formatCurrency(order.amount, order.currency)}
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-6 text-sm leading-6 text-neutral-400">
              Belum ada order VIP yang masuk. Begitu payment gateway dipakai,
              riwayat pembayaran akan muncul di sini.
            </div>
          )}
        </div>
      </AdminSurface>
    </div>
  );
}
