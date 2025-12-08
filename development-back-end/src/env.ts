import { sql } from "drizzle-orm";
import { getDb } from "./db";
export type Env = {
  DATABASE_URL?: string;
  DB_URL?: string;
} & Record<string, unknown>;
export type AppEnv = Env & {
  ADMIN_TOKEN: string;
  ALLOWED_ORIGINS?: string;
  TRADE_KV?: KVNamespace;
  GIT_REV?: string;
};
export type Db = ReturnType<typeof getDb>;
export const ERR = {
  env_error: "env_error",
  bad_request: "bad_request",
  unauthorized: "unauthorized",
  auth_failed: "auth_failed",
  not_found: "not_found",
  asset_not_found: "asset_not_found",
  price_unavailable: "price_unavailable",
  insufficient_cash: "insufficient_cash",
  insufficient_quantity: "insufficient_quantity",
  method_not_allowed: "method_not_allowed",
  wallet_verify_failed: "wallet_verify_failed",
  rate_limited: "rate_llimited",
  idem_required: "idem_required",
  replay: "idempotent_replay",
  pnl_recall_required: "pnl_recall_required",
} as const;
export const ok = (c: any, data: any, message = "처리됐어요!!", s = 200) =>
  c.json({ ok: true, message, data }, s);
export const err = (c: any, code: string, detailOrMessage?: any, s = 400) => {
  const message =
    typeof detailOrMessage === "string" ? detailOrMessage : "오류가 발생했어요...";
  const detail =
    typeof detailOrMessage === "string" ? undefined : detailOrMessage;
  return c.json(
    detail !== undefined
      ? { ok: false, code, message, detail }
      : { ok: false, code, message },
    s,
  );
};
export const getDbNow = (env: AppEnv) => getDb(env);
export const clamp6dp = (n: number) =>
  Math.floor(Number(n) * 1e6) / 1e6;
export const isPositive = (n: unknown) =>
  Number.isFinite(Number(n)) && Number(n) > 0;
export const krwInt = (n: number) =>
  Math.round(Number(n) * 100) / 100;
export const toBool = (v?: string) =>
  String(v || "").trim().toLowerCase() === "true";
export const newToken = () =>
  [...crypto.getRandomValues(new Uint8Array(16))]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
export const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
export const DEC2 = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
export const idemKey = (c: any) =>
  (c.req.header("Idempotency-Key") || "").trim().slice(0, 128);
export function requireIdemOr400(c: any) {
  if (!idemKey(c)) {
    throw Object.assign(new Error(ERR.idem_required), { status: 400 });
  }
}
export async function guardIdem(env: AppEnv, key: string) {
  if (!key || !env.TRADE_KV) return;
  const existed = await env.TRADE_KV.get(`idem:${key}`);
  if (existed) {
    const e: any = new Error(ERR.replay);
    e.status = 409;
    throw e;
  }
  await env.TRADE_KV.put(`idem:${key}`, "1", { expirationTtl: 300 });
}
export async function rateLimit(
  c: any,
  keyBase: string,
  limit = 5,
  windowSec = 60,
) {
  if (!c.env.TRADE_KV) return;
  const bucketSec = Math.max(60, windowSec | 0);
  const ip =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For") ||
    "ip:unknown";
  const key = `rl:${keyBase}:${ip}:${Math.floor(
    Date.now() / (bucketSec * 1000),
  )}`;
  const cur = +((await c.env.TRADE_KV.get(key)) || "0");
  if (cur >= limit) {
    const e: any = new Error(ERR.rate_limited);
    e.status = 429;
    throw e;
  }
  await c.env.TRADE_KV.put(key, String(cur + 1), {
    expirationTtl: bucketSec + 1,
  });
}
export async function withTx<T>(
  db: any,
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  await db.execute(sql`BEGIN`);
  try {
    const out = await fn(db);
    await db.execute(sql`COMMIT`);
    return out;
  } catch (e) {
    try {
      await db.execute(sql`ROLLBACK`);
    } catch {}
    throw e;
  }
}
export async function readJsonLimited<T = any>(
  req: Request,
  limit = 32 * 1024,
): Promise<T> {
  const reader: ReadableStreamDefaultReader<any> & any =
    (req as any).body?.getReader?.();
  if (!reader) return await req.json();
  let got = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    got += value?.length || 0;
    if (got > limit) {
      throw Object.assign(new Error("payload_too_large"), { status: 413 });
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(got);
  let off = 0;
  for (const c2 of chunks) {
    buf.set(c2, off);
    off += c2.length;
  }
  const text = new TextDecoder().decode(buf);
  return text ? JSON.parse(text) : ({} as any);
}
export const kstNowIso = () => {
  const now = new Date();
  const k = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const z = (v: number) => String(v).padStart(2, "0");
  return `${k.getUTCFullYear()}-${z(k.getUTCMonth() + 1)}-${z(
    k.getUTCDate(),
  )}T${z(k.getUTCHours())}:${z(k.getUTCMinutes())}:${z(
    k.getUTCSeconds(),
  )}+09:00`;
};
export const PRICE_TTL_MS = 60_000;
export const kvGetJson = async <T = any>(
  env: AppEnv,
  key: string,
): Promise<T | null> => {
  try {
    const raw = await env.TRADE_KV?.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
export const kvPutJson = async (
  env: AppEnv,
  key: string,
  val: any,
  ttl = PRICE_TTL_MS / 1000,
) => {
  try {
    await env.TRADE_KV?.put(key, JSON.stringify(val), {
      expirationTtl: ttl,
    });
  } catch {}
};
export const kvKeyUnit = (symbol: string) =>
  `price:unit:${String(symbol || "").toUpperCase().trim()}`;
export async function fetchWithRetry(
  u: string,
  init: RequestInit = {},
  tries = 3,
  baseDelayMs = 150,
) {
  let last: any = null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(u, init);
      if (r.ok || (r.status >= 400 && r.status < 500)) return r;
      last = `${r.status}`;
    } catch (e: any) {
      last = String(e?.message || e);
    }
    await new Promise(res =>
      setTimeout(res, baseDelayMs * Math.pow(2, i)),
    );
  }
  throw new Error(`fetch_failed:${last}`);
}
export const constantTimeEqual = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
};
export const isHex = (src: string) =>
  /^[0-9a-f]+$/i.test(src) && src.length % 2 === 0;
