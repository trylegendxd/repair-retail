-- Add email/password authentication system
-- Supports: Email/Password + OpenAI OAuth (dual support)

-- Create user credentials table
CREATE TABLE user_credentials (
  id TEXT NOT NULL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  -- password_hash is null for OAuth-only users
  auth_provider TEXT NOT NULL DEFAULT 'email',
  -- auth_provider: 'email', 'openai', 'google', 'github'
  oauth_id TEXT,
  -- oauth_id: provider-specific ID (for OAuth users)
  oauth_provider TEXT,
  -- oauth_provider: 'openai', 'google', 'github'
  is_active INTEGER NOT NULL DEFAULT 1,
  email_verified INTEGER NOT NULL DEFAULT 0,
  email_verified_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(oauth_provider, oauth_id)
);

CREATE INDEX user_credentials_email_idx ON user_credentials(email);
CREATE INDEX user_credentials_oauth_idx ON user_credentials(oauth_provider, oauth_id);

-- Create session tokens table
CREATE TABLE auth_sessions (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES user_credentials(id) ON DELETE CASCADE
);

CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expires_idx ON auth_sessions(expires_at);

-- Create email verification tokens
CREATE TABLE email_verification_tokens (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES user_credentials(id) ON DELETE CASCADE
);

CREATE INDEX email_verification_tokens_user_idx ON email_verification_tokens(user_id);

-- Create password reset tokens
CREATE TABLE password_reset_tokens (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES user_credentials(id) ON DELETE CASCADE
);

CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens(user_id);

-- Link marketplace_accounts to user_credentials
ALTER TABLE marketplace_accounts ADD COLUMN user_credential_id TEXT;
ALTER TABLE marketplace_accounts ADD CONSTRAINT fk_marketplace_user_cred
  FOREIGN KEY(user_credential_id) REFERENCES user_credentials(id) ON DELETE CASCADE;

CREATE INDEX marketplace_accounts_user_cred_idx ON marketplace_accounts(user_credential_id);
