import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "drizzle-orm";
import {
  AppEnv,
  ok,
  err,
  requireEnv,
  getDbNow,
  readJsonLimited,
  ERR,
  parseAllowedOrigins,
  ORIGIN_LIST,
  kstNowIso,
} from "./env";
import { registerTradeRoutes } from "./trade";
type AppBindings = { Bindings: AppEnv };
const app = new Hono<AppBindings>();
function setSecurityHeaders(c: Context<AppBindings>) {
  c.header("X-Frame-Options", "DENY");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header(
    "Permissions-Policy",
    "accelerometer=(),autoplay=(),camera=(),display-capture=(),encrypted-media=(),fullscreen=(),geolocation=(),gyroscope=(),magnetometer=(),microphone=(),midi=(),payment=(),picture-in-picture=(),sync-xhr=(),usb=(),xr-spatial-tracking=()",
  );
  c.header(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
}
app.use("*", async (c, next) => {
  requireEnv(c.env);
  const origin = c.req.header("Origin") || "";
  const allowList =
    parseAllowedOrigins(c.env.ALLOWED_ORIGINS) ||
    ORIGIN_LIST(c.env.ALLOWED_ORIGINS);
  if (origin && (!allowList.length || allowList.includes(origin))) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Vary", "Origin");
  }
  c.header("Access-Control-Allow-Credentials", "true");
  c.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Idempotency-Key, Authorization",
  );
  c.header("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  setSecurityHeaders(c);
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  return next();
});
app.get("/__whoami", c =>
  ok(
    c,
    {
      env: c.env,
      git: c.env.GIT_REV || null,
      ts: kstNowIso(),
    },
    "상태를 확인했어요!!",
  ),
);
app.get("/health", async c => {
  try {
    const db = getDbNow(c.env);
    await db.execute(sql`SELECT 1`);
    return ok(c, { status: "ok" }, "서버가 정상 동작 중이에요!!");
  } catch {
    return err(c, ERR.env_error, "서버 상태 확인에 실패했어요...", 500);
  }
});
app.post("/v1/cash/add", async c => {
  try {
    const raw = await readJsonLimited(c.req).catch(() => ({} as any));
    const token = (c.req.header("authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (!token || token !== String(c.env.ADMIN_TOKEN || "").trim()) {
      return err(c, ERR.unauthorized, "권한이 없어요...", 401);
    }
    const id = String(raw.id ?? "").trim();
    const delta = Number(
      raw.amountPia ??
        raw.amount_pia ??
        raw.amountKrw ??
        raw.amount_krw,
    );
    if (!id || !Number.isFinite(delta)) {
      return err(c, ERR.bad_request, "입력값이 올바르지 않아요...", 400);
    }
    const db = getDbNow(c.env);
    const r = await db.execute(sql`
      UPDATE users
      SET cash_pia = cash_pia + ${delta}
      WHERE id = ${id}
      RETURNING user_id, cash_pia
    `);
    if (!r.rows?.length) {
      return err(c, ERR.not_found, "유저를 찾을 수 없어요...", 404);
    }
    const row: any = (r.rows as any)[0];
    return ok(
      c,
      {
        id,
        cash_pia: +Number(row.cash_pia || 0).toFixed(2),
      },
      "현금(PIA)이 충전됐어요!!",
    );
  } catch (e: any) {
    return err(
      c,
      "cash_add_failed",
      "현금 충전에 실패했어요...",
      (e as any)?.status || 500,
    );
  }
});
app.get("/v1/ranks", async c => {
  try {
    const db = getDbNow(c.env);
    const qPia = await db.execute(sql`
      SELECT
        u.id AS user_id,
        COALESCE(u.cash_pia, 0) AS cash_pia
      FROM users u
      ORDER BY COALESCE(u.cash_pia, 0) DESC, u.created_at ASC
      LIMIT 100
    `);
    const piaRanks = (qPia.rows || []).map((r: any, idx: number) => ({
      rank: idx + 1,
      id: String(r.user_id),
      cash_pia: +Number(r.cash_pia || 0).toFixed(2),
    }));
    const qRet = await db.execute(sql`
      SELECT
        u.id AS user_id,
        COALESCE(u.cash_pia, 0) AS pia_balance,
        COALESCE(u.pnl_buffer, 0) AS pnl_buffer,
        u.created_at
      FROM users u
      ORDER BY COALESCE(u.pnl_buffer, 0) DESC, u.created_at ASC
      LIMIT 100
    `);
    const returnRanks = (qRet.rows || []).map((r: any, idx: number) => {
      const pia = Number(r.pia_balance || 0);
      const pnl = Number(r.pnl_buffer || 0);
      const rate = pia > 0 ? (pnl / pia) * 100 : 0;
      return {
        rank: idx + 1,
        id: String(r.user_id),
        pia_balance: +pia.toFixed(2),
        return_rate: +rate.toFixed(4),
      };
    });
    return ok(
      c,
      {
        byPia: piaRanks,
        byReturn: returnRanks,
      },
      "유저 순위 정보를 불러왔어요!!",
    );
  } catch (e: any) {
    return err(
      c,
      "ranks_failed",
      "유저 순위 조회에 실패했어요...",
      (e as any)?.status || 500,
    );
  }
});
registerTradeRoutes(app);
app.notFound(c =>
  err(c, ERR.not_found, "주소를 찾을 수 없어요...", 404),
);
export default {
  fetch: (req: Request, env: AppEnv, ctx: ExecutionContext) =>
    app.fetch(req, env, ctx),
};