export function decodeBytesAuto(src: string) {
  const v = String(src || "").trim();
  if (!v) return new Uint8Array();
  if (isHex(v)) {
    const out = new Uint8Array(v.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(v.substr(i * 2, 2), 16);
    }
    return out;
  }
  return Uint8Array.from(atob(v), c => c.charCodeAt(0));
}
export function normalizeHashName(s: string) {
  const t = String(s || "").toLowerCase().replace(/_/g, "-");
  if (t === "sha256" || t === "sha-256") return "SHA-256";
  if (t === "sha1" || t === "sha-1") return "SHA-1";
  if (t === "sha384" || t === "sha-384") return "SHA-384";
  if (t === "sha512" || t === "sha-512") return "SHA-512";
  return "SHA-256";
}
export async function verifyPasswordPBKDF2(
  password: string,
  saltEnc: string,
  params: string,
  hashEnc: string,
): Promise<boolean> {
  const p = String(params || "").split(":");
  if ((p[0] || "").toLowerCase() !== "pbkdf2") return false;
  const hash = normalizeHashName(p[1] || "sha-256");
  const iterations = Number(p[2] || 100000);
  const keyLen = Number(p[3] || 32);
  if (!Number.isFinite(iterations) || !Number.isFinite(keyLen)) return false;
  if (iterations < 100000 || iterations > 600000) return false;
  if (keyLen !== 32) return false;
  const salt = decodeBytesAuto(saltEnc);
  const stored = decodeBytesAuto(hashEnc);
  if (!salt.length || !stored.length) return false;
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash, salt, iterations },
    baseKey,
    keyLen * 8,
  );
  const derived = new Uint8Array(bits);
  const cmp =
    stored.length === derived.length
      ? derived
      : derived.slice(0, stored.length);
  return constantTimeEqual(cmp, stored);
}
export async function verifyUserSimple(
  env: Env,
  id: string,
  password: string,
) {
  const db = getDb(env);
  const idNorm = id.trim().toLowerCase();
  const row: any = (
    await db.execute(sql`
      SELECT user_id,id,password_salt,password_params,password_hash
      FROM users
      WHERE lower(id) = ${idNorm}
      LIMIT 1
    `)
  ).rows?.[0];
  if (!row) throw new Error("not_found");
  const pw = String(password ?? "").trim();
  const salt = String(row.password_salt || "");
  const params = String(row.password_params || "");
  const hash = String(row.password_hash || "");
  let okp = false;
  if (salt && params && hash) {
    okp = await verifyPasswordPBKDF2(pw, salt, params, hash);
  } else if (hash) {
    okp = hash === pw;
  }
  if (!okp) throw new Error(ERR.auth_failed);
  return {
    userId: String(row.user_id),
    id: String(row.id),
  };
}
export const PASSWORD_REGEX = /^(?=.*[^A-Za-z0-9]).{6,}$/;
export type UserPiaRankingRow = {
  rank: number;
  userId: string;
  id: string;
  cashPia: number;
  pnl: number;
};
export async function getUserRankingByPia(
  env: Env,
  limit = 100,
): Promise<UserPiaRankingRow[]> {
  const db = getDb(env);
  const res: any = await db.execute(sql`
    SELECT user_id,id,cash_pia,pnl_buffer
    FROM users
    ORDER BY cash_pia DESC, pnl_buffer DESC, user_id ASC
    LIMIT ${limit}
  `);
  const rows = res.rows || [];
  return rows.map((r: any, idx: number) => ({
    rank: idx + 1,
    userId: String(r.user_id),
    id: String(r.id),
    cashPia: krwInt(Number(r.cash_pia ?? 0)),
    pnl: krwInt(Number(r.pnl_buffer ?? 0)),
  }));
}
export async function getUserRankingByYield(
  env: Env,
  limit = 100,
): Promise<UserPiaRankingRow[]> {
  const db = getDb(env);
  const res: any = await db.execute(sql`
    SELECT user_id,id,cash_pia,pnl_buffer
    FROM users
    ORDER BY pnl_buffer DESC, cash_pia DESC, user_id ASC
    LIMIT ${limit}
  `);
  const rows = res.rows || [];
  return rows.map((r: any, idx: number) => ({
    rank: idx + 1,
    userId: String(r.user_id),
    id: String(r.id),
    cashPia: krwInt(Number(r.cash_pia ?? 0)),
    pnl: krwInt(Number(r.pnl_buffer ?? 0)),
  }));
}
export function requireEnv(env: AppEnv) {
  const need = ["ADMIN_TOKEN"] as const;
  const miss = need.filter(k => !String((env as any)[k] ?? "").trim());
  if (miss.length) {
    throw new Error(
      `환경 변수가 설정되지 않았어요... (${miss.join(", ")})`,
    );
  }
}
export const parseAllowedOrigins = (s?: string) =>
  (s || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
export const ORIGIN_LIST = (src?: string) =>
  String(src || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);