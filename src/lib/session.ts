// Работает и в edge-рантайме (middleware), поэтому только jose, без node-модулей.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sm_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = { sub: string; epoch: number };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET не задан или короче 32 символов");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ epoch: payload.epoch })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.epoch !== "number") return null;
    return { sub: payload.sub, epoch: payload.epoch };
  } catch {
    return null;
  }
}
