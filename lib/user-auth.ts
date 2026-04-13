import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const USER_SESSION_COOKIE = "boxofice_user_session";
export const USER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type AuthUser = {
  email: string;
  id: string;
  name: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function createTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getCookieOptions() {
  return {
    httpOnly: true,
    maxAge: USER_SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function registerUser(input: {
  email: string;
  name: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();

  if (name.length < 2) {
    throw new Error("Nama minimal 2 karakter.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error("Email sudah terdaftar.");
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(input.password, salt);

  return prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      passwordSalt: salt,
    },
    select: {
      email: true,
      id: true,
      name: true,
    },
  });
}

export async function verifyUserCredentials(input: {
  email: string;
  password: string;
}) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(input.email) },
    select: {
      email: true,
      id: true,
      name: true,
      passwordHash: true,
      passwordSalt: true,
    },
  });

  if (!user) {
    throw new Error("Email atau password tidak cocok.");
  }

  const candidateHash = hashPassword(input.password, user.passwordSalt);
  const isValid = timingSafeEqual(
    Buffer.from(candidateHash, "hex"),
    Buffer.from(user.passwordHash, "hex"),
  );

  if (!isValid) {
    throw new Error("Email atau password tidak cocok.");
  }

  return {
    email: user.email,
    id: user.id,
    name: user.name,
  };
}

export async function createUserSession(user: AuthUser) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createTokenHash(token);
  const expiresAt = new Date(Date.now() + USER_SESSION_TTL_SECONDS * 1000);

  await prisma.userSession.create({
    data: {
      expiresAt,
      tokenHash,
      userId: user.id,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set({
    ...getCookieOptions(),
    name: USER_SESSION_COOKIE,
    value: token,
  });
}

export async function getCurrentUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = createTokenHash(token);
  const session = await prisma.userSession.findUnique({
    where: { tokenHash },
    select: {
      expiresAt: true,
      id: true,
      user: {
        select: {
          email: true,
          id: true,
          name: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.userSession.delete({
      where: { id: session.id },
    }).catch(() => undefined);

    return null;
  }

  return session.user;
}

export async function requireUserSession() {
  const user = await getCurrentUserSession();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function logoutCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;

  if (token) {
    const tokenHash = createTokenHash(token);
    await prisma.userSession.deleteMany({
      where: { tokenHash },
    });
  }

  cookieStore.set({
    ...getCookieOptions(),
    name: USER_SESSION_COOKIE,
    value: "",
    maxAge: 0,
  });
}

export async function changeUserPassword(input: {
  currentPassword: string;
  newPassword: string;
  userId: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      passwordHash: true,
      passwordSalt: true,
    },
  });

  if (!user) {
    throw new Error("User tidak ditemukan.");
  }

  const currentHash = hashPassword(input.currentPassword, user.passwordSalt);
  const isValid = timingSafeEqual(
    Buffer.from(currentHash, "hex"),
    Buffer.from(user.passwordHash, "hex"),
  );

  if (!isValid) {
    throw new Error("Password lama tidak cocok.");
  }

  const nextSalt = randomBytes(16).toString("hex");
  const nextHash = hashPassword(input.newPassword, nextSalt);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: nextHash,
      passwordSalt: nextSalt,
    },
  });
}
