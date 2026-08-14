-- Add seller verification system
-- Supports: Customer, Individual Seller, Verified Shop

-- Add seller type and verification fields to marketplace_accounts
ALTER TABLE marketplace_accounts ADD COLUMN seller_type TEXT NOT NULL DEFAULT 'customer';
-- Values: 'customer', 'individual_seller', 'shop'

ALTER TABLE marketplace_accounts ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE marketplace_accounts ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'none';
-- Values: 'none', 'pending', 'approved', 'rejected'

ALTER TABLE marketplace_accounts ADD COLUMN verification_submitted_at TEXT;
ALTER TABLE marketplace_accounts ADD COLUMN verification_approved_at TEXT;
ALTER TABLE marketplace_accounts ADD COLUMN rejection_reason TEXT;

ALTER TABLE marketplace_accounts ADD COLUMN trust_score REAL NOT NULL DEFAULT 0.0;
ALTER TABLE marketplace_accounts ADD COLUMN total_repairs INTEGER NOT NULL DEFAULT 0;
ALTER TABLE marketplace_accounts ADD COLUMN successful_repairs INTEGER NOT NULL DEFAULT 0;

-- Create seller verification documents table
CREATE TABLE seller_verification_docs (
  id TEXT NOT NULL PRIMARY KEY,
  account_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  -- doc_type values: 'business_license', 'tax_id', 'shop_photo', 'insurance', 'id_proof'
  object_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- status: 'pending', 'approved', 'rejected'
  rejection_reason TEXT,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  UNIQUE(account_id, doc_type),
  FOREIGN KEY(account_id) REFERENCES marketplace_accounts(id) ON DELETE CASCADE
);

CREATE INDEX seller_verification_docs_account_idx ON seller_verification_docs(account_id);
CREATE INDEX seller_verification_docs_status_idx ON seller_verification_docs(status);

-- Create shop profile table (more detailed info)
CREATE TABLE shop_profiles (
  id TEXT NOT NULL PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  -- business_type: 'electronics_repair', 'phone_repair', 'computer_repair', 'general', 'other'
  registration_number TEXT,
  tax_id TEXT,
  website TEXT,
  social_media_handles TEXT,
  years_in_business INTEGER,
  employee_count INTEGER,
  specializations TEXT,
  -- JSON array of specializations: ["phone", "laptop", "console", ...]
  service_area_radius_km INTEGER NOT NULL DEFAULT 50,
  average_turnaround_days REAL,
  warranty_offered INTEGER NOT NULL DEFAULT 0,
  -- warranty_offered: months (0-24)
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(account_id) REFERENCES marketplace_accounts(id) ON DELETE CASCADE
);

CREATE INDEX shop_profiles_account_idx ON shop_profiles(account_id);

-- Create seller ratings/reviews table
CREATE TABLE seller_ratings (
  id TEXT NOT NULL PRIMARY KEY,
  seller_account_id TEXT NOT NULL,
  customer_account_id TEXT NOT NULL,
  offer_id TEXT,
  rating INTEGER NOT NULL,
  -- rating: 1-5 stars
  comment TEXT,
  categories TEXT,
  -- JSON: {"communication": 5, "quality": 4, "speed": 5}
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(seller_account_id) REFERENCES marketplace_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY(customer_account_id) REFERENCES marketplace_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY(offer_id) REFERENCES repair_offers(id) ON DELETE SET NULL
);

CREATE INDEX seller_ratings_seller_idx ON seller_ratings(seller_account_id);
CREATE INDEX seller_ratings_customer_idx ON seller_ratings(customer_account_id);

-- Update repair_offers to track completed status for ratings
ALTER TABLE repair_offers ADD COLUMN completion_status TEXT DEFAULT 'pending';
-- Values: 'pending', 'in_progress', 'completed', 'cancelled'

ALTER TABLE repair_offers ADD COLUMN completed_at TEXT;
ALTER TABLE repair_offers ADD COLUMN customer_rating_id TEXT;
ALTER TABLE repair_offers ADD COLUMN seller_rating_id TEXT;

-- Add index for seller search optimization
CREATE INDEX marketplace_accounts_seller_type_idx ON marketplace_accounts(seller_type, is_verified);
CREATE INDEX marketplace_accounts_trust_score_idx ON marketplace_accounts(trust_score DESC);
