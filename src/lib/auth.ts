/**
 * Passcode session tokens, signed with HMAC-SHA256 via Web Crypto so the same
 * code runs in the proxy and in route handlers. Single user: no user table.
 */
export const SESSION_COOKIE = "cadence_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function authConfigured(): boolean {
  return Boolean(process.env.APP_PASSCODE);
}

/** Dev convenience: with no passcode configured, local development is open. Production is locked. */
export function authBypassed(): boolean {
  return !authConfigured() && process.env.NODE_ENV !== "production";
}

async function secretKey(): Promise<CryptoKey> {
  // AUTH_SECRET is preferred; otherwise derive from the passcode so changing it revokes sessions.
  const material = process.env.AUTH_SECRET || `cadence:${process.env.APP_PASSCODE ?? ""}`;
  return crypto.subtle.importKey("raw", enc.encode(material), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function sign(payload: string): Promise<string> {
  return toHex(await crypto.subtle.sign("HMAC", await secretKey(), enc.encode(payload)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  return `${exp}.${await sign(`session:${exp}`)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !authConfigured()) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now() / 1000) return false;
  return safeEqual(sig, await sign(`session:${exp}`));
}

export async function passcodeMatches(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSCODE;
  if (!expected) return false;
  // Compare digests so the comparison is constant-time regardless of length.
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(input)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  return safeEqual(toHex(a), toHex(b));
}
