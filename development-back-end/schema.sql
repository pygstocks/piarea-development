BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
  user_id         TEXT PRIMARY KEY,
  id              TEXT NOT NULL,
  password_params TEXT,
  password_salt   TEXT,
  password_hash   TEXT,
  cash_pia        NUMERIC(18, 2) NOT NULL DEFAULT 0,
  pnl_buffer      NUMERIC(18, 2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_users_id UNIQUE (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_id_ci ON users ((lower(id)));
CREATE OR REPLACE FUNCTION trg_users_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS t_users_set_updated_at ON users;
CREATE TRIGGER t_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trg_users_set_updated_at();
CREATE TABLE IF NOT EXISTS assets (
  id         TEXT PRIMARY KEY,
  symbol     TEXT NOT NULL,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL,
  unit       NUMERIC(18, 8) NOT NULL DEFAULT 1,
  dp         INTEGER NOT NULL DEFAULT 0,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_assets_symbol ON assets (symbol);
CREATE INDEX IF NOT EXISTS ix_assets_kind ON assets (kind);
CREATE TABLE IF NOT EXISTS holdings (
  user_id           TEXT NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  asset_id          TEXT NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
  qty               NUMERIC(24, 8) NOT NULL DEFAULT 0,
  avg_buy_price_krw NUMERIC(18, 2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_holdings_user_asset UNIQUE (user_id, asset_id)
);
CREATE OR REPLACE FUNCTION trg_holdings_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS t_holdings_set_updated_at ON holdings;
CREATE TRIGGER t_holdings_set_updated_at
BEFORE UPDATE ON holdings
FOR EACH ROW
EXECUTE FUNCTION trg_holdings_set_updated_at();
CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  asset_id        TEXT NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
  symbol          TEXT NOT NULL REFERENCES assets (symbol),
  side            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'market',
  qty             NUMERIC(24, 8) NOT NULL,
  price           NUMERIC(24, 8) NOT NULL,
  price_krw       NUMERIC(18, 2) NOT NULL,
  unit_price_krw  NUMERIC(18, 2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  idempotency_key TEXT,
  request_id      UUID DEFAULT gen_random_uuid(),
  client_ip       TEXT,
  user_agent      TEXT
);
CREATE INDEX IF NOT EXISTS ix_orders_user        ON orders (user_id);
CREATE INDEX IF NOT EXISTS ix_orders_asset_time  ON orders (asset_id, created_at);
CREATE INDEX IF NOT EXISTS ix_orders_symbol_time ON orders (symbol, created_at);
CREATE INDEX IF NOT EXISTS ix_orders_idem        ON orders (idempotency_key);
CREATE TABLE IF NOT EXISTS telemetry (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users (user_id),
  kind       TEXT NOT NULL,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_ranks (
  user_id         TEXT PRIMARY KEY REFERENCES users (user_id) ON DELETE CASCADE,
  balance_pia     NUMERIC(18, 2) NOT NULL DEFAULT 0,
  return_pct      NUMERIC(9, 4)  NOT NULL DEFAULT 0,
  rank_by_balance INTEGER,
  rank_by_return  INTEGER,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_user_ranks_balance ON user_ranks (balance_pia DESC);
CREATE INDEX IF NOT EXISTS ix_user_ranks_return  ON user_ranks (return_pct DESC);
INSERT INTO assets (id, symbol, name, kind, unit, dp, meta) VALUES
  ('asset-btc',          'BTC',      '비트코인',           'crypto',    0.0001, 4, '{}'),
  ('asset-eth',          'ETH',      '이더리움',           'crypto',    0.001,  3, '{}'),
  ('asset-usdt',         'USDT',     '테더',               'crypto',    1,      0, '{}'),
  ('asset-sol',          'SOL',      '솔라나',             'crypto',    0.01,   2, '{}'),
  ('asset-xrp',          'XRP',      '리플',               'crypto',    1,      0, '{}'),
  ('asset-doge',         'DOGE',     '도지코인',           'crypto',    1,      0, '{}'),
  ('asset-ada',          'ADA',      '에이다',             'crypto',    1,      0, '{}'),
  ('asset-avax',         'AVAX',     '아발란체',           'crypto',    0.1,    1, '{}'),
  ('asset-ton',          'TON',      '톤코인',             'crypto',    1,      0, '{}'),
  ('asset-link',         'LINK',     '체인링크',           'crypto',    0.1,    1, '{}'),
  ('asset-s005930',      'S005930',  '삼성전자',           'stock_krx', 0.01,   2, '{}'),
  ('asset-s000660',      'S000660',  'SK하이닉스',         'stock_krx', 0.01,   2, '{}'),
  ('asset-s373220',      'S373220',  'LG에너지솔루션',     'stock_krx', 0.01,   2, '{}'),
  ('asset-s005380',      'S005380',  '현대차',             'stock_krx', 0.01,   2, '{}'),
  ('asset-s000270',      'S000270',  '기아',               'stock_krx', 0.01,   2, '{}'),
  ('asset-s005490',      'S005490',  'POSCO홀딩스',        'stock_krx', 0.01,   2, '{}'),
  ('asset-s035420',      'S035420',  '네이버',             'stock_krx', 0.01,   2, '{}'),
  ('asset-s035720',      'S035720',  '카카오',             'stock_krx', 0.01,   2, '{}'),
  ('asset-s006400',      'S006400',  '삼성SDI',            'stock_krx', 0.01,   2, '{}'),
  ('asset-s068270',      'S068270',  '셀트리온',           'stock_krx', 0.01,   2, '{}'),
  ('asset-s012450',      'S012450',  '한화에어로스페이스','stock_krx', 0.01,   2, '{}'),
  ('asset-s259960',      'S259960',  '크래프톤',           'stock_krx', 0.01,   2, '{}'),
  ('asset-s051910',      'S051910',  'LG화학',             'stock_krx', 0.01,   2, '{}'),
  ('asset-s323410',      'S323410',  '카카오뱅크',         'stock_krx', 0.01,   2, '{}'),
  ('asset-s011200',      'S011200',  'HMM',                'stock_krx', 0.01,   2, '{}'),
  ('asset-s377300',      'S377300',  '카카오페이',         'stock_krx', 0.01,   2, '{}'),
  ('asset-s036570',      'S036570',  '엔씨소프트',         'stock_krx', 0.01,   2, '{}'),
  ('asset-s448370',      'S448370',  '두산로보틱스',       'stock_krx', 0.01,   2, '{}'),
  ('asset-s008770',      'S008770',  '호텔신라',           'stock_krx', 0.01,   2, '{}'),
  ('asset-s383220',      'S383220',  'F&F',                'stock_krx', 0.01,   2, '{}'),
  ('asset-nvda',         'NVDA',     '엔비디아',           'stock_us',  0.01,   2, '{}'),
  ('asset-aapl',         'AAPL',     '애플',               'stock_us',  0.01,   2, '{}'),
  ('asset-msft',         'MSFT',     '마이크로소프트',     'stock_us',  0.01,   2, '{}'),
  ('asset-amzn',         'AMZN',     '아마존',             'stock_us',  0.01,   2, '{}'),
  ('asset-googl',        'GOOGL',    '알파벳',             'stock_us',  0.01,   2, '{}'),
  ('asset-meta',         'META',     '메타',               'stock_us',  0.01,   2, '{}'),
  ('asset-tsla',         'TSLA',     '테슬라',             'stock_us',  0.01,   2, '{}'),
  ('asset-avgo',         'AVGO',     '브로드컴',           'stock_us',  0.01,   2, '{}'),
  ('asset-tsm',          'TSM',      'TSMC',               'stock_us',  0.01,   2, '{}'),
  ('asset-brkb',         'BRK.B',    '버크셔해서웨이B',    'stock_us',  0.01,   2, '{}'),
  ('asset-cost',         'COST',     '코스트코',           'stock_us',  0.01,   2, '{}'),
  ('asset-jpm',          'JPM',      'JP모건체이스',       'stock_us',  0.01,   2, '{}'),
  ('asset-amd',          'AMD',      'AMD',                'stock_us',  0.01,   2, '{}'),
  ('asset-nflx',         'NFLX',     '넷플릭스',           'stock_us',  0.01,   2, '{}'),
  ('asset-arm',          'ARM',      '암홀딩스',           'stock_us',  0.01,   2, '{}'),
  ('asset-dis',          'DIS',      '디즈니',             'stock_us',  0.01,   2, '{}'),
  ('asset-nke',          'NKE',      '나이키',             'stock_us',  0.01,   2, '{}'),
  ('asset-spot',         'SPOT',     '스포티파이',         'stock_us',  0.01,   2, '{}'),
  ('asset-snow',         'SNOW',     '스노우플레이크',     'stock_us',  0.01,   2, '{}'),
  ('asset-coin',         'COIN',     '코인베이스',         'stock_us',  0.01,   2, '{}'),
  ('asset-idx-spx',      'SPX',      'S&P 500',            'index',     1,      0, '{"yahoo":"^GSPC"}'),
  ('asset-idx-ndx',      'NDX',      '나스닥 100',         'index',     1,      0, '{"yahoo":"^NDX"}'),
  ('asset-idx-dji',      'DJI',      '다우존스 30',        'index',     1,      0, '{"yahoo":"^DJI"}'),
  ('asset-idx-nky',      'N225',     '니케이 225',         'index',     1,      0, '{"yahoo":"^N225"}'),
  ('asset-idx-eustx50',  'SX5E',     '유로스톡스 50',      'index',     1,      0, '{"yahoo":"^STOXX50E"}'),
  ('asset-idx-dax',      'DAX',      '독일 DAX 40',        'index',     1,      0, '{"yahoo":"^GDAXI"}'),
  ('asset-idx-ftse',     'FTSE',     'FTSE 100',           'index',     1,      0, '{"yahoo":"^FTSE"}'),
  ('asset-idx-hsi',      'HSI',      '항셍지수',           'index',     1,      0, '{"yahoo":"^HSI"}'),
  ('asset-idx-shcomp',   'SHCOMP',   '상해종합지수',       'index',     1,      0, '{"yahoo":"000001.SS"}'),
  ('asset-idx-kospi',    'KOSPI',    '코스피',             'index',     1,      0, '{"yahoo":"^KS11"}'),
  ('asset-ind-vix',      'VIX',      '변동성지수(VIX)',    'indicator', 1,      0, '{"yahoo":"^VIX"}'),
  ('asset-ind-dxy',      'DXY',      '달러인덱스(DXY)',    'indicator', 1,      0, '{"yahoo":"DX-Y.NYB"}'),
  ('asset-ind-us10y',    'US10Y',    '미국 10년물 금리',   'indicator', 1,      0, '{"yahoo":"^TNX"}'),
  ('asset-ind-wti',      'WTI',      '서부텍사스유(WTI)',  'indicator', 1,      0, '{"yahoo":"CL=F"}'),
  ('asset-ind-brent',    'BRENT',    '브렌트유',           'indicator', 1,      0, '{"yahoo":"BZ=F"}'),
  ('asset-ind-gold',     'GOLD',     '금 현물',            'indicator', 1,      0, '{"yahoo":"GC=F"}'),
  ('asset-ind-silver',   'SILVER',   '은 현물',            'indicator', 1,      0, '{"yahoo":"SI=F"}'),
  ('asset-ind-btcdom',   'BTCD',     '비트코인 도미넌스',  'indicator', 1,      0, '{"yahoo":"BTC-USD"}'),
  ('asset-ind-feargreed','FGI',      '공포·탐욕 지수',     'indicator', 1,      0, '{"yahoo":"^CNNFNG"}'),
  ('asset-ind-cpi',      'CPI',      '미국 CPI(지표)',     'indicator', 1,      0, '{"yahoo":"CPIAUCSL"}')
ON CONFLICT (symbol) DO NOTHING;
COMMIT;