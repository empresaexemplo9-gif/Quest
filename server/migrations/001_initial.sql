CREATE TABLE IF NOT EXISTS schema_migrations (
 version INTEGER PRIMARY KEY,
 applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS accounts (
 id TEXT PRIMARY KEY,
 username TEXT NOT NULL UNIQUE,
 data JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 expires BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS game_world (
 id INTEGER PRIMARY KEY CHECK(id=1),
 state JSONB NOT NULL,
 revision BIGINT NOT NULL DEFAULT 0,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS guilds (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 leader_id TEXT NOT NULL,
 specialization TEXT NOT NULL,
 data JSONB NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS characters (
 id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 class_id TEXT NOT NULL,
 level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 80),
 xp BIGINT NOT NULL CHECK(xp>=0),
 credits BIGINT NOT NULL CHECK(credits>=0),
 guild_id TEXT REFERENCES guilds(id),
 data JSONB NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS character_guild ON characters(guild_id);
CREATE TABLE IF NOT EXISTS inventory (
 character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 item_id TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity>0),
 PRIMARY KEY(character_id,item_id)
);
CREATE TABLE IF NOT EXISTS guild_members (
 guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
 character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('leader','officer','veteran','recruit')),
 PRIMARY KEY(guild_id,character_id)
);
CREATE TABLE IF NOT EXISTS market_listings (
 id TEXT PRIMARY KEY,
 seller_id TEXT NOT NULL REFERENCES characters(id),
 quantity INTEGER NOT NULL CHECK(quantity>0),
 price BIGINT NOT NULL CHECK(price>0),
 data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS action_receipts (
 actor_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 nonce TEXT NOT NULL,
 action_type TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,nonce)
);
CREATE TABLE IF NOT EXISTS game_audit (
 id BIGSERIAL PRIMARY KEY,
 actor_id TEXT NOT NULL REFERENCES accounts(id),
 action_type TEXT NOT NULL,
 data JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS request_limits (
 key TEXT PRIMARY KEY,window_start BIGINT NOT NULL,count INTEGER NOT NULL
);
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
