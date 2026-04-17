import {
  AdminMetricCard,
  AdminSurface,
} from "@/components/admin/admin-surface";
import { CopyCodeBlock } from "@/components/admin/copy-code-block";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import {
  deletePartnerBotFromAdmin,
  savePartnerBotFromAdmin,
} from "@/app/admin/actions";
import { listPartnerBotsForAdmin } from "@/lib/telegram-partner-bots";

export const dynamic = "force-dynamic";

type AdminPartnerBotsPageProps = {
  searchParams: Promise<{
    message?: string;
    partner?: string;
  }>;
};

function Field({
  defaultValue,
  label,
  name,
  placeholder,
}: {
  defaultValue?: string | null;
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300">
        {label}
      </label>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-[18px] border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-neutral-500"
      />
    </div>
  );
}

function OwnerSelect({
  defaultValue,
  owners,
}: {
  defaultValue?: string;
  owners: Awaited<ReturnType<typeof listPartnerBotsForAdmin>>["owners"];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300">
        Pemilik bot partner
      </label>
      <select
        name="ownerUserId"
        defaultValue={defaultValue ?? ""}
        className="mt-2 h-12 w-full rounded-[18px] border border-white/10 bg-black/25 px-4 text-sm text-white outline-none"
      >
        <option value="" className="bg-neutral-950">
          Pilih user partner
        </option>
        {owners.map((owner) => {
          const username = owner.telegramUsername
            ? `@${owner.telegramUsername}`
            : "tanpa username";
          const referralCode = owner.affiliateProfile?.referralCode
            ? ` • ${owner.affiliateProfile.referralCode}`
            : "";

          return (
            <option
              key={owner.id}
              value={owner.id}
              className="bg-neutral-950 text-white"
            >
              {owner.name} • {username}
              {referralCode}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export default async function AdminPartnerBotsPage({
  searchParams,
}: AdminPartnerBotsPageProps) {
  const params = await searchParams;
  const { owners, partnerBots, publicAppUrl } = await listPartnerBotsForAdmin();
  const activeCount = partnerBots.filter((partnerBot) => partnerBot.active).length;
  const ownersCount = new Set(partnerBots.map((partnerBot) => partnerBot.owner.id))
    .size;

  return (
    <div className="space-y-6">
      <AdminSurface>
        <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
          Partner bot
        </p>
        <h1 className="mt-4 text-4xl font-black text-white">
          Kelola bot partner affiliate
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-neutral-400">
          Daftarkan bot Telegram milik partner, hubungkan ke user owner, lalu
          biarkan Mini App partner otomatis membawa referral code owner saat
          dibuka dari bot tersebut.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <AdminMetricCard label="Total bot partner" value={partnerBots.length} />
          <AdminMetricCard label="Bot aktif" value={activeCount} />
          <AdminMetricCard label="Owner terhubung" value={ownersCount} />
        </div>
      </AdminSurface>

      {params.partner ? (
        <AdminSurface className="text-sm leading-6 text-neutral-200">
          {params.partner === "error" ? (
            <span className="text-red-200">
              {params.message ?? "Bot partner gagal disimpan."}
            </span>
          ) : (
            <span className="text-emerald-100">
              {params.message ?? "Bot partner berhasil diperbarui."}
            </span>
          )}
        </AdminSurface>
      ) : null}

      <AdminSurface>
        <p className="text-sm font-semibold text-orange-200">Tambah bot baru</p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Daftarkan bot milik partner
        </h2>
        <p className="mt-3 text-sm leading-6 text-neutral-400">
          Tempel bot token. Sistem akan verifikasi ke Telegram lewat `getMe`,
          lalu menyimpan username bot, webhook secret, dan owner referral-nya.
        </p>

        <form action={savePartnerBotFromAdmin} className="mt-6 space-y-5">
          <input type="hidden" name="redirectTo" value="/admin/partners" />

          <div className="grid gap-4 lg:grid-cols-2">
            <OwnerSelect owners={owners} />
            <Field
              label="Nama internal / label bot"
              name="label"
              placeholder="Mis. Bot partner Aan Hendri"
            />
            <Field
              label="Bot token Telegram"
              name="botToken"
              placeholder="123456:AA..."
            />
            <Field
              label="Mini App shortname"
              name="miniAppShortName"
              placeholder="Opsional kalau bot punya shortname sendiri"
            />
            <Field
              label="Channel default partner"
              name="defaultChannelUsername"
              placeholder="@channelpartner atau https://t.me/channelpartner"
            />
          </div>

          <label className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
            <input
              type="checkbox"
              name="active"
              defaultChecked
              className="size-4 accent-red-500"
            />
            Langsung aktifkan bot partner ini
          </label>

          <PendingSubmitButton
            pendingLabel="Menyimpan..."
            className="h-11 bg-red-600 text-white hover:bg-red-500"
          >
            Simpan bot partner
          </PendingSubmitButton>
        </form>
      </AdminSurface>

      <div className="space-y-5">
        {partnerBots.map((partnerBot) => {
          const setWebhookCommand = [
            `curl -X POST "https://api.telegram.org/bot${partnerBot.botToken}/setWebhook" \\`,
            `  -d "url=${partnerBot.webhookUrl}" \\`,
            `  -d "secret_token=${partnerBot.webhookSecret}"`,
          ].join("\n");
          const deleteWebhookCommand = `curl "https://api.telegram.org/bot${partnerBot.botToken}/deleteWebhook"`;

          return (
            <AdminSurface key={partnerBot.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-2xl font-black text-white">
                      {partnerBot.label?.trim() || partnerBot.botName}
                    </p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        partnerBot.active
                          ? "bg-emerald-500/15 text-emerald-200"
                          : "bg-white/10 text-neutral-300"
                      }`}
                    >
                      {partnerBot.active ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">
                    @{partnerBot.botUsername} • owner {partnerBot.owner.name}
                    {partnerBot.owner.telegramUsername
                      ? ` (@${partnerBot.owner.telegramUsername})`
                      : ""}
                    {partnerBot.owner.affiliateProfile?.referralCode
                      ? ` • ${partnerBot.owner.affiliateProfile.referralCode}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Channel default:{" "}
                    <span className="text-neutral-300">
                      {partnerBot.defaultChannelUsername?.trim()
                        ? partnerBot.defaultChannelUsername
                        : "belum diatur"}
                    </span>
                  </p>
                </div>

                {partnerBot.links ? (
                  <div className="rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-300">
                    <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">
                      Link aktif
                    </p>
                    <p className="mt-2 break-all text-white">
                      {partnerBot.links.startChatUrl}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)]">
                <div className="space-y-4">
                  <form action={savePartnerBotFromAdmin} className="space-y-4">
                    <input
                      type="hidden"
                      name="redirectTo"
                      value="/admin/partners"
                    />
                    <input
                      type="hidden"
                      name="partnerBotId"
                      value={partnerBot.id}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <OwnerSelect
                        owners={owners}
                        defaultValue={partnerBot.owner.id}
                      />
                      <Field
                        defaultValue={partnerBot.label}
                        label="Nama internal / label bot"
                        name="label"
                      />
                      <Field
                        defaultValue={partnerBot.botToken}
                        label="Bot token Telegram"
                        name="botToken"
                      />
                      <Field
                        defaultValue={partnerBot.miniAppShortName}
                        label="Mini App shortname"
                        name="miniAppShortName"
                      />
                      <Field
                        defaultValue={partnerBot.defaultChannelUsername}
                        label="Channel default partner"
                        name="defaultChannelUsername"
                        placeholder="@channelpartner atau https://t.me/channelpartner"
                      />
                    </div>

                    <label className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={partnerBot.active}
                        className="size-4 accent-red-500"
                      />
                      Bot partner ini aktif
                    </label>

                    <PendingSubmitButton
                      pendingLabel="Menyimpan..."
                      className="h-11 bg-red-600 text-white hover:bg-red-500"
                    >
                      Simpan perubahan
                    </PendingSubmitButton>
                  </form>

                  <form action={deletePartnerBotFromAdmin}>
                    <div className="flex flex-wrap gap-3">
                      <input
                        type="hidden"
                        name="redirectTo"
                        value="/admin/partners"
                      />
                      <input
                        type="hidden"
                        name="partnerBotId"
                        value={partnerBot.id}
                      />
                      <PendingSubmitButton
                        pendingLabel="Menghapus..."
                        variant="secondary"
                        className="h-11 border border-white/10 bg-white/[0.08] text-white hover:bg-white/[0.14]"
                      >
                        Hapus bot
                      </PendingSubmitButton>
                    </div>
                  </form>
                </div>

                <div className="space-y-4">
                  <CopyCodeBlock
                    title="Webhook URL"
                    code={partnerBot.webhookUrl}
                  />
                  <CopyCodeBlock
                    title="Command setWebhook"
                    code={setWebhookCommand}
                  />
                  <CopyCodeBlock
                    title="Command deleteWebhook"
                    code={deleteWebhookCommand}
                  />
                  {partnerBot.links ? (
                    <>
                      <CopyCodeBlock
                        title="Deep link partner"
                        code={partnerBot.links.startChatUrl}
                      />
                      <CopyCodeBlock
                        title="Mini App partner"
                        code={partnerBot.links.miniAppUrl}
                      />
                    </>
                  ) : (
                    <div className="rounded-[18px] border border-white/10 bg-black/20 p-4 text-sm leading-6 text-neutral-400">
                      Owner bot ini belum punya referral code aktif. Buka halaman
                      affiliate user sekali atau simpan ulang bot agar kode
                      referral dibuat otomatis.
                    </div>
                  )}
                </div>
              </div>
            </AdminSurface>
          );
        })}
      </div>

      <AdminSurface className="text-sm leading-7 text-neutral-400">
        <p className="font-semibold text-white">Catatan flow partner</p>
        <ul className="mt-3 space-y-2">
          <li>
            1. Admin daftarkan bot partner dan pilih owner-nya.
          </li>
          <li>
            2. Jalankan command `setWebhook` di atas supaya Telegram mengirim
            `/start` ke route partner.
          </li>
          <li>
            3. Saat user membuka bot atau Mini App partner, referral owner bot
            otomatis ikut menempel.
          </li>
          <li>
            4. App utama yang dipakai tetap {publicAppUrl}, tapi identitas bot
            penandatangan auth akan dibaca dari token partner.
          </li>
        </ul>
      </AdminSurface>
    </div>
  );
}
