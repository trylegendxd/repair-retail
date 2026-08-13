-- Enable foreign key support in SQLite
PRAGMA foreign_keys = ON;

-- Add foreign key constraint: repair_announcement_photos -> repair_announcements
CREATE TABLE repair_announcement_photos_new (
  id TEXT NOT NULL PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(object_key),
  FOREIGN KEY(announcement_id) REFERENCES repair_announcements(id) ON DELETE CASCADE
);
INSERT INTO repair_announcement_photos_new SELECT * FROM repair_announcement_photos;
DROP TABLE repair_announcement_photos;
ALTER TABLE repair_announcement_photos_new RENAME TO repair_announcement_photos;
CREATE INDEX repair_announcement_photos_post_idx ON repair_announcement_photos(announcement_id, sort_order);

-- Add foreign key constraint: repair_offers -> repair_announcements
CREATE TABLE repair_offers_new (
  id TEXT NOT NULL PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  offer_type TEXT NOT NULL DEFAULT 'repair',
  price_low REAL NOT NULL,
  price_high REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  estimated_days INTEGER NOT NULL DEFAULT 3,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(announcement_id, provider_account_id),
  FOREIGN KEY(announcement_id) REFERENCES repair_announcements(id) ON DELETE CASCADE,
  FOREIGN KEY(provider_account_id) REFERENCES marketplace_accounts(id) ON DELETE CASCADE
);
INSERT INTO repair_offers_new SELECT * FROM repair_offers;
DROP TABLE repair_offers;
ALTER TABLE repair_offers_new RENAME TO repair_offers;
CREATE INDEX repair_offers_post_idx ON repair_offers(announcement_id, status, created_at);
CREATE INDEX repair_offers_provider_idx ON repair_offers(provider_account_id, created_at);
