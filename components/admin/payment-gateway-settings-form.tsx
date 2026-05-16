"use client";

import * as React from "react";

import { updatePaymentGatewaySettings } from "@/app/admin/actions";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";

type PaymentProvider = "paymenku" | "pakasir";

type ProviderCredentialState = {
  apiKey: string;
  projectSlug: string;
  webhookToken: string;
};

type PaymentGatewaySettingsFormProps = {
  defaultApiKey: string;
  defaultCheckoutButtonLabel: string;
  defaultEnabled: boolean;
  defaultProjectSlug: string;
  defaultWebhookToken: string;
  initialProvider: PaymentProvider;
  publicAppUrl: string;
};

const PROVIDERS: Array<{
  description: string;
  label: string;
  value: PaymentProvider;
}> = [
  {
    description: "QRIS dan Virtual Account via Paymenku.",
    label: "Paymenku",
    value: "paymenku",
  },
  {
    description: "QRIS dan Virtual Account via project Pakasir.",
    label: "Pakasir",
    value: "pakasir",
  },
];

function getProviderLabel(provider: PaymentProvider) {
  return provider === "pakasir" ? "Pakasir" : "Paymenku";
}

function buildWebhookUrl(input: {
  callbackToken: string;
  provider: PaymentProvider;
  publicAppUrl: string;
}) {
  const url = new URL(`/api/webhooks/${input.provider}`, input.publicAppUrl);
  const token = input.callbackToken.trim();

  if (token) {
    url.searchParams.set("token", token);
  }

  return url.toString();
}

function Field({
  label,
  name,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300">
        {label}
      </label>
      <input
        name={name}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-[18px] border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-neutral-500"
      />
    </div>
  );
}

