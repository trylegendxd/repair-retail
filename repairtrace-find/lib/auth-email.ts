import { getD1 } from "./server-marketplace";

const BCRYPT_ROUNDS = 12;
const SESSION_DURATION_DAYS = 30;
const EMAIL_VERIFY_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_HOURS = 1;

// Import crypto utilities
async function hashPassword(password: string): Promise<string> {
  // Using Node.js crypto for simple hashing (in production, use bcrypt)
  const encoder = new TextEncoder();
  const data = encoder.encode(password + process.env.PASSWORD_SALT || "default-salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  return await hashPassword(token);
}

export async function registerEmailUser(
  email: string,
  password: string,
): Promise<{ userId: string; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { userId: "", error: "Invalid email format" };
  }

  // Validate password strength
  if (password.length < 8) {
    return { userId: "", error: "Password must be at least 8 characters" };
  }

  const db = getD1();

  // Check if user exists
  const existing = await db.prepare("SELECT id FROM user_credentials WHERE email=? LIMIT 1")
    .bind(normalizedEmail).first<{ id: string }>();

  if (existing) {
    return { userId: "", error: "Email already registered" };
  }

  // Hash password
  const passwordHash = await hashPassword(password);
  const userId = `user_${crypto.randomUUID().slice(0, 12)}`;

  // Create user
  await db.prepare(`
    INSERT INTO user_credentials (id, email, password_hash, auth_provider)
    VALUES (?, ?, ?, 'email')
  `).bind(userId, normalizedEmail, passwordHash).run();

  return { userId };
}

export async function loginEmailUser(
  email: string,
  password: string,
): Promise<{ userId: string; sessionToken: string; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const db = getD1();

  // Find user
  const user = await db.prepare("SELECT id, password_hash, is_active FROM user_credentials WHERE email=? LIMIT 1")
    .bind(normalizedEmail).first<{ id: string; password_hash: string; is_active: number }>();

  if (!user || !user.password_hash) {
    return { userId: "", sessionToken: "", error: "Invalid email or password" };
  }

  if (!user.is_active) {
    return { userId: "", sessionToken: "", error: "Account is inactive" };
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return { userId: "", sessionToken: "", error: "Invalid email or password" };
  }

  // Create session
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const sessionId = `sess_${crypto.randomUUID().slice(0, 12)}`;
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db.prepare(`
    INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(sessionId, user.id, tokenHash, expiresAt).run();

  // Update last login
  await db.prepare("UPDATE user_credentials SET last_login_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(user.id).run();

  return { userId: user.id, sessionToken: token };
}

export async function verifySessionToken(token: string): Promise<{ userId: string; email: string; error?: string }> {
  const db = getD1();
  const tokenHash = await hashToken(token);

  // Find session
  const session = await db.prepare(`
    SELECT s.user_id, u.email FROM auth_sessions s
    JOIN user_credentials u ON u.id = s.user_id
    WHERE s.token_hash=? AND datetime(s.expires_at) > datetime('now') LIMIT 1
  `).bind(tokenHash).first<{ user_id: string; email: string }>();

  if (!session) {
    return { userId: "", email: "", error: "Invalid or expired session" };
  }

  return { userId: session.user_id, email: session.email };
}

export async function generatePasswordResetToken(email: string): Promise<{ token: string; error?: string }> {
  const db = getD1();
  const normalizedEmail = email.toLowerCase().trim();

  // Find user
  const user = await db.prepare("SELECT id FROM user_credentials WHERE email=? LIMIT 1")
    .bind(normalizedEmail).first<{ id: string }>();

  if (!user) {
    // Don't reveal if email exists (security best practice)
    return { token: "", error: undefined };
  }

  // Create reset token
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  await db.prepare(`
    INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(`reset_${crypto.randomUUID().slice(0, 12)}`, user.id, tokenHash, expiresAt).run();

  return { token };
}

export async function resetPassword(
  resetToken: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getD1();
  const tokenHash = await hashToken(resetToken);

  // Find valid reset token
  const tokenRecord = await db.prepare(`
    SELECT user_id FROM password_reset_tokens
    WHERE token_hash=? AND used_at IS NULL AND datetime(expires_at) > datetime('now') LIMIT 1
  `).bind(tokenHash).first<{ user_id: string }>();

  if (!tokenRecord) {
    return { success: false, error: "Invalid or expired reset token" };
  }

  if (newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  // Update password
  const passwordHash = await hashPassword(newPassword);
  await db.prepare("UPDATE user_credentials SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(passwordHash, tokenRecord.user_id).run();

  // Mark token as used
  await db.prepare("UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=?")
    .bind(tokenHash).run();

  return { success: true };
}

export async function linkAccountToUser(
  userId: string,
  accountId: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getD1();

  await db.prepare("UPDATE marketplace_accounts SET user_credential_id=? WHERE id=?")
    .bind(userId, accountId).run();

  return { success: true };
}
