import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hash, verify } from "@node-rs/argon2";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./session";

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

// Чтобы время ответа не выдавало, существует ли логин.
let dummyHash: Promise<string> | null = null;
const getDummy = () => (dummyHash ??= hash("dummy-password-for-timing", ARGON));

export const hashPassword = (password: string) => hash(password, ARGON);

export async function checkCredentials(username: string, password: string) {
  const user = await db.adminUser.findUnique({ where: { username } });
  const ok = await verify(user?.passwordHash ?? (await getDummy()), password).catch(() => false);
  return ok && user ? user : null;
}

export async function startSession(userId: string, epoch: number) {
  const token = await signSession({ sub: userId, epoch });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getAdmin() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.adminUser.findUnique({ where: { id: session.sub } });
  if (!user || user.sessionEpoch !== session.epoch) return null;
  return user;
}

// Вызывается в начале КАЖДОГО server action админки: action можно дёрнуть POST-ом с любого пути,
// middleware их не прикрывает.
export async function requireAdmin() {
  const user = await getAdmin();
  if (!user) redirect("/admin/login");
  return user;
}
