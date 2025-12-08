import {
  pgTable,
  text,
  uuid,
  numeric,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  id: text("id").notNull().unique(),
  passwordSalt: text("password_salt").notNull(),
  passwordParams: text("password_params").notNull(),
  passwordHash: text("password_hash").notNull(),
  cashPia: numeric("cash_pia", { precision: 18, scale: 2 })
    .notNull()
    .default("0"),
  pnlBuffer: numeric("pnl_buffer").notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  unit: numeric("unit").notNull(),
  dp: integer("dp").notNull().default(0),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  assetId: uuid("asset_id").notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  type: text("type").notNull(),
  qty: numeric("qty").notNull(),
  price: numeric("price").notNull(),
  priceKrw: numeric("price_krw").notNull(),
  unitPriceKrw: numeric("unit_price_krw").notNull(),
  idempotencyKey: text("idempotency_key"),
  requestId: text("request_id"),
  clientIp: text("client_ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export const rewards = pgTable("rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  amountKrw: numeric("amount_krw").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export const userRanks = pgTable("user_ranks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  piaBalance: numeric("pia_balance", { precision: 18, scale: 2 })
    .notNull()
    .default("0"),
  returnRate: numeric("return_rate", { precision: 9, scale: 4 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});