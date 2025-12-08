import { Hono } from "hono";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { assets } from "./schema";
import {
  AppEnv,
  ERR,
  ok,
  err,
  getDbNow,
  krwInt,
  rateLimit,
  requireIdemOr400,
  guardIdem,
  readJsonLimited,
  kvGetJson,
  kvPutJson,
  kvKeyUnit,
  PRICE_TTL_MS,
  fetchWithRetry,
  YAHOO_UA,
  DEC2,
  verifyUserSimple,
  withTx,
  PASSWORD_REGEX,
} from "./env";
export type AssetType = "crypto" | "stock_krx" | "stock_us" | "index" | "indicator";
export type AssetDef = {
  symbol: string;
  type: AssetType;
  unit: number;
  upbitMarket?: string;
  krxCode?: string;
  usTicker?: string;
  yahooTicker?: string;
  currency?: "KRW" | "USD";
  title: string;
  short: string;
};
export const CATALOG: Record<string, AssetDef> = {
  BTC: { symbol: "BTC", type: "crypto", unit: 0.00001, upbitMarket: "KRW-BTC", title: "PIAREA-Coin-BTC", short: "cbtc" },
  ETH: { symbol: "ETH", type: "crypto", unit: 0.0001, upbitMarket: "KRW-ETH", title: "PIAREA-Coin-ETH", short: "ceth" },
  USDT: { symbol: "USDT", type: "crypto", unit: 0.1, upbitMarket: "USDT-KRW", title: "PIAREA-Coin-USDT", short: "cusdt" },
  XRP: { symbol: "XRP", type: "crypto", unit: 0.1, upbitMarket: "KRW-XRP", title: "PIAREA-Coin-XRP", short: "cxrp" },
  BNB: { symbol: "BNB", type: "crypto", unit: 0.001, upbitMarket: "KRW-BNB", title: "PIAREA-Coin-BNB", short: "cbnb" },
  SOL: { symbol: "SOL", type: "crypto", unit: 0.001, upbitMarket: "KRW-SOL", title: "PIAREA-Coin-SOL", short: "csol" },
  USDC: { symbol: "USDC", type: "crypto", unit: 0.1, upbitMarket: "USDC-KRW", title: "PIAREA-Coin-USDC", short: "cusdc" },
  TRX: { symbol: "TRX", type: "crypto", unit: 1, upbitMarket: "KRW-TRX", title: "PIAREA-Coin-TRX", short: "ctrx" },
  DOGE: { symbol: "DOGE", type: "crypto", unit: 1, upbitMarket: "KRW-DOGE", title: "PIAREA-Coin-DOGE", short: "cdoge" },
  ADA: { symbol: "ADA", type: "crypto", unit: 1, upbitMarket: "KRW-ADA", title: "PIAREA-Coin-ADA", short: "cada" },
  HLP: { symbol: "HLP", type: "crypto", unit: 0.01, upbitMarket: undefined, title: "PIAREA-Coin-Hyperliquid", short: "chlp" },
  BCH: { symbol: "BCH", type: "crypto", unit: 0.01, upbitMarket: "KRW-BCH", title: "PIAREA-Coin-BCH", short: "cbch" },
  LINK: { symbol: "LINK", type: "crypto", unit: 0.01, upbitMarket: "KRW-LINK", title: "PIAREA-Coin-LINK", short: "clink" },
  LEO: { symbol: "LEO", type: "crypto", unit: 0.1, upbitMarket: undefined, title: "PIAREA-Coin-LEO", short: "cleo" },
  XLM: { symbol: "XLM", type: "crypto", unit: 1, upbitMarket: "KRW-XLM", title: "PIAREA-Coin-XLM", short: "cxlm" },
  ZEC: { symbol: "ZEC", type: "crypto", unit: 0.01, upbitMarket: "KRW-ZEC", title: "PIAREA-Coin-ZEC", short: "czec" },
  XMR: { symbol: "XMR", type: "crypto", unit: 0.01, upbitMarket: "KRW-XMR", title: "PIAREA-Coin-XMR", short: "cxmr" },
  USDE: { symbol: "USDE", type: "crypto", unit: 0.1, upbitMarket: undefined, title: "PIAREA-Coin-USDE", short: "cusde" },
  LTC: { symbol: "LTC", type: "crypto", unit: 0.01, upbitMarket: "KRW-LTC", title: "PIAREA-Coin-LTC", short: "cltc" },
  AVAX: { symbol: "AVAX", type: "crypto", unit: 0.01, upbitMarket: "KRW-AVAX", title: "PIAREA-Coin-AVAX", short: "cavax" },
  S005930: { symbol: "S005930", type: "stock_krx", unit: 0.001, krxCode: "005930", title: "PIAREA-Stock-005930", short: "s005930" },
  S000660: { symbol: "S000660", type: "stock_krx", unit: 0.001, krxCode: "000660", title: "PIAREA-Stock-000660", short: "s000660" },
  S373220: { symbol: "S373220", type: "stock_krx", unit: 0.001, krxCode: "373220", title: "PIAREA-Stock-373220", short: "s373220" },
  S207940: { symbol: "S207940", type: "stock_krx", unit: 0.001, krxCode: "207940", title: "PIAREA-Stock-207940", short: "s207940" },
  S005380: { symbol: "S005380", type: "stock_krx", unit: 0.001, krxCode: "005380", title: "PIAREA-Stock-005380", short: "s005380" },
  S034020: { symbol: "S034020", type: "stock_krx", unit: 0.001, krxCode: "034020", title: "PIAREA-Stock-034020", short: "s034020" },
  S105560: { symbol: "S105560", type: "stock_krx", unit: 0.001, krxCode: "105560", title: "PIAREA-Stock-105560", short: "s105560" },
  S329180: { symbol: "S329180", type: "stock_krx", unit: 0.001, krxCode: "329180", title: "PIAREA-Stock-329180", short: "s329180" },
  S000270: { symbol: "S000270", type: "stock_krx", unit: 0.001, krxCode: "000270", title: "PIAREA-Stock-000270", short: "s000270" },
  S012450: { symbol: "S012450", type: "stock_krx", unit: 0.001, krxCode: "012450", title: "PIAREA-Stock-012450", short: "s012450" },
  S068270: { symbol: "S068270", type: "stock_krx", unit: 0.001, krxCode: "068270", title: "PIAREA-Stock-068270", short: "s068270" },
  S402340: { symbol: "S402340", type: "stock_krx", unit: 0.001, krxCode: "402340", title: "PIAREA-Stock-402340", short: "s402340" },
  S035420: { symbol: "S035420", type: "stock_krx", unit: 0.001, krxCode: "035420", title: "PIAREA-Stock-035420", short: "s035420" },
  S028260: { symbol: "S028260", type: "stock_krx", unit: 0.001, krxCode: "028260", title: "PIAREA-Stock-028260", short: "s028260" },
  S055550: { symbol: "S055550", type: "stock_krx", unit: 0.001, krxCode: "055550", title: "PIAREA-Stock-055550", short: "s055550" },
  S015760: { symbol: "S015760", type: "stock_krx", unit: 0.001, krxCode: "015760", title: "PIAREA-Stock-015760", short: "s015760" },
  S042660: { symbol: "S042660", type: "stock_krx", unit: 0.001, krxCode: "042660", title: "PIAREA-Stock-042660", short: "s042660" },
  S032830: { symbol: "S032830", type: "stock_krx", unit: 0.001, krxCode: "032830", title: "PIAREA-Stock-032830", short: "s032830" },
  S009540: { symbol: "S009540", type: "stock_krx", unit: 0.001, krxCode: "009540", title: "PIAREA-Stock-009540", short: "s009540" },
  S196170: { symbol: "S196170", type: "stock_krx", unit: 0.001, krxCode: "196170", title: "PIAREA-Stock-196170", short: "s196170" },
  S012330: { symbol: "S012330", type: "stock_krx", unit: 0.001, krxCode: "012330", title: "PIAREA-Stock-012330", short: "s012330" },
  S267260: { symbol: "S267260", type: "stock_krx", unit: 0.001, krxCode: "267260", title: "PIAREA-Stock-267260", short: "s267260" },
  S003550: { symbol: "S003550", type: "stock_krx", unit: 0.001, krxCode: "003550", title: "PIAREA-Stock-003550", short: "s003550" },
  S035720: { symbol: "S035720", type: "stock_krx", unit: 0.001, krxCode: "035720", title: "PIAREA-Stock-035720", short: "s035720" },
  S086790: { symbol: "S086790", type: "stock_krx", unit: 0.001, krxCode: "086790", title: "PIAREA-Stock-086790", short: "s086790" },
  S010130: { symbol: "S010130", type: "stock_krx", unit: 0.001, krxCode: "010130", title: "PIAREA-Stock-010130", short: "s010130" },
  S005490: { symbol: "S005490", type: "stock_krx", unit: 0.001, krxCode: "005490", title: "PIAREA-Stock-005490", short: "s005490" },
  S006400: { symbol: "S006400", type: "stock_krx", unit: 0.001, krxCode: "006400", title: "PIAREA-Stock-006400", short: "s006400" },
  S000810: { symbol: "S000810", type: "stock_krx", unit: 0.001, krxCode: "000810", title: "PIAREA-Stock-000810", short: "s000810" },
  S010140: { symbol: "S010140", type: "stock_krx", unit: 0.001, krxCode: "010140", title: "PIAREA-Stock-010140", short: "s010140" },
  NVDA: { symbol: "NVDA", type: "stock_us", unit: 0.001, usTicker: "NVDA", title: "PIAREA-Stock-NVDA", short: "snvda" },
  AAPL: { symbol: "AAPL", type: "stock_us", unit: 0.001, usTicker: "AAPL", title: "PIAREA-Stock-AAPL", short: "saapl" },
  GOOGL: { symbol: "GOOGL", type: "stock_us", unit: 0.001, usTicker: "GOOGL", title: "PIAREA-Stock-GOOGL", short: "sgoogl" },
  MSFT: { symbol: "MSFT", type: "stock_us", unit: 0.001, usTicker: "MSFT", title: "PIAREA-Stock-MSFT", short: "smsft" },
  AMZN: { symbol: "AMZN", type: "stock_us", unit: 0.001, usTicker: "AMZN", title: "PIAREA-Stock-AMZN", short: "samzn" },
  AVGO: { symbol: "AVGO", type: "stock_us", unit: 0.001, usTicker: "AVGO", title: "PIAREA-Stock-AVGO", short: "savgo" },
  META: { symbol: "META", type: "stock_us", unit: 0.001, usTicker: "META", title: "PIAREA-Stock-META", short: "smeta" },
  TSLA: { symbol: "TSLA", type: "stock_us", unit: 0.001, usTicker: "TSLA", title: "PIAREA-Stock-TSLA", short: "stsla" },
  BRKB: { symbol: "BRKB", type: "stock_us", unit: 0.001, usTicker: "BRK-B", title: "PIAREA-Stock-BRKB", short: "sbrkb" },
  LLY: { symbol: "LLY", type: "stock_us", unit: 0.001, usTicker: "LLY", title: "PIAREA-Stock-LLY", short: "slly" },
  WMT: { symbol: "WMT", type: "stock_us", unit: 0.001, usTicker: "WMT", title: "PIAREA-Stock-WMT", short: "swmt" },
  JPM: { symbol: "JPM", type: "stock_us", unit: 0.001, usTicker: "JPM", title: "PIAREA-Stock-JPM", short: "sjpm" },
  V: { symbol: "V", type: "stock_us", unit: 0.001, usTicker: "V", title: "PIAREA-Stock-V", short: "sv" },
  ORCL: { symbol: "ORCL", type: "stock_us", unit: 0.001, usTicker: "ORCL", title: "PIAREA-Stock-ORCL", short: "sorcl" },
  JNJ: { symbol: "JNJ", type: "stock_us", unit: 0.001, usTicker: "JNJ", title: "PIAREA-Stock-JNJ", short: "sjnj" },
  MA: { symbol: "MA", type: "stock_us", unit: 0.001, usTicker: "MA", title: "PIAREA-Stock-MA", short: "sma" },
  XOM: { symbol: "XOM", type: "stock_us", unit: 0.001, usTicker: "XOM", title: "PIAREA-Stock-XOM", short: "sxom" },
  NFLX: { symbol: "NFLX", type: "stock_us", unit: 0.001, usTicker: "NFLX", title: "PIAREA-Stock-NFLX", short: "snflx" },
  COST: { symbol: "COST", type: "stock_us", unit: 0.001, usTicker: "COST", title: "PIAREA-Stock-COST", short: "scost" },
  ABBV: { symbol: "ABBV", type: "stock_us", unit: 0.001, usTicker: "ABBV", title: "PIAREA-Stock-ABBV", short: "sabbv" },
  PLTR: { symbol: "PLTR", type: "stock_us", unit: 0.001, usTicker: "PLTR", title: "PIAREA-Stock-PLTR", short: "spltr" },
  BAC: { symbol: "BAC", type: "stock_us", unit: 0.001, usTicker: "BAC", title: "PIAREA-Stock-BAC", short: "sbac" },
  HD: { symbol: "HD", type: "stock_us", unit: 0.001, usTicker: "HD", title: "PIAREA-Stock-HD", short: "shd" },
  AMD: { symbol: "AMD", type: "stock_us", unit: 0.001, usTicker: "AMD", title: "PIAREA-Stock-AMD", short: "samd" },
  PG: { symbol: "PG", type: "stock_us", unit: 0.001, usTicker: "PG", title: "PIAREA-Stock-PG", short: "spg" },
  KO: { symbol: "KO", type: "stock_us", unit: 0.001, usTicker: "KO", title: "PIAREA-Stock-KO", short: "sko" },
  GE: { symbol: "GE", type: "stock_us", unit: 0.001, usTicker: "GE", title: "PIAREA-Stock-GE", short: "sge" },
  CVX: { symbol: "CVX", type: "stock_us", unit: 0.001, usTicker: "CVX", title: "PIAREA-Stock-CVX", short: "scvx" },
  CSCO: { symbol: "CSCO", type: "stock_us", unit: 0.001, usTicker: "CSCO", title: "PIAREA-Stock-CSCO", short: "scsco" },
  UNH: { symbol: "UNH", type: "stock_us", unit: 0.001, usTicker: "UNH", title: "PIAREA-Stock-UNH", short: "sunh" },
  SPX: { symbol: "SPX", type: "index", unit: 1, yahooTicker: "^GSPC", currency: "USD", title: "PIAREA-Index-SP500", short: "ispx" },
  NDX: { symbol: "NDX", type: "index", unit: 1, yahooTicker: "^NDX", currency: "USD", title: "PIAREA-Index-NAS100", short: "indx" },
  DJI: { symbol: "DJI", type: "index", unit: 1, yahooTicker: "^DJI", currency: "USD", title: "PIAREA-Index-DOW", short: "idji" },
  RUT: { symbol: "RUT", type: "index", unit: 1, yahooTicker: "^RUT", currency: "USD", title: "PIAREA-Index-RUS2000", short: "irut" },
  FTSE: { symbol: "FTSE", type: "index", unit: 1, yahooTicker: "^FTSE", currency: "USD", title: "PIAREA-Index-FTSE100", short: "iftse" },
  DAX: { symbol: "DAX", type: "index", unit: 1, yahooTicker: "^GDAXI", currency: "USD", title: "PIAREA-Index-DAX", short: "idax" },
  NIKKEI: { symbol: "NIKKEI", type: "index", unit: 1, yahooTicker: "^N225", currency: "USD", title: "PIAREA-Index-NIKKEI", short: "inikkei" },
  HSI: { symbol: "HSI", type: "index", unit: 1, yahooTicker: "^HSI", currency: "USD", title: "PIAREA-Index-HSI", short: "ihsi" },
  KOSPI: { symbol: "KOSPI", type: "index", unit: 1, yahooTicker: "^KS11", currency: "KRW", title: "PIAREA-Index-KOSPI", short: "ikospi" },
  KOSDAQ: { symbol: "KOSDAQ", type: "index", unit: 1, yahooTicker: "^KQ11", currency: "KRW", title: "PIAREA-Index-KOSDAQ", short: "ikosdaq" },
  GOLD: { symbol: "GOLD", type: "indicator", unit: 1, yahooTicker: "GC=F", currency: "USD", title: "PIAREA-Ind-GOLD", short: "igold" },
  SILVER: { symbol: "SILVER", type: "indicator", unit: 1, yahooTicker: "SI=F", currency: "USD", title: "PIAREA-Ind-SILVER", short: "isilver" },
  COPPER: { symbol: "COPPER", type: "indicator", unit: 1, yahooTicker: "HG=F", currency: "USD", title: "PIAREA-Ind-COPPER", short: "icopper" },
  NGAS: { symbol: "NGAS", type: "indicator", unit: 1, yahooTicker: "NG=F", currency: "USD", title: "PIAREA-Ind-NGAS", short: "ingas" },
  OILWTI: { symbol: "OILWTI", type: "indicator", unit: 1, yahooTicker: "CL=F", currency: "USD", title: "PIAREA-Ind-WTI", short: "iwti" },
  BRENT: { symbol: "BRENT", type: "indicator", unit: 1, yahooTicker: "BZ=F", currency: "USD", title: "PIAREA-Ind-BRENT", short: "ibrent" },
  DXY: { symbol: "DXY", type: "indicator", unit: 1, yahooTicker: "DX-Y.NYB", currency: "USD", title: "PIAREA-Ind-DXY", short: "idxy" },
  US10Y: { symbol: "US10Y", type: "indicator", unit: 1, yahooTicker: "^TNX", currency: "USD", title: "PIAREA-Ind-US10Y", short: "ius10y" },
  US2Y: { symbol: "US2Y", type: "indicator", unit: 1, yahooTicker: "^IRX", currency: "USD", title: "PIAREA-Ind-US2Y", short: "ius2y" },
  VIX: { symbol: "VIX", type: "indicator", unit: 1, yahooTicker: "^VIX", currency: "USD", title: "PIAREA-Ind-VIX", short: "ivix" },
};
export const getAssetDef = (sym: string) =>
  CATALOG[String(sym || "").toUpperCase().trim()] || null;
