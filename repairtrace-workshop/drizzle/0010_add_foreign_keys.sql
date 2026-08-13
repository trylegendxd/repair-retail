-- Enable foreign key support in SQLite
PRAGMA foreign_keys = ON;

-- Add foreign key constraint: repair_photos -> repairs
CREATE TABLE repair_photos_new (
  id TEXT NOT NULL PRIMARY KEY,
  repair_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT 'Repair evidence',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(repair_id) REFERENCES repairs(id) ON DELETE CASCADE
);
INSERT INTO repair_photos_new SELECT * FROM repair_photos;
DROP TABLE repair_photos;
ALTER TABLE repair_photos_new RENAME TO repair_photos;

-- Add foreign key constraint: repair_tests -> repairs
CREATE TABLE repair_tests_new (
  id TEXT NOT NULL PRIMARY KEY,
  repair_id TEXT NOT NULL,
  label TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY(repair_id) REFERENCES repairs(id) ON DELETE CASCADE
);
INSERT INTO repair_tests_new SELECT * FROM repair_tests;
DROP TABLE repair_tests;
ALTER TABLE repair_tests_new RENAME TO repair_tests;

-- Add foreign key constraint: repair_parts -> repairs
CREATE TABLE repair_parts_new (
  id TEXT NOT NULL PRIMARY KEY,
  repair_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT 'Manual entry',
  quantity INTEGER NOT NULL DEFAULT 1,
  cost REAL NOT NULL DEFAULT 0,
  FOREIGN KEY(repair_id) REFERENCES repairs(id) ON DELETE CASCADE
);
INSERT INTO repair_parts_new SELECT * FROM repair_parts;
DROP TABLE repair_parts;
ALTER TABLE repair_parts_new RENAME TO repair_parts;

-- Add foreign key constraint: repair_events -> repairs
CREATE TABLE repair_events_new (
  id TEXT NOT NULL PRIMARY KEY,
  repair_id TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(repair_id) REFERENCES repairs(id) ON DELETE CASCADE
);
INSERT INTO repair_events_new SELECT * FROM repair_events;
DROP TABLE repair_events;
ALTER TABLE repair_events_new RENAME TO repair_events;

-- Add foreign key constraint: repair_client_updates -> repairs
CREATE TABLE repair_client_updates_new (
  id TEXT NOT NULL PRIMARY KEY,
  repair_id TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(repair_id) REFERENCES repairs(id) ON DELETE CASCADE
);
INSERT INTO repair_client_updates_new SELECT * FROM repair_client_updates;
DROP TABLE repair_client_updates;
ALTER TABLE repair_client_updates_new RENAME TO repair_client_updates;
CREATE INDEX client_updates_repair_idx ON repair_client_updates(repair_id);

-- Add foreign key constraint: repair_notifications -> repairs
CREATE TABLE repair_notifications_new (
  id TEXT NOT NULL PRIMARY KEY,
  repair_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  destination_masked TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  provider_message_id TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(repair_id) REFERENCES repairs(id) ON DELETE CASCADE
);
INSERT INTO repair_notifications_new SELECT * FROM repair_notifications;
DROP TABLE repair_notifications;
ALTER TABLE repair_notifications_new RENAME TO repair_notifications;
CREATE INDEX notifications_repair_idx ON repair_notifications(repair_id);

-- Add foreign key constraint: repair_ai_estimates -> repairs
CREATE TABLE repair_ai_estimates_new (
  id TEXT NOT NULL PRIMARY KEY,
  repair_id TEXT NOT NULL,
  recognized_model TEXT NOT NULL,
  fault_key TEXT NOT NULL,
  fault_label TEXT NOT NULL,
  recommended_part TEXT NOT NULL,
  faults_json TEXT NOT NULL DEFAULT '[]',
  confidence TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  part_low REAL NOT NULL,
  part_typical REAL NOT NULL,
  part_high REAL NOT NULL,
  labor_hours REAL NOT NULL,
  labor_rate REAL NOT NULL,
  labor_cost REAL NOT NULL,
  include_labor INTEGER NOT NULL DEFAULT 1,
  quote_low REAL NOT NULL,
  quote_recommended REAL NOT NULL,
  quote_high REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  rationale TEXT NOT NULL,
  guide_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ready',
  researched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(repair_id),
  FOREIGN KEY(repair_id) REFERENCES repairs(id) ON DELETE CASCADE
);
INSERT INTO repair_ai_estimates_new SELECT * FROM repair_ai_estimates;
DROP TABLE repair_ai_estimates;
ALTER TABLE repair_ai_estimates_new RENAME TO repair_ai_estimates;

-- Add foreign key constraint: repair_guides -> repairs
CREATE TABLE repair_guides_new (
  id TEXT NOT NULL PRIMARY KEY,
  repair_id TEXT NOT NULL,
  recognized_model TEXT NOT NULL,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  overview TEXT NOT NULL,
  tools_json TEXT NOT NULL DEFAULT '[]',
  parts_json TEXT NOT NULL DEFAULT '[]',
  precautions_json TEXT NOT NULL DEFAULT '[]',
  steps_json TEXT NOT NULL DEFAULT '[]',
  source_url TEXT NOT NULL DEFAULT '',
  source_label TEXT NOT NULL DEFAULT 'Model-specific reference',
  source_guide_id INTEGER,
  source_match_level TEXT NOT NULL DEFAULT 'Unverified',
  source_checked_at TEXT NOT NULL DEFAULT '',
  verified_detail_count INTEGER NOT NULL DEFAULT 0,
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(repair_id),
  FOREIGN KEY(repair_id) REFERENCES repairs(id) ON DELETE CASCADE
);
INSERT INTO repair_guides_new SELECT * FROM repair_guides;
DROP TABLE repair_guides;
ALTER TABLE repair_guides_new RENAME TO repair_guides;

-- Add foreign key constraint: repair_ifixit_guides -> repairs
CREATE TABLE repair_ifixit_guides_new (
  id TEXT NOT NULL PRIMARY KEY,
  repair_id TEXT NOT NULL,
  guide_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  match_score REAL NOT NULL DEFAULT 0,
  match_level TEXT NOT NULL DEFAULT 'Possible',
  selected INTEGER NOT NULL DEFAULT 0,
  tools_json TEXT NOT NULL DEFAULT '[]',
  specifics_json TEXT NOT NULL DEFAULT '[]',
  step_count INTEGER NOT NULL DEFAULT 0,
  search_query TEXT NOT NULL DEFAULT '',
  retrieved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(repair_id, guide_id),
  FOREIGN KEY(repair_id) REFERENCES repairs(id) ON DELETE CASCADE
);
INSERT INTO repair_ifixit_guides_new SELECT * FROM repair_ifixit_guides;
DROP TABLE repair_ifixit_guides;
ALTER TABLE repair_ifixit_guides_new RENAME TO repair_ifixit_guides;
CREATE INDEX ifixit_guides_repair_idx ON repair_ifixit_guides(repair_id);