export function PaymentGatewaySettingsForm({
  defaultApiKey,
  defaultCheckoutButtonLabel,
  defaultEnabled,
  defaultProjectSlug,
  defaultWebhookToken,
  initialProvider,
  publicAppUrl,
}: PaymentGatewaySettingsFormProps) {
  const [provider, setProvider] =
    React.useState<PaymentProvider>(initialProvider);
  const [enabled, setEnabled] = React.useState(defaultEnabled);
  const [checkoutButtonLabel, setCheckoutButtonLabel] = React.useState(
    defaultCheckoutButtonLabel,
  );
  const [credentials, setCredentials] = React.useState<
    Record<PaymentProvider, ProviderCredentialState>
  >({
    pakasir: {
      apiKey: initialProvider === "pakasir" ? defaultApiKey : "",
      projectSlug: initialProvider === "pakasir" ? defaultProjectSlug : "",
      webhookToken: initialProvider === "pakasir" ? defaultWebhookToken : "",
    },
    paymenku: {
      apiKey: initialProvider === "paymenku" ? defaultApiKey : "",
      projectSlug: "",
      webhookToken: initialProvider === "paymenku" ? defaultWebhookToken : "",
    },
  });
  const providerLabel = getProviderLabel(provider);
  const activeCredentials = credentials[provider];
  const webhookUrl = buildWebhookUrl({
    callbackToken: activeCredentials.webhookToken,
    provider,
    publicAppUrl,
  });

  function updateCredential(
    key: keyof ProviderCredentialState,
    value: string,
  ) {
    setCredentials((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        [key]: value,
      },
    }));
  }

  return (
    <form
      action={updatePaymentGatewaySettings}
      className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
    >
      <input type="hidden" name="redirectTo" value="/admin/payments" />
      <input type="hidden" name="provider" value={provider} />
      {provider === "paymenku" ? (
        <input type="hidden" name="paymentProjectSlug" value="" />
      ) : null}

      <div className="space-y-5">
        <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-start gap-3">
              <input
                name="enabled"
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                className="mt-1 size-4 rounded border-white/20 bg-black"
              />
              <span>
                <span className="block text-sm font-semibold text-white">
                  Aktifkan gateway terpilih
                </span>
                <span className="mt-1 block text-sm leading-6 text-neutral-400">
                  {enabled
                    ? `${providerLabel} akan menjadi satu-satunya gateway aktif.`
                    : "Payment gateway sedang dimatikan."}
                </span>
              </span>
            </label>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              {enabled ? `Aktif: ${providerLabel}` : "Nonaktif"}
            </span>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-neutral-300">
            Provider aktif
          </p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {PROVIDERS.map((item) => {
              const isSelected = provider === item.value;

              return (
                <label
                  key={item.value}
                  className={[
                    "flex cursor-pointer items-start gap-3 rounded-[18px] border p-4 transition-colors",
                    isSelected
                      ? "border-orange-300/30 bg-orange-500/10"
                      : "border-white/10 bg-black/20 hover:bg-white/[0.06]",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="providerChoice"
                    value={item.value}
                    checked={isSelected}
                    onChange={() => setProvider(item.value)}
                    className="mt-1 size-4 border-white/20 bg-transparent accent-orange-400"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-400">
                      {item.description}
                    </span>
                    <span
                      className={[
                        "mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                        isSelected
                          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                          : "border-white/10 bg-white/[0.04] text-neutral-400",
                      ].join(" ")}
                    >
                      {isSelected ? "Dipilih" : "Tidak aktif"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Label tombol checkout"
            name="checkoutButtonLabel"
            value={checkoutButtonLabel}
            onChange={setCheckoutButtonLabel}
          />
          <Field
            label={`${providerLabel} API key`}
            name="paymentApiKey"
            value={activeCredentials.apiKey}
            onChange={(value) => updateCredential("apiKey", value)}
            placeholder="Fallback aktif dari env server jika field ini kosong"
          />
        </div>

        {provider === "pakasir" ? (
          <Field
            label="Project slug Pakasir"
            name="paymentProjectSlug"
            value={activeCredentials.projectSlug}
            onChange={(value) => updateCredential("projectSlug", value)}
            placeholder="Slug project dari dashboard Pakasir"
          />
        ) : null}

        <Field
          label="Token callback internal"
          name="paymentWebhookToken"
          value={activeCredentials.webhookToken}
          onChange={(value) => updateCredential("webhookToken", value)}
          placeholder="Kosongkan jika tidak memakai token tambahan"
        />

        <PendingSubmitButton
          pendingLabel="Menyimpan..."
          className="h-11 bg-red-600 text-white hover:bg-red-500"
        >
          Simpan pengaturan payment
        </PendingSubmitButton>
      </div>

      <div className="space-y-4 rounded-[22px] border border-white/10 bg-black/20 p-5">
        <p className="text-sm font-semibold text-white">
          Petunjuk setup {providerLabel}
        </p>
        <ol className="space-y-2 text-sm leading-6 text-neutral-300">
          <li>
            1. Isi API key {providerLabel}
            {provider === "pakasir" ? " dan project slug Pakasir" : ""}.
          </li>
          <li>2. Pastikan hanya kartu provider yang ingin dipakai yang dipilih.</li>
          <li>3. Simpan pengaturan payment di halaman ini.</li>
          <li>4. Daftarkan callback URL di dashboard {providerLabel}.</li>
          <li>5. Tes satu paket dengan QRIS atau salah satu VA.</li>
        </ol>

        <div className="rounded-[18px] border border-white/10 bg-black/30 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
            Callback URL {providerLabel}
          </p>
          <p className="mt-2 break-all text-sm text-white">{webhookUrl}</p>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-black/30 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
            Gateway yang akan aktif
          </p>
          <p className="mt-2 text-sm font-semibold text-white">
            {enabled ? providerLabel : "Tidak ada gateway aktif"}
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Saat disimpan, pilihan ini mengganti provider lama. Order baru akan
            dibuat hanya ke gateway terpilih.
          </p>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-black/30 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
            Alur yang dipakai app
          </p>
          <div className="mt-3 space-y-2 text-sm leading-6 text-neutral-300">
            <p>1. User pilih paket VIP.</p>
            <p>2. User pilih QRIS atau salah satu bank VA.</p>
            <p>3. Aplikasi buat transaksi ke {providerLabel}.</p>
            <p>4. Halaman detail pembayaran menampilkan QR atau nomor VA.</p>
            <p>
              5. Status dibaca dari webhook {providerLabel} atau tombol cek
              manual.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
