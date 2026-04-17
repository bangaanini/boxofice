"use client";

import * as React from "react";

import { updateTelegramBotPresentationSettings } from "@/app/admin/actions";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { cn } from "@/lib/utils";

type InlineButtonInput = {
  enabled: boolean;
  id: string;
  label: string;
  url: string;
};

type TelegramMessageEditorProps = {
  initialButtons: InlineButtonInput[];
  initialWelcomeMessage: string;
  previewDescription: string;
  previewHost: string;
  previewTitle: string;
};

function PreviewButton({
  fullWidth,
  label,
}: {
  fullWidth?: boolean;
  label: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[16px] border border-white/10 bg-[#253140] px-4 py-3 text-center text-sm font-semibold text-white",
        fullWidth && "col-span-full",
      )}
    >
      {label}
    </div>
  );
}

export function TelegramMessageEditor({
  initialButtons,
  initialWelcomeMessage,
  previewDescription,
  previewHost,
  previewTitle,
}: TelegramMessageEditorProps) {
  const [welcomeMessage, setWelcomeMessage] = React.useState(
    initialWelcomeMessage,
  );
  const [buttons, setButtons] = React.useState<InlineButtonInput[]>(
    initialButtons,
  );

  const previewRows = React.useMemo(() => {
    const rows: InlineButtonInput[][] = [];

    for (let index = 0; index < buttons.length; index += 2) {
      const row = buttons
        .slice(index, index + 2)
        .filter((button) => button.enabled && button.label.trim() && button.url.trim());

      if (row.length) {
        rows.push(row);
      }
    }

    return rows;
  }, [buttons]);

  function updateButton(
    index: number,
    patch: Partial<InlineButtonInput>,
  ) {
    setButtons((current) =>
      current.map((button, buttonIndex) =>
        buttonIndex === index ? { ...button, ...patch } : button,
      ),
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
      <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,18,16,0.96),rgba(13,9,8,0.98))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <p className="text-sm font-semibold text-orange-200">
          Form pengaturan
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Pesan sambutan dan inline keyboard
        </h2>
        <p className="mt-3 text-sm leading-6 text-neutral-400">
          Total ada 10 tombol. Setiap 2 tombol membentuk 1 baris. Jika hanya
          satu tombol aktif dalam satu baris, preview akan menampilkannya penuh.
        </p>

        <form action={updateTelegramBotPresentationSettings} className="mt-6 space-y-6">
          <input type="hidden" name="redirectTo" value="/admin/bot-message" />

          <div>
            <label className="block text-sm font-medium text-neutral-300">
              Pesan sambutan bot
            </label>
            <textarea
              name="welcomeMessage"
              value={welcomeMessage}
              onChange={(event) => setWelcomeMessage(event.target.value)}
              rows={12}
              className="mt-2 w-full rounded-[20px] border border-white/10 bg-black/25 px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-neutral-500"
            />
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Pakai placeholder <code className="rounded bg-black/30 px-1.5 py-0.5 text-neutral-200">{`{first_name}`}</code> atau{" "}
              <code className="rounded bg-black/30 px-1.5 py-0.5 text-neutral-200">{`{username}`}</code>.
            </p>
          </div>

          <div className="space-y-4">
            {buttons.map((button, index) => (
              <div
                key={button.id}
                className="rounded-[20px] border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Tombol {index + 1}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                      Baris {Math.floor(index / 2) + 1} · Posisi{" "}
                      {index % 2 === 0 ? "kiri" : "kanan"}
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-300">
                    <input
                      type="checkbox"
                      name={`buttonEnabled_${index + 1}`}
                      checked={button.enabled}
                      onChange={(event) =>
                        updateButton(index, { enabled: event.target.checked })
                      }
                      className="size-4 rounded border-white/20 bg-transparent text-red-500 focus:ring-red-500"
                    />
                    Aktif
                  </label>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300">
                      Label tombol
                    </label>
                    <input
                      name={`buttonLabel_${index + 1}`}
                      value={button.label}
                      onChange={(event) =>
                        updateButton(index, { label: event.target.value })
                      }
                      className="mt-2 h-12 w-full rounded-[18px] border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-neutral-500"
                      placeholder={`Contoh tombol ${index + 1}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300">
                      URL tombol
                    </label>
                    <input
                      name={`buttonUrl_${index + 1}`}
                      type="url"
                      value={button.url}
                      onChange={(event) =>
                        updateButton(index, { url: event.target.value })
                      }
                      className="mt-2 h-12 w-full rounded-[18px] border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-neutral-500"
                      placeholder="https://layarbox.app"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <PendingSubmitButton
            pendingLabel="Menyimpan..."
            className="h-11 bg-red-600 text-white hover:bg-red-500"
          >
            Simpan pesan dan keyboard
          </PendingSubmitButton>
        </form>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,18,16,0.96),rgba(13,9,8,0.98))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <p className="text-sm font-semibold text-orange-200">Live preview</p>

        <div className="mt-4 rounded-[20px] border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Preview SEO
          </p>
          <p className="mt-3 text-lg font-semibold text-white">{previewTitle}</p>
          <p className="mt-2 text-sm text-orange-200">{previewHost}</p>
          <p className="mt-3 text-sm leading-6 text-neutral-400">
            {previewDescription}
          </p>
        </div>

        <div className="mt-4 space-y-3 rounded-[24px] border border-white/10 bg-[#1f2c3a] p-4">
          <div className="rounded-[18px] bg-[#2c3947] p-4 text-sm leading-7 text-white">
            {welcomeMessage
              .replace(/\{first_name\}/gi, "Aan Hendri")
              .replace(/\{username\}/gi, "@aanhendri")}
          </div>

          {previewRows.length > 0 ? (
            previewRows.map((row, index) => (
              <div
                key={`preview-row-${index}`}
                className={cn(
                  "grid gap-2",
                  row.length === 1 ? "grid-cols-1" : "grid-cols-2",
                )}
              >
                {row.map((button) => (
                  <PreviewButton
                    key={button.id}
                    label={button.label}
                    fullWidth={row.length === 1}
                  />
                ))}
              </div>
            ))
          ) : (
            <div className="rounded-[18px] border border-dashed border-white/10 px-4 py-6 text-center text-sm text-neutral-400">
              Aktifkan minimal satu tombol untuk melihat preview keyboard.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