export type PriceUnitKRW =
  | {
      ok: true;
      perUnitKRW: number;
      perUnitKRWStr: string;
      unit: number;
      symbol: string;
      ts: number;
    }
  | {
      ok: false;
      msg: string;
    };
export async function yahooRegularPrice(ticker: string): Promise<number | null> {
  const h = {
    Accept: "application/json",
    "User-Agent": YAHOO_UA,
    "Accept-Language": "en-US,en;q=0.8,ko;q=0.7",
  };
  const fetchJ = async (u: string) => {
    try {
      const r = await fetchWithRetry(u, { headers: h });
      if (!r.ok) return null;
      return await r.json().catch(() => null);
    } catch {
      return null;
    }
  };
  let j = await fetchJ(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
      ticker,
    )}&region=US&lang=en-US`,
  );
  let px = Number(j?.quoteResponse?.result?.[0]?.regularMarketPrice);
  if (Number.isFinite(px) && px > 0) return px;
  const chartTry = async (host: "query1" | "query2") => {
    const cj = await fetchJ(
      `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        ticker,
      )}?range=1d&interval=1m&region=US&lang=en-US`,
    );
    const meta = cj?.chart?.result?.[0]?.meta || {};
    let v = Number(meta?.regularMarketPrice);
    if (!Number.isFinite(v) || v <= 0) {
      const closes: number[] =
        cj?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
      for (let i = closes.length - 1; i >= 0; i--) {
        const c = Number(closes[i]);
        if (Number.isFinite(c) && c > 0) {
          v = c;
          break;
        }
      }
    }
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  px = await chartTry("query1");
  if (px) return px;
  px = await chartTry("query2");
  if (px) return px;
  j = await fetchJ(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker,
    )}?range=1mo&interval=1d&region=US&lang=en-US`,
  );
  px = Number(j?.chart?.result?.[0]?.meta?.regularMarketPrice);
  if (Number.isFinite(px) && px > 0) return px;
  const closesMo: number[] =
    j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
  for (let i = closesMo.length - 1; i >= 0; i--) {
    const c = Number(closesMo[i]);
    if (Number.isFinite(c) && c > 0) return c;
  }
  return null;
}
export async function getUsdKrw(env: AppEnv): Promise<number | null> {
  const key = "fx:USD-KRW";
  const cached = await kvGetJson<{ v: number; ts: number }>(env, key);
  if (cached && Date.now() - cached.ts <= PRICE_TTL_MS) return cached.v;
  let fx: number | null = null;
  try {
    const r = await fetchWithRetry("https://api.upbit.com/v1/ticker?markets=KRW-USDT", {
      headers: { Accept: "application/json" },
    });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      const px = Array.isArray(j) ? Number(j[0]?.trade_price) : NaN;
      if (Number.isFinite(px) && px > 0) fx = px;
    }
  } catch {}
  if (fx == null) {
    const y = await yahooRegularPrice("USDKRW=X");
    if (y != null) fx = y;
  }
  if (fx != null) {
    await kvPutJson(env, key, { v: fx, ts: Date.now() });
    return fx;
  }
  return cached?.v ?? null;
}
export async function getCryptoUnitKRW(env: AppEnv, def: AssetDef): Promise<PriceUnitKRW> {
  if (!def.upbitMarket) return { ok: false, msg: "bad_market" };
  try {
    const r = await fetchWithRetry(
      `https://api.upbit.com/v1/ticker?markets=${def.upbitMarket}`,
      { headers: { Accept: "application/json" } },
    );
    if (!r.ok) return { ok: false, msg: "upbit_http" };
    const arr = await r.json().catch(() => null);
    const trade = Array.isArray(arr) ? Number(arr[0]?.trade_price) : NaN;
    if (!Number.isFinite(trade) || trade <= 0) {
      return { ok: false, msg: "price_unavailable" };
    }
    const perUnit = krwInt(trade * def.unit);
    return {
      ok: true,
      perUnitKRW: perUnit,
      perUnitKRWStr: perUnit.toLocaleString("ko-KR", DEC2),
      unit: def.unit,
      symbol: def.symbol,
      ts: Date.now(),
    };
  } catch {
    return { ok: false, msg: "price_fetch_failed" };
  }
}
export async function getKRXUnitKRW(env: AppEnv, def: AssetDef): Promise<PriceUnitKRW> {
  if (!def.krxCode) return { ok: false, msg: "bad_code" };
  try {
    const u = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${def.krxCode}`;
    const r = await fetchWithRetry(u, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      const item = j?.result?.areas?.[0]?.datas?.[0];
      const px = Number(
        item?.nv ?? item?.cv ?? item?.closePrice ?? item?.close ?? item?.np,
      );
      if (Number.isFinite(px) && px > 0) {
        const perUnit = krwInt(px * def.unit);
        return {
          ok: true,
          perUnitKRW: perUnit,
          perUnitKRWStr: perUnit.toLocaleString("ko-KR", DEC2),
          unit: def.unit,
          symbol: def.symbol,
          ts: Date.now(),
        };
      }
    }
  } catch {}
  const tryYahoo = async (code: string) => {
    for (const suf of ["KS", "KQ"] as const) {
      const y = await yahooRegularPrice(`${code}.${suf}`);
      if (Number.isFinite(y as number) && (y as number) > 0) {
        const perUnit = krwInt((y as number) * def.unit);
        return {
          ok: true as const,
          perUnitKRW: perUnit,
          perUnitKRWStr: perUnit.toLocaleString("ko-KR", DEC2),
          unit: def.unit,
          symbol: def.symbol,
          ts: Date.now(),
        };
      }
    }
    return null;
  };
  const alt = await tryYahoo(def.krxCode);
  return alt ?? { ok: false, msg: "price_unavailable" };
}
export async function getUSUnitKRW(env: AppEnv, def: AssetDef): Promise<PriceUnitKRW> {
  if (!def.usTicker) return { ok: false, msg: "bad_ticker" };
  const fx = await getUsdKrw(env);
  if (!fx || fx <= 0) return { ok: false, msg: "fx_unavailable" };
  const regular = await yahooRegularPrice(def.usTicker);
  if (!Number.isFinite(regular as number) || (regular as number) <= 0) {
    return { ok: false, msg: "price_unavailable" };
  }
  const perUnit = krwInt((regular as number) * fx * def.unit);
  return {
    ok: true,
    perUnitKRW: perUnit,
    perUnitKRWStr: perUnit.toLocaleString("ko-KR", DEC2),
    unit: def.unit,
    symbol: def.symbol,
    ts: Date.now(),
  };
}
export async function getIndexIndicatorUnit(env: AppEnv, def: AssetDef): Promise<PriceUnitKRW> {
  if (!def.yahooTicker) return { ok: false, msg: "bad_ticker" };
  const px = await yahooRegularPrice(def.yahooTicker);
  if (!Number.isFinite(px as number) || (px as number) <= 0) {
    return { ok: false, msg: "price_unavailable" };
  }
  let v = Number(px) * def.unit;
  if ((def.currency || "USD") === "USD") {
    const fx = await getUsdKrw(env);
    if (!fx || fx <= 0) return { ok: false, msg: "fx_unavailable" };
    v *= fx;
  }
  const perUnit = krwInt(v);
  return {
    ok: true,
    perUnitKRW: perUnit,
    perUnitKRWStr: perUnit.toLocaleString("ko-KR", DEC2),
    unit: def.unit,
    symbol: def.symbol,
    ts: Date.now(),
  };
}
export async function getUnitPriceKRWBySymbol(env: AppEnv, symbol: string) {
  const sym = String(symbol || "").toUpperCase().trim();
  const cached = await kvGetJson<{ priceKRWPerUnit: number; ts: number }>(
    env,
    kvKeyUnit(sym),
  );
  const fresh =
    cached &&
    Number.isFinite(cached.ts) &&
    Date.now() - cached.ts <= PRICE_TTL_MS;
  if (fresh && Number.isFinite(cached!.priceKRWPerUnit)) {
    return cached!.priceKRWPerUnit;
  }
  const def = getAssetDef(sym);
  if (!def) return null;
  let r: PriceUnitKRW;
  if (def.type === "crypto") r = await getCryptoUnitKRW(env, def);
  else if (def.type === "stock_krx") r = await getKRXUnitKRW(env, def);
  else if (def.type === "stock_us") r = await getUSUnitKRW(env, def);
  else r = await getIndexIndicatorUnit(env, def);
  if (r.ok) {
    await kvPutJson(env, kvKeyUnit(sym), {
      priceKRWPerUnit: r.perUnitKRW,
      ts: Date.now(),
    });
    return r.perUnitKRW;
  }
  return cached?.priceKRWPerUnit ?? null;
}
export async function getUserRowById(db: any, userId: string) {
  const r: any = (
    await db.execute(sql`
      SELECT user_id,id,cash_pia,pnl_buffer
      FROM users
      WHERE user_id=${userId}
      LIMIT 1
    `)
  ).rows?.[0];
  return r || null;
}
export async function getAssetRowBySymbol(db: any, symbol: string) {
  const r: any = (
    await db.execute(sql`
      SELECT id,symbol,name,kind
      FROM assets
      WHERE upper(symbol)=upper(${symbol})
      LIMIT 1
    `)
  ).rows?.[0];
  return r || null;
}
export async function holdingUnits(db: any, userId: string, assetId: string) {
  const q = await db.execute(sql`
    SELECT SUM(
      CASE WHEN side='buy'
        THEN CAST(qty AS REAL)
        ELSE-CAST(qty AS REAL)
      END
    ) AS units
    FROM orders
    WHERE user_id=${userId} AND asset_id=${assetId}
  `);
  return +Number(q.rows?.[0]?.units || 0).toFixed(8);
}
export async function avgBuyCostKRW(db: any, userId: string, assetId: string) {
  const q = await db.execute(sql`
    SELECT
      SUM(
        CASE WHEN side='buy'
          THEN (price*qty)::numeric
          ELSE 0
        END
      ) AS buy_value,
      SUM(
        CASE WHEN side='buy'
          THEN qty::numeric
          ELSE 0
        END
      ) AS buy_qty
    FROM orders
    WHERE user_id=${userId} AND asset_id=${assetId}
  `);
  const buyVal = Number(q.rows?.[0]?.buy_value || 0);
  const buyQty = Number(q.rows?.[0]?.buy_qty || 0);
  if (buyQty <= 0) return null;
  return buyVal / buyQty;
}
export function registerTradeRoutes(app: Hono<{ Bindings: AppEnv }>) {
  app.post("/v1/assets/seed", async c => {
    const token = (c.req.header("authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (!token || token !== String(c.env.ADMIN_TOKEN || "").trim()) {
      return err(c, ERR.unauthorized, "권한이 없어요...", 401);
    }
    const db = getDbNow(c.env);
    const data = [
      { symbol: "BTC", name: "비트코인", kind: "crypto", unit: 0.00001, dp: 5 },
      { symbol: "ETH", name: "이더리움", kind: "crypto", unit: 0.0001, dp: 4 },
      { symbol: "USDT", name: "테더", kind: "crypto", unit: 0.1, dp: 1 },
      { symbol: "XRP", name: "리플", kind: "crypto", unit: 0.1, dp: 1 },
      { symbol: "BNB", name: "BNB", kind: "crypto", unit: 0.001, dp: 3 },
      { symbol: "SOL", name: "솔라나", kind: "crypto", unit: 0.001, dp: 3 },
      { symbol: "USDC", name: "USDC", kind: "crypto", unit: 0.1, dp: 1 },
      { symbol: "TRX", name: "트론", kind: "crypto", unit: 1, dp: 0 },
      { symbol: "DOGE", name: "도지코인", kind: "crypto", unit: 1, dp: 0 },
      { symbol: "ADA", name: "카르다노", kind: "crypto", unit: 1, dp: 0 },
      { symbol: "HLP", name: "Hyperliquid", kind: "crypto", unit: 0.01, dp: 2 },
      { symbol: "BCH", name: "비트코인 캐시", kind: "crypto", unit: 0.01, dp: 2 },
      { symbol: "LINK", name: "체인링크", kind: "crypto", unit: 0.01, dp: 2 },
      { symbol: "LEO", name: "UNUS SED LEO", kind: "crypto", unit: 0.1, dp: 1 },
      { symbol: "XLM", name: "stellar", kind: "crypto", unit: 1, dp: 0 },
      { symbol: "ZEC", name: "Zcash", kind: "crypto", unit: 0.01, dp: 2 },
      { symbol: "XMR", name: "Monero", kind: "crypto", unit: 0.01, dp: 2 },
      { symbol: "USDE", name: "Ethena USDe", kind: "crypto", unit: 0.1, dp: 1 },
      { symbol: "LTC", name: "라이트코인", kind: "crypto", unit: 0.01, dp: 2 },
      { symbol: "AVAX", name: "아발란체", kind: "crypto", unit: 0.01, dp: 2 },
      { symbol: "S005930", name: "삼성전자", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S000660", name: "SK하이닉스", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S373220", name: "LG에너지솔루션", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S207940", name: "삼성바이오로직스", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S005380", name: "현대차", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S034020", name: "두산에너빌리티", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S105560", name: "KB금융", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S329180", name: "HD현대중공업", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S000270", name: "기아", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S012450", name: "한화에어로스페이스", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S068270", name: "셀트리온", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S402340", name: "SK스퀘어", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S035420", name: "NAVER", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S028260", name: "삼성물산", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S055550", name: "신한지주", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S015760", name: "한국전력", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S042660", name: "한화오션", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S032830", name: "삼성생명", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S009540", name: "HD한국조선해양", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S196170", name: "알테오젠", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S012330", name: "현대모비스", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S267260", name: "HD현대일렉트릭", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S003550", name: "LG화학", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S035720", name: "카카오", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S086790", name: "하나금융지주", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S010130", name: "고려아연", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S005490", name: "POSCO홀딩스", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S006400", name: "삼성SDI", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S000810", name: "삼성화재", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "S010140", name: "삼성중공업", kind: "stock_krx", unit: 0.001, dp: 3 },
      { symbol: "NVDA", name: "엔비디아", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "AAPL", name: "애플", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "GOOGL", name: "알파벳 A", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "MSFT", name: "마이크로소프트", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "AMZN", name: "아마존닷컴", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "AVGO", name: "브로드컴", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "META", name: "메타 플랫폼스(페이스북)", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "TSLA", name: "테슬라", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "BRKB", name: "버크셔 해서웨이 B", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "LLY", name: "일라이 릴리", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "WMT", name: "월마트", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "JPM", name: "제이피모간 체이스", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "V", name: "비자", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "ORCL", name: "오라클", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "JNJ", name: "존슨 앤드 존슨", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "MA", name: "마스타카드", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "XOM", name: "엑슨 모빌", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "NFLX", name: "넷플릭스", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "COST", name: "코스트코 홀세일", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "ABBV", name: "애브비", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "PLTR", name: "팔란티어 테크", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "BAC", name: "뱅크오브아메리카", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "HD", name: "홈 디포", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "AMD", name: "AMD", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "PG", name: "프록터 앤드 캠블", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "KO", name: "코카콜라", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "GE", name: "GE에어로스페이스", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "CVX", name: "셰브론", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "CSCO", name: "시스코 시스템즈", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "UNH", name: "유나이티드헬스 그룹", kind: "stock_us", unit: 0.001, dp: 3 },
      { symbol: "SPX", name: "S&P500", kind: "index", unit: 1, dp: 0 },
      { symbol: "NDX", name: "나스닥100", kind: "index", unit: 1, dp: 0 },
      { symbol: "DJI", name: "다우존스", kind: "index", unit: 1, dp: 0 },
      { symbol: "RUT", name: "러셀2000", kind: "index", unit: 1, dp: 0 },
      { symbol: "FTSE", name: "FTSE100", kind: "index", unit: 1, dp: 0 },
      { symbol: "DAX", name: "DAX", kind: "index", unit: 1, dp: 0 },
      { symbol: "NIKKEI", name: "니케이225", kind: "index", unit: 1, dp: 0 },
      { symbol: "HSI", name: "항셍지수", kind: "index", unit: 1, dp: 0 },
      { symbol: "KOSPI", name: "코스피", kind: "index", unit: 1, dp: 0 },
      { symbol: "KOSDAQ", name: "코스닥", kind: "index", unit: 1, dp: 0 },
      { symbol: "GOLD", name: "금(선물)", kind: "indicator", unit: 1, dp: 0 },
      { symbol: "SILVER", name: "은(선물)", kind: "indicator", unit: 1, dp: 0 },
      { symbol: "COPPER", name: "구리(선물)", kind: "indicator", unit: 1, dp: 0 },
      { symbol: "NGAS", name: "천연가스(선물)", kind: "indicator", unit: 1, dp: 0 },
      { symbol: "OILWTI", name: "WTI(선물)", kind: "indicator", unit: 1, dp: 0 },
      { symbol: "BRENT", name: "브렌트유(선물)", kind: "indicator", unit: 1, dp: 0 },
      { symbol: "DXY", name: "달러인덱스", kind: "indicator", unit: 1, dp: 0 },
      { symbol: "US10Y", name: "미국10년물", kind: "indicator", unit: 1, dp: 0 },
      { symbol: "US2Y", name: "미국2년물", kind: "indicator", unit: 1, dp: 0 },
      { symbol: "VIX", name: "VIX", kind: "indicator", unit: 1, dp: 0 },
    ];
    for (const a of data) {
      await db
        .insert(assets)
        .values({
          id: crypto.randomUUID(),
          symbol: a.symbol,
          name: a.name,
          kind: a.kind,
          unit: a.unit,
          dp: a.dp,
          meta: null,
        })
        .onConflictDoNothing({ target: assets.symbol });
    }
    return ok(c, { seeded: data.length }, "자산 목록이 초기화됐어요!!");
  });
  app.get("/v1/market/price/unit", async c => {
    const symbol = String(c.req.query("symbol") || "").trim().toUpperCase();
    const allowStale = c.req.query("allowStale") === "1";
    const def = getAssetDef(symbol);
    if (!def) {
      return err(c, ERR.asset_not_found, "자산을 찾을 수 없어요...", 404);
    }
    let r: PriceUnitKRW;
    if (def.type === "crypto") r = await getCryptoUnitKRW(c.env, def);
    else if (def.type === "stock_krx") r = await getKRXUnitKRW(c.env, def);
    else if (def.type === "stock_us") r = await getUSUnitKRW(c.env, def);
    else r = await getIndexIndicatorUnit(c.env, def);
    if (!r.ok && allowStale) {
      const cached = await kvGetJson<{ priceKRWPerUnit: number; ts: number }>(
        c.env,
        kvKeyUnit(symbol),
      );
      if (cached?.priceKRWPerUnit) {
        return ok(
          c,
          {
            symbol: def.symbol,
            type: def.type,
            unit: def.unit,
            perUnitKRW: cached.priceKRWPerUnit,
            perUnitKRWStr: cached.priceKRWPerUnit.toLocaleString("ko-KR", DEC2),
            ts: cached.ts,
            stale: true,
          },
          "가격 정보를 가져왔어요!!",
        );
      }
    }
    if (!r.ok) {
      return err(c, ERR.price_unavailable, "가격을 가져오지 못했어요...", 503);
    }
    return ok(
      c,
      {
        symbol: def.symbol,
        type: def.type,
        unit: def.unit,
        perUnitKRW: r.perUnitKRW,
        perUnitKRWStr: r.perUnitKRWStr,
        ts: r.ts,
      },
      "가격 정보를 가져왔어요!!",
    );
  });
  app.get("/v1/proxy/upbit", async c => {
    const raw = String(c.req.query("url") || "").trim();
    if (!raw || raw.length > 512) {
      return err(c, ERR.bad_request, "잘못된 요청이에요...", 400);
    }
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return err(c, ERR.bad_request, "잘못된 요청이에요...", 400);
    }
    const okHost =
      url.protocol === "https:" &&
      url.host === "api.upbit.com" &&
      !url.username &&
      !url.password &&
      !url.port;
    if (!okHost) {
      return err(c, ERR.bad_request, "허용되지 않는 주소예요...", 400);
    }
    try {
      const res = await fetchWithRetry(url.toString(), {
        headers: { Accept: "application/json" },
      });
      const txt = await res.text();
      if (!res.ok) {
        return err(
          c,
          `upbit_http_${res.status}`,
          txt ? { raw: txt } : "프록시 요청에 실패했어요...",
          502,
        );
      }
      try {
        return ok(c, JSON.parse(txt), "프록시 결과를 가져왔어요!!");
      } catch {
        return ok(c, { raw: txt }, "프록시 결과를 가져왔어요!!");
      }
    } catch {
      return err(c, "proxy_error", "프록시 요청에 실패했어요...", 502);
    }
  });
  app.get("/v1/proxy/yahoo", async c => {
    const raw = String(c.req.query("url") || "").trim();
    if (!raw || raw.length > 512) {
      return err(c, ERR.bad_request, "잘못된 요청이에요...", 400);
    }
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return err(c, ERR.bad_request, "잘못된 요청이에요...", 400);
    }
    const allow =
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.host === "query1.finance.yahoo.com" ||
        url.host === "query2.finance.yahoo.com");
    if (!allow) {
      return err(c, ERR.bad_request, "허용되지 않는 주소예요...", 400);
    }
    const fetchJson = async (u: URL) => {
      try {
        const r = await fetchWithRetry(u.toString(), {
          headers: {
            Accept: "application/json",
            "User-Agent": YAHOO_UA,
            "Accept-Language": "en-US,en;q=0.8,ko;q=0.7",
          },
        });
        const txt = await r.text();
        return { ok: r.ok, txt };
      } catch (e: any) {
        return { ok: false, txt: String(e?.message || e) };
      }
    };
    const parse = (t: string) => {
      try {
        return t ? JSON.parse(t) : null;
      } catch {
        return null;
      }
    };
    let { ok: ok1, txt } = await fetchJson(url);
    let json: any = parse(txt);
    const isV7 = url.pathname.startsWith("/v7/finance/quote");
    const empty = !json?.quoteResponse?.result?.length;
    if (ok1 && isV7 && empty) {
      if (!url.searchParams.has("region")) url.searchParams.set("region", "US");
      if (!url.searchParams.has("lang")) url.searchParams.set("lang", "en-US");
      ({ ok: ok1, txt } = await fetchJson(url));
      json = parse(txt);
    }
    if (
      isV7 &&
      (!json?.quoteResponse?.result?.length ||
        json.quoteResponse.result[0]?.regularMarketPrice == null)
    ) {
      const sym = (url.searchParams.get("symbols") || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)[0];
      if (sym) {
        const alt = new URL(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            sym,
          )}?range=1d&interval=1m&region=US&lang=en-US`,
        );
        let altRes = await fetchJson(alt);
        let altJson: any = parse(altRes.txt);
        if (
          (!altRes.ok || !altJson?.chart?.result?.length) &&
          alt.host === "query1.finance.yahoo.com"
        ) {
          alt.host = "query2.finance.yahoo.com";
          altRes = await fetchJson(alt);
          altJson = parse(altRes.txt);
        }
        const meta = altJson?.chart?.result?.[0]?.meta || {};
        let px = Number(meta?.regularMarketPrice);
        if (!Number.isFinite(px) || px <= 0) {
          const closes: number[] =
            altJson?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
          for (let i = closes.length - 1; i >= 0; i--) {
            const v = Number(closes[i]);
            if (Number.isFinite(v) && v > 0) {
              px = v;
              break;
            }
          }
        }
        if (Number.isFinite(px) && px > 0) {
          json = {
            quoteResponse: {
              result: [{ symbol: sym, regularMarketPrice: px }],
            },
          };
          ok1 = true;
        }
      }
    }
    if (!ok1) {
      return err(c, "yahoo_http", "프록시 요청에 실패했어요...", 502);
    }
    return ok(c, json ?? { raw: txt ?? "" }, "프록시 결과를 가져왔어요!!");
  });
  const PagePingDto = z.object({
    page: z.string().min(2),
    id: z.string().min(2),
    simProfitLossKrw: z.number().optional(),
  });
  app.post("/v1/telemetry/ping", async c => {
    try {
      await rateLimit(c, "telemetry.ping", 10, 1);
      const raw = await readJsonLimited(c.req).catch(() => ({}));
      const dto = PagePingDto.parse({
        page: raw.page,
        id: raw.id,
        simProfitLossKrw: raw.simProfitLossKrw,
      });
      const db = getDbNow(c.env);
      const u: any = (
        await db.execute(sql`
          SELECT user_id,id,cash_pia,pnl_buffer
          FROM users
          WHERE id=${dto.id}
          LIMIT 1
        `)
      ).rows?.[0];
      if (!u) {
        return err(c, ERR.not_found, "유저를 찾을 수 없어요...", 404);
      }
      let pnlBuf = Number(u?.pnl_buffer || 0);
      if (Number.isFinite(+dto.simProfitLossKrw)) {
        pnlBuf = krwInt(pnlBuf + krwInt(+dto.simProfitLossKrw!));
      }
      await db.execute(
        sql`UPDATE users SET pnl_buffer=${pnlBuf} WHERE user_id=${u.user_id}`,
      );
      return ok(
        c,
        {
          page: dto.page,
          capitals: {
            cashPia: +Number(u.cash_pia || 0).toFixed(2),
            pnlBuffer: pnlBuf,
          },
        },
        "상태가 갱신됐어요!!",
      );
    } catch (e: any) {
      return err(
        c,
        "telemetry_failed",
        "상태 갱신에 실패했어요...",
        (e as any)?.status || 500,
      );
    }
  });
  const SummaryDto = z.object({
    id: z.string().min(2),
    password: z.string().min(6),
  });
  app.post("/v1/portfolio/summary", async c => {
    const raw = await readJsonLimited(c.req).catch(() => ({}));
    let dto: z.infer<typeof SummaryDto>;
    try {
      dto = SummaryDto.parse({
        id: raw.id,
        password: raw.password,
      });
    } catch {
      return err(c, ERR.bad_request, "입력값이 올바르지 않아요...", 400);
    }
    let user;
    try {
      user = await verifyUserSimple(c.env, dto.id, dto.password);
    } catch (e: any) {
      const m = String(e?.message || "");
      return err(
        c,
        m === "not_found" ? ERR.not_found : ERR.auth_failed,
        m === "not_found"
          ? "유저를 찾을 수 없어요..."
          : "비밀번호가 올바르지 않아요...",
        m === "not_found" ? 404 : 401,
      );
    }
    const db = getDbNow(c.env);
    const row: any = (
      await db.execute(
        sql`SELECT cash_pia,pnl_buffer FROM users WHERE user_id=${user.userId} LIMIT 1`,
      )
    ).rows?.[0];
    if (!row) {
      return err(c, ERR.not_found, "유저를 찾을 수 없어요...", 404);
    }
    return ok(
      c,
      {
        id: dto.id,
        cash_pia: +Number(row.cash_pia || 0).toFixed(2),
        pnl_buffer: krwInt(Number(row.pnl_buffer || 0)),
      },
      "요약 정보를 불러왔어요!!",
    );
  });
  const HoldingsDto = z.object({
    id: z.string().min(2),
    password: z.string().min(6),
    includePrices: z.boolean().optional(),
  });
  app.post("/v1/assets/holdings", async c => {
    try {
      await rateLimit(c, "assets.holdings", 10, 1);
      const raw = await readJsonLimited(c.req).catch(() => ({}));
      const dto = HoldingsDto.parse({
        id: raw.id,
        password: raw.password,
        includePrices: raw.includePrices,
      });
      let user;
      try {
        user = await verifyUserSimple(c.env, dto.id, dto.password);
      } catch {
        return err(c, ERR.auth_failed, "인증에 실패했어요...", 401);
      }
      const db = getDbNow(c.env);
      const q = await db.execute(sql`
        SELECT
          a.id AS asset_id,
          a.symbol AS symbol,
          a.name AS name,
          SUM(
            CASE WHEN o.side='buy'
              THEN CAST(o.qty AS REAL)
              ELSE-CAST(o.qty AS REAL)
            END
          ) AS units
        FROM orders o
        JOIN assets a ON a.id=o.asset_id
        WHERE o.user_id=${user.userId}
        GROUP BY a.id,a.symbol,a.name
        HAVING SUM(
          CASE WHEN o.side='buy'
            THEN CAST(o.qty AS REAL)
            ELSE-CAST(o.qty AS REAL)
          END
        ) > 0
        ORDER BY a.symbol
      `);
      const rows = (q.rows || []) as any[];
      const items: any[] = [];
      let totalKrw = 0;
      for (const r of rows) {
        const symbol = String(r.symbol || "").toUpperCase();
        const units = +Number(r.units || 0).toFixed(8);
        let unitPriceKrw: number | null = null;
        let valueKrw: number | null = null;
        let avgBuyPriceKrw: number | null = null;
        let pnlKrw: number | null = null;
        let pnlRate: number | null = null;
        if (dto.includePrices) {
          unitPriceKrw = await getUnitPriceKRWBySymbol(c.env, symbol);
          const arow: any = (
            await db.execute(
              sql`SELECT id FROM assets WHERE upper(symbol)=upper(${symbol}) LIMIT 1`,
            )
          ).rows?.[0];
          if (arow) {
            avgBuyPriceKrw = await avgBuyCostKRW(db, user.userId, arow.id);
          }
          if (Number.isFinite(unitPriceKrw as number)) {
            valueKrw = krwInt(units * (unitPriceKrw as number));
            if (avgBuyPriceKrw != null) {
              pnlKrw = krwInt((unitPriceKrw! - avgBuyPriceKrw) * units);
              pnlRate =
                avgBuyPriceKrw > 0
                  ? +(
                      (((unitPriceKrw! - avgBuyPriceKrw) / avgBuyPriceKrw) *
                        100
                      ).toFixed(2)
                    )
                  : null;
            }
            totalKrw += valueKrw ?? 0;
          }
        }
        items.push({
          symbol,
          name: r.name,
          units,
          unitStep: getAssetDef(symbol)?.unit ?? null,
          unitPriceKrw,
          valueKrw,
          avgBuyPriceKrw,
          pnlKrw,
          pnlRate,
        });
      }
      return ok(
        c,
        { items, totalKrw: dto.includePrices ? totalKrw : null },
        "보유 자산을 불러왔어요!!",
      );
    } catch (e: any) {
      return err(
        c,
        "holdings_failed",
        "보유 자산 조회에 실패했어요...",
        (e as any)?.status || 500,
      );
    }
  });
  const OrdersListDto = z.object({
    id: z.string().min(2),
    password: z.string().min(6),
    limit: z.number().min(1).max(200).optional(),
    cursor: z.string().optional(),
  });
  app.post("/v1/orders/list", async c => {
    try {
      await rateLimit(c, "orders.list", 10, 1);
      const raw = await readJsonLimited(c.req).catch(() => ({}));
      const dto = OrdersListDto.parse({
        id: raw.id,
        password: raw.password,
        limit: raw.limit,
        cursor: raw.cursor,
      });
      let user;
      try {
        user = await verifyUserSimple(c.env, dto.id, dto.password);
      } catch {
        return err(c, ERR.auth_failed, "인증에 실패했어요...", 401);
      }
      const lim = dto.limit ?? 100;
      const db = getDbNow(c.env);
      const q = await db.execute(sql`
        SELECT
          o.id,
          o.side,
          o.qty,
          o.price,
          o.price_krw,
          (EXTRACT(EPOCH FROM o.created_at)*1000)::bigint AS ts,
          a.symbol
        FROM orders o
        JOIN assets a ON a.id=o.asset_id
        WHERE o.user_id=${user.userId}
        ${
          dto.cursor
            ? sql`AND o.created_at<to_timestamp(${Number(dto.cursor) / 1000})`
            : sql``
        }
        ORDER BY o.created_at DESC
        LIMIT ${lim}
      `);
      const rows = (q.rows || []) as any[];
      const nextCursor = rows.length ? String(rows[rows.length - 1].ts) : null;
      return ok(
        c,
        {
          items: rows.map(r => ({
            id: r.id,
            side: r.side,
            symbol: r.symbol,
            qty: Number(r.qty),
            price: Number(r.price),
            priceKrw: Number(r.price_krw),
            ts: Number(r.ts),
          })),
          nextCursor,
        },
        "주문 내역을 불러왔어요!!",
      );
    } catch (e: any) {
      return err(
        c,
        "orders_list_failed",
        "주문 내역 조회에 실패했어요...",
        (e as any)?.status || 500,
      );
    }
  });
  const OrderDto = z.object({
    id: z.string().min(2),
    password: z.string().min(6),
    symbol: z.string().min(1),
    side: z.enum(["buy", "sell"]),
    qty: z.number().positive(),
  });
  app.post("/v1/orders", async c => {
    try {
      await rateLimit(c, "orders.post", 10, 1);
      requireIdemOr400(c);
      await guardIdem(c.env, c.req.header("Idempotency-Key") || "");
      const raw = await readJsonLimited(c.req).catch(() => ({}));
      const qnum = Number(raw?.qty ?? raw?.quantity);
      const dto = OrderDto.parse({
        id: String(raw.id ?? "").trim(),
        password: String(raw.password || ""),
        symbol: String(raw.symbol || "").trim(),
        side: raw.side === "sell" ? "sell" : "buy",
        qty: Number.isFinite(qnum) ? qnum : NaN,
      });
      const db = getDbNow(c.env);
      let user;
      try {
        user = await verifyUserSimple(c.env, dto.id, dto.password);
      } catch {
        return err(c, ERR.auth_failed, "인증에 실패했어요...", 401);
      }
      const u = await getUserRowById(db, user.userId);
      if (!u) {
        return err(c, ERR.not_found, "유저를 찾을 수 없어요...", 404);
      }
      const a = await getAssetRowBySymbol(db, dto.symbol);
      if (!a) {
        return err(c, ERR.asset_not_found, "자산을 찾을 수 없어요...", 404);
      }
      const def = getAssetDef(dto.symbol);
      if (!def || def.type === "index" || def.type === "indicator") {
        return err(
          c,
          ERR.method_not_allowed,
          "이 자산은 거래할 수 없어요...",
          405,
        );
      }
      const unitPrice = await getUnitPriceKRWBySymbol(c.env, def.symbol);
      if (!Number.isFinite(unitPrice as number)) {
        return err(
          c,
          ERR.price_unavailable,
          "가격을 가져오지 못했어요...",
          503,
        );
      }
      const unitPriceNum = Number(unitPrice);
      const qty = Math.round(Number(dto.qty) / def.unit) * def.unit;
      if (!(qty > 0)) {
        return err(c, ERR.bad_request, "거래 수량이 올바르지 않아요...", 400);
      }
      const unitPriceInt = krwInt(unitPriceNum);
      const idem = c.req.header("Idempotency-Key") || "";
      const reqId = crypto.randomUUID();
      const ip =
        c.req.header("CF-Connecting-IP") ||
        c.req.header("X-Forwarded-For") ||
        "";
      const ua = c.req.header("User-Agent") || "";
      const side = dto.side === "sell" ? "sell" : "buy";
      const symbol = def.symbol;
      const typeStr: "market" = "market";
      const insertOrder = async (tx: any, sideIn: "buy" | "sell") => {
        const id = crypto.randomUUID();
        await tx.execute(sql`
          INSERT INTO orders(
            id,user_id,asset_id,symbol,side,type,qty,price,price_krw,unit_price_krw,
            idempotency_key,request_id,client_ip,user_agent
          )
          VALUES(
            ${id},${user.userId},${a.id},${symbol},${sideIn},${typeStr},
            ${qty},${unitPriceNum},${unitPriceInt},${unitPriceInt},
            ${idem},${reqId},${ip},${ua}
          )
        `);
        return id;
      };
      if (side === "buy") {
        const cost = krwInt(unitPriceNum * qty);
        if (Number(u.cash_pia) < cost) {
          return err(c, ERR.insufficient_cash, "현금이 부족해요...", 400);
        }
        await withTx(db, async tx => {
          await insertOrder(tx, "buy");
          await tx.execute(sql`
            UPDATE users
            SET cash_pia=cash_pia-${cost}
            WHERE user_id=${user.userId}
          `);
        });
        return ok(
          c,
          { side: "buy", symbol, qty, unitPriceKrw: unitPriceNum },
          "매수가 완료됐어요!!",
        );
      }
      const have = await holdingUnits(db, user.userId, a.id);
      if (have < qty - 1e-9) {
        return err(
          c,
          ERR.insufficient_quantity,
          "보유 수량이 부족해요...",
          400,
        );
      }
      const avg = await avgBuyCostKRW(db, user.userId, a.id);
      if (avg == null) {
        return err(c, ERR.bad_request, "평단 계산에 실패했어요...", 400);
      }
      const proceeds = krwInt(unitPriceNum * qty);
      const pnl = krwInt((unitPriceNum - avg) * qty);
      const prevBuf = Number(u.pnl_buffer || 0);
      const nextBuf = krwInt(prevBuf + pnl);
      await withTx(db, async tx => {
        await insertOrder(tx, "sell");
        await tx.execute(sql`
          UPDATE users
          SET cash_pia=cash_pia+${proceeds},
              pnl_buffer=${nextBuf}
          WHERE user_id=${user.userId}
        `);
      });
      return ok(
        c,
        {
          side: "sell",
          symbol,
          qty,
          unitPriceKrw: unitPriceNum,
          proceedsKrw: proceeds,
          pnlKrw: pnl,
          pnlBuffer: nextBuf,
        },
        "매도가 완료됐어요!!",
      );
    } catch (e: any) {
      return err(
        c,
        "order_failed",
        "주문 처리에 실패했어요...",
        (e as any)?.status || 500,
      );
    }
  });
  const SignupDto = z.object({
    id: z.string().min(2),
    password: z.string().min(6),
  });
  app.post("/v1/users/signup", async c => {
    try {
      await rateLimit(c, "users.signup", 5, 1);
      requireIdemOr400(c);
      await guardIdem(c.env, c.req.header("Idempotency-Key") || "");
      const raw = await readJsonLimited(c.req).catch(() => ({}));
      const dto = SignupDto.parse({
        id: String(raw.id ?? "")
          .trim()
          .replace(/^@/, ""),
        password: String(raw.password || "").trim(),
      });
      if (!dto.id || !PASSWORD_REGEX.test(dto.password)) {
        return err(c, ERR.bad_request, "입력값이 올바르지 않아요...", 400);
      }
      const db = getDbNow(c.env);
      const existed = (
        await db.execute(sql`
          SELECT user_id
          FROM users
          WHERE lower(id)=lower(${dto.id})
          LIMIT 1
        `)
      ).rows?.[0];
      if (existed) {
        return err(
          c,
          "already_registered",
          "이미 가입된 계정이에요...",
          409,
        );
      }
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const params = "pbkdf2:sha256:100000:32";
      const baseKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(dto.password),
        { name: "PBKDF2" },
        false,
        ["deriveBits"],
      );
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 },
        baseKey,
        32 * 8,
      );
      const userId = crypto.randomUUID();
      const saltB64 = btoa(String.fromCharCode(...salt));
      const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
      try {
        await db.execute(sql`
          INSERT INTO users(
            user_id,id,password_salt,password_params,password_hash,cash_pia,pnl_buffer
          )
          VALUES(${userId},${dto.id},${saltB64},${params},${hashB64},1000,0)
        `);
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (/duplicate key|unique constraint/i.test(msg)) {
          return err(
            c,
            "already_registered",
            "이미 가입된 계정이에요...",
            409,
          );
        }
        throw e;
      }
      return ok(
        c,
        { user: { userId, id: dto.id } },
        "가입이 완료됐어요!!",
      );
    } catch (e: any) {
      return err(
        c,
        "signup_failed",
        "회원가입 처리 중 오류가 발생했어요...",
        (e as any)?.status || 500,
      );
    }
  });
  const RewardDto = z.object({
    id: z.string().min(2),
    password: z.string().min(6),
    amountKrw: z.number().positive(),
    note: z.string().min(1).max(1024).optional(),
    kind: z.string().min(1).max(32).optional(),
  });
  app.post("/v1/rewards", async c => {
    try {
      await rateLimit(c, "rewards.post", 10, 1);
      requireIdemOr400(c);
      await guardIdem(c.env, c.req.header("Idempotency-Key") || "");
      const raw = await readJsonLimited(c.req).catch(() => ({}));
      const dto = RewardDto.parse({
        id: String(raw.id ?? "").trim(),
        password: String(raw.password || ""),
        amountKrw: Number(raw.amountKrw ?? raw.amount_krw),
        note: raw.note ? String(raw.note).trim() || undefined : undefined,
        kind: raw.kind ? String(raw.kind).trim() || undefined : undefined,
      });
      const amount = Number(dto.amountKrw);
      if (!Number.isFinite(amount) || amount <= 0) {
        return err(
          c,
          ERR.bad_request,
          "보상 금액이 올바르지 않아요...",
          400,
        );
      }
      if (!(amount > 0)) {
        return err(
          c,
          ERR.bad_request,
          "보상 금액이 올바르지 않아요...",
          400,
        );
      }
      const uAuth = await verifyUserSimple(
        c.env,
        dto.id,
        dto.password,
      ).catch(() => {
        throw Object.assign(new Error(ERR.auth_failed), { status: 401 });
      });
      const db = getDbNow(c.env);
      const u0: any = (
        await db.execute(
          sql`SELECT user_id,cash_pia FROM users WHERE user_id=${uAuth.userId} LIMIT 1`,
        )
      ).rows?.[0];
      if (!u0) {
        return err(c, ERR.not_found, "유저를 찾을 수 없어요...", 404);
      }
      try {
        await db.execute(sql`
          INSERT INTO rewards(id,user_id,amount_krw,note)
          VALUES(${crypto.randomUUID()},${uAuth.userId},${amount},${
            dto.note ?? null
          })
        `);
      } catch (e: any) {
        console.error("rewards insert failed:", e?.message || e);
      }
      const up: any = (
        await db.execute(sql`
          UPDATE users
          SET cash_pia=cash_pia+${amount}
          WHERE user_id=${uAuth.userId}
          RETURNING cash_pia
        `)
      ).rows?.[0];
      return ok(
        c,
        { cash_pia: Number(up?.cash_pia ?? 0), amount_krw: amount },
        "보상이 지급됐어요!!",
      );
    } catch (e: any) {
      const s = (e as any)?.status || 500;
      const msg =
        (e as any)?.message === ERR.auth_failed
          ? "인증에 실패했어요..."
          : "보상 지급 처리 중 오류가 발생했어요...";
      const code =
        (e as any)?.message === ERR.auth_failed
          ? ERR.auth_failed
          : "reward_failed";
      return err(c, code, msg, s);
    }
  });
  app.get("/v1/users/rankings", async c => {
    try {
      const limitQ = Number(c.req.query("limit") || "50");
      const limit = Number.isFinite(limitQ)
        ? Math.min(Math.max(1, limitQ), 100)
        : 50;
      const db = getDbNow(c.env);
      const rows: any[] = (
        await db.execute(sql`
          SELECT user_id,id,cash_pia,pnl_buffer
          FROM users
        `)
      ).rows || [];
      const enriched: any[] = [];
      for (const r of rows) {
        const cash = +Number(r.cash_pia || 0).toFixed(2);
        const pnlRealized = krwInt(Number(r.pnl_buffer || 0));
        let holdingsValue = 0;
        let unrealizedPnl = 0;
        const hq = await db.execute(sql`
          SELECT
            a.id AS asset_id,
            a.symbol AS symbol,
            SUM(
              CASE WHEN o.side='buy'
                THEN CAST(o.qty AS REAL)
                ELSE-CAST(o.qty AS REAL)
              END
            ) AS units
          FROM orders o
          JOIN assets a ON a.id=o.asset_id
          WHERE o.user_id=${r.user_id}
          GROUP BY a.id,a.symbol
          HAVING SUM(
            CASE WHEN o.side='buy'
              THEN CAST(o.qty AS REAL)
              ELSE-CAST(o.qty AS REAL)
            END
          ) > 0
        `);
        for (const hr of (hq.rows || []) as any[]) {
          const symbol = String(hr.symbol || "").toUpperCase();
          const units = +Number(hr.units || 0).toFixed(8);
          if (!(units > 0)) continue;
          const unitPrice = await getUnitPriceKRWBySymbol(c.env, symbol);
          if (!Number.isFinite(unitPrice as number)) continue;
          const curVal = krwInt(units * (unitPrice as number));
          holdingsValue += curVal;
          const avg = await avgBuyCostKRW(db, r.user_id, hr.asset_id);
          if (avg != null) {
            const invest = krwInt(units * avg);
            unrealizedPnl += krwInt(curVal - invest);
          }
        }
        const totalEquity = cash + holdingsValue;
        const totalPnl = pnlRealized + unrealizedPnl;
        const base = Math.max(1, totalEquity - totalPnl);
        const profitRate = base > 0 ? +((totalPnl / base) * 100).toFixed(2) : 0;
        enriched.push({
          id: String(r.id || ""),
          cash_pia: cash,
          pnl_buffer: pnlRealized,
          holdingsValue,
          totalEquity,
          totalPnl,
          profitRate,
        });
      }
      const byHolding = [...enriched]
        .sort(
          (a, b) =>
            (b.totalEquity ?? b.cash_pia) - (a.totalEquity ?? a.cash_pia),
        )
        .slice(0, limit)
        .map((u, idx) => ({ rank: idx + 1, ...u }));
      const byProfit = [...enriched]
        .sort((a, b) => b.profitRate - a.profitRate)
        .slice(0, limit)
        .map((u, idx) => ({ rank: idx + 1, ...u }));
      return ok(
        c,
        { topByHolding: byHolding, topByProfitRate: byProfit },
        "유저 순위 정보를 불러왔어요!!",
      );
    } catch (e: any) {
      return err(
        c,
        "ranking_failed",
        "유저 순위 조회에 실패했어요...",
        (e as any)?.status || 500,
      );
    }
  });
}