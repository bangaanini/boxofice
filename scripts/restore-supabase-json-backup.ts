import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

type BackupRow = Record<string, unknown>;
type BackupData = Record<string, BackupRow[]>;

const restoreOrder = [
  "User",
  "TelegramBotSettings",
  "VipProgramSettings",
  "VipPlan",
  "TelegramReferralIntent",
  "AffiliateProfile",
  "PartnerBot",
  "VipPaymentOrder",
  "AffiliateReferral",
  "AffiliatePayoutRequest",
  "AffiliateActivity",
  "UserSession",
];

const replaceTables = [
  "ChannelBroadcast",
  "AffiliateActivity",
  "AffiliatePayoutRequest",
  "AffiliateReferral",
  "VipPaymentOrder",
  "PartnerBot",
  "TelegramReferralIntent",
  "UserSession",
  "AffiliateProfile",
  "TelegramBotSettings",
  "VipProgramSettings",
  "VipPlan",
  "UserFavorite",
  "WatchHistory",
  "User",
];

const jsonColumnsByTable: Record<string, Set<string>> = {
  PartnerBot: new Set(["settingsOverrides"]),
  TelegramBotSettings: new Set(["inlineButtons"]),
  VipPaymentOrder: new Set(["metadata"]),
};

function readArgs() {
  const args = process.argv.slice(2);
  const backupPath = args.find((arg) => !arg.startsWith("--"));

  return {
    allowRemote: args.includes("--allow-remote"),
    backupPath,
    includeChannelBroadcasts: args.includes("--include-channel-broadcasts"),
    replace: args.includes("--replace"),
    yes: args.includes("--yes"),
  };
}

function prepareColumnValue(table: string, column: string, value: unknown) {
  if (value == null) {
    return value;
  }

  if (jsonColumnsByTable[table]?.has(column)) {
    return JSON.stringify(value);
  }

  return value;
}

function quoteIdent(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function assertSafeTarget(databaseUrl: string, allowRemote: boolean) {
  const parsed = new URL(databaseUrl);
  const host = parsed.hostname.toLowerCase();
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local");

  if (!isLocal && !allowRemote) {
    throw new Error(
      `Target database bukan lokal (${host}). Tambahkan --allow-remote kalau memang sengaja restore ke remote.`,
    );
  }
}

function loadBackup(backupPath: string) {
  const resolvedPath = path.resolve(backupPath);
  const raw = fs.readFileSync(resolvedPath, "utf8");
  const data = JSON.parse(raw) as BackupData;

  return {
    data,
    resolvedPath,
  };
}

function buildUpsertQuery(table: string, row: BackupRow) {
  const columns = Object.keys(row);

  if (!columns.includes("id")) {
    throw new Error(`Tabel ${table} tidak punya kolom id di backup.`);
  }

  const insertColumns = columns.map(quoteIdent).join(", ");
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const updateColumns = columns
    .filter((column) => column !== "id")
    .map((column) => `${quoteIdent(column)} = excluded.${quoteIdent(column)}`)
    .join(", ");

  return {
    query: [
      `insert into public.${quoteIdent(table)} (${insertColumns})`,
      `values (${placeholders})`,
      `on conflict (${quoteIdent("id")}) do update set ${updateColumns}`,
    ].join(" "),
    values: columns.map((column) =>
      prepareColumnValue(table, column, row[column]),
    ),
  };
}

async function restoreTable(client: Client, table: string, rows: BackupRow[]) {
  if (!rows.length) {
    return 0;
  }

  for (const row of rows) {
    const { query, values } = buildUpsertQuery(table, row);
    await client.query(query, values);
  }

  return rows.length;
}

async function main() {
  const args = readArgs();

  if (!args.backupPath) {
    throw new Error(
      "Path backup wajib diisi. Contoh: npx tsx scripts/restore-supabase-json-backup.ts backups/.../full-backup.json --replace --yes",
    );
  }

  const databaseUrl = process.env.RESTORE_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL atau RESTORE_DATABASE_URL belum tersedia.");
  }

  assertSafeTarget(databaseUrl, args.allowRemote);

  const { data, resolvedPath } = loadBackup(args.backupPath);
  const tables = restoreOrder;
  const counts = Object.fromEntries(
    tables.map((table) => [table, data[table]?.length ?? 0]),
  );

  console.log("Restore target:", new URL(databaseUrl).host);
  console.log("Backup file:", resolvedPath);
  console.log("Mode:", args.replace ? "replace/truncate selected user data" : "upsert only");
  console.log("Tables:", counts);

  if (args.includeChannelBroadcasts) {
    console.log(
      "Info: ChannelBroadcast dilewati. Tabel ini bergantung ke data Movie lokal dengan ID yang sama.",
    );
  }

  if (!args.yes) {
    console.log("\nDry run selesai. Tambahkan --yes untuk menjalankan restore.");
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("begin");

    if (args.replace) {
      await client.query(
        `truncate table ${replaceTables
          .map((table) => `public.${quoteIdent(table)}`)
          .join(", ")} restart identity cascade`,
      );
    }

    for (const table of tables) {
      const restored = await restoreTable(client, table, data[table] ?? []);
      console.log(`Restored ${table}: ${restored}`);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Restore gagal:", message);
  process.exitCode = 1;
});
