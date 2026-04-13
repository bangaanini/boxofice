export const ADMIN_SESSION_COOKIE = "boxofice_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

type AdminSessionPayload = {
  email: string;
  exp: number;
  v: 1;
};

export type AdminSession = {
  email: string;
  expiresAt: Date;
};

const DEFAULT_ADMIN_EMAIL = "admin@boxofice.local";
const DEFAULT_ADMIN_PASSWORD = "admin12345";
const encoder = new TextEncoder();

function getSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ??
    process.env.CRON_SECRET ??
    "boxofice-local-admin-session-secret"
  );
}

function base64UrlEncode(value: string | ArrayBuffer | Uint8Array) {
  if (typeof value === "string") {
    return Buffer.from(value).toString("base64url");
  }

  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return Buffer.from(bytes).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

async function getSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(payload: string) {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );

  return base64UrlEncode(signature);
}

export function getAdminEmail() {
  return process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;
}

export function getDefaultAdminPasswordHint() {
  return process.env.ADMIN_PASSWORD ? "configured in environment" : DEFAULT_ADMIN_PASSWORD;
}

export function usesDefaultAdminCredentials() {
  return !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD;
}

export function verifyAdminCredentials(email: string, password: string) {
  const configuredEmail = getAdminEmail().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;

  return (
    email.trim().toLowerCase() === configuredEmail &&
    password === configuredPassword
  );
}

export async function createAdminSessionToken(email = getAdminEmail()) {
  const payload: AdminSessionPayload = {
    email,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
    v: 1,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined,
): Promise<AdminSession | null> {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  try {
    const key = await getSigningKey();
    const isValidSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      Buffer.from(signature, "base64url"),
      encoder.encode(encodedPayload),
    );

    if (!isValidSignature) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<AdminSessionPayload>;

    if (
      payload.v !== 1 ||
      payload.email !== getAdminEmail() ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return {
      email: payload.email,
      expiresAt: new Date(payload.exp * 1000),
    };
  } catch {
    return null;
  }
}

export function sanitizeAdminRedirectPath(value: FormDataEntryValue | string | null) {
  const path = typeof value === "string" ? value : null;

  if (!path || path === "/admin/login" || path.startsWith("//")) {
    return "/admin";
  }

  if (!path.startsWith("/admin")) {
    return "/admin";
  }

  return path;
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    path: "/admin",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
