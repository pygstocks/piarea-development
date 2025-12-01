import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import type { Env } from "./env";
export type Db = NeonHttpDatabase<typeof schema>;
let CACHE: Map<string, Db> | undefined;
export function getDb(env: Env): Db {
  const url = String(env.DATABASE_URL || env.DB_URL || "").trim();
  if (!url) throw new Error("데이터베이스 주소가 없어요...");
  CACHE ||= new Map();
  const hit = CACHE.get(url);
  if (hit) return hit;
  const db = drizzle(neon(url), { schema });
  CACHE.set(url, db);
  return db;
}
export { schema };