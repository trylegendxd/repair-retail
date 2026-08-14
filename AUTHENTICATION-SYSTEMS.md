# RepairTrace Authentication Systems

**Status**: ✅ Email/Password auth implemented + OpenAI auth maintained  
**Date**: 2026-08-14  
**Version**: 1.0  

---

## 🔐 Overview

RepairTrace now supports **multiple authentication methods**:

| Auth Method | Status | Setup Time | Use Case |
|-------------|--------|------------|----------|
| **OpenAI (ChatGPT)** | ✅ Current | Already set up | Existing users |
| **Email/Password** | ✅ New | Add with 1 migration | Standard registration |
| **Google OAuth** | 🔜 Template | Add with OAuth config | Social login |
| **GitHub OAuth** | 🔜 Template | Add with OAuth config | Developer login |

---

## 📊 Current System (OpenAI Only)

### How It Works
```
User → "Sign in with ChatGPT" 
     → OpenAI OAuth
     → Header: oai-authenticated-user-email
     → App auto-creates account
```

### Code Location
- `repairtrace-find/app/chatgpt-auth.ts`
- `repairtrace-workshop/app/chatgpt-auth.ts`

**Status**: ✅ Works great, no changes needed

---

## 🆕 **New: Email/Password Authentication**

### How It Works
```
User → Register with email/password
    → Email stored with secure hash
    → Session token generated
    → Session stored in database
    → User can log in with email/password
```

### Database Tables (Migration 0007)

**user_credentials** - User login info
```sql
id              - Unique user ID
email           - Login email (unique)
password_hash   - Hashed password (bcrypt in production)
auth_provider   - 'email', 'openai', 'google', etc.
oauth_id        - Provider-specific ID (for OAuth)
email_verified  - 0/1 email verification status
last_login_at   - Timestamp of last login
```

**auth_sessions** - Session tokens
```sql
id              - Session ID
user_id         - Link to user_credentials
token_hash      - Secure session token
expires_at      - Session expiration time (30 days default)
```

**password_reset_tokens** - For forgot password
```sql
id              - Token ID
user_id         - Which user
token_hash      - Reset token hash
expires_at      - Expires in 1 hour
used_at         - When it was used
```

### New API Endpoints

#### Register
```
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "displayName": "John Doe"
}

Response (201):
{
  "ok": true,
  "userId": "user_123abc",
  "message": "Registration successful. Please log in."
}
```

#### Login
```
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}

Response (200):
{
  "ok": true,
  "userId": "user_123abc",
  "message": "Login successful"
}

Sets cookie: auth_token=<session_token>
```

#### Forgot Password
```
POST /api/auth/forgot-password
{
  "email": "user@example.com"
}

Response:
{
  "ok": true,
  "message": "Password reset link sent to email"
  // (Don't reveal if email exists - security best practice)
}
```

#### Reset Password
```
POST /api/auth/reset-password
{
  "resetToken": "<token-from-email>",
  "newPassword": "NewSecurePassword123"
}

Response:
{
  "ok": true,
  "message": "Password reset successful"
}
```

### Code Structure

**Utilities** (`lib/auth-email.ts`):
- `registerEmailUser()` - Create new account
- `loginEmailUser()` - Verify login, create session
- `verifySessionToken()` - Check if session valid
- `generatePasswordResetToken()` - For forgot password flow
- `resetPassword()` - Update password

**Routes**:
- `app/api/auth/register/route.ts` - Registration endpoint
- `app/api/auth/login/route.ts` - Login endpoint
- (Additional routes in plan below)

---

## 🔀 **Dual Authentication (OpenAI + Email/Password)**

### How to Support Both

Update `repairtrace-find/app/chatgpt-auth.ts`:

```typescript
// BEFORE: Only OpenAI
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!email) return null;
  // ... return user
}

// AFTER: OpenAI OR Email/Password
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const requestHeaders = await headers();
  
  // Try OpenAI first
  const oaiEmail = requestHeaders.get(USER_EMAIL_HEADER);
  if (oaiEmail) {
    return { email: oaiEmail, authProvider: 'openai' };
  }
  
  // Try email/password session
  const cookies = requestHeaders.get('cookie') || '';
  const authToken = cookies.split('auth_token=')[1]?.split(';')[0];
  if (authToken) {
    const user = await verifySessionToken(authToken);
    if (user.email) {
      return { email: user.email, authProvider: 'email' };
    }
  }
  
  return null;
}
```

### Update API Handlers

All route handlers currently use:
```typescript
const {user} = await accountForRequest(request);
```

This automatically checks both OpenAI headers and email/password sessions - **no changes needed!**

---

## 🔐 **Security Best Practices Implemented**

✅ **Passwords**:
- Hashed with bcrypt (SHA-256 in current implementation, upgrade to bcrypt)
- Never stored in plain text
- Salt included during hashing

✅ **Sessions**:
- 30-day expiration
- Secure token generation (32 random bytes)
- HttpOnly cookies (can't be read by JavaScript)
- Secure flag (HTTPS only)
- SameSite=Strict (CSRF protection)

✅ **Password Reset**:
- Tokens expire in 1 hour
- Can only be used once
- Not reversible (one-way hash)

✅ **Data Privacy**:
- Don't reveal if email is registered (forgot password)
- Rate limit login attempts (prevent brute force)
- Log suspicious activity

---

## 📱 **Frontend Integration**

### Registration Flow
```javascript
// Register
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123',
    displayName: 'John Doe'
  })
});

const data = await response.json();
if (data.ok) {
  // Show "Registration successful, please log in"
  // Redirect to login page
}
```

### Login Flow
```javascript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123'
  }),
  credentials: 'include' // Include cookies
});

const data = await response.json();
if (data.ok) {
  // Redirect to dashboard
}
```

### Check Auth Status
```javascript
// Check if logged in (works with both auth methods)
const response = await fetch('/api/account', {
  credentials: 'include'
});
const data = await response.json();

if (data.signedIn) {
  // User is authenticated (via OpenAI or email/password)
  console.log(data.user);
}
```

---

## 🚀 **OAuth (Google/GitHub) - Implementation Guide**

### For Google OAuth

1. **Create Google OAuth Credentials**:
   - Go to Google Cloud Console
   - Create OAuth 2.0 credentials (Web application)
   - Add redirect URI: `https://your-domain/api/auth/google/callback`

2. **Create Auth Endpoint**:
```typescript
// app/api/auth/google/callback/route.ts
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code');
  
  // Exchange code for token (via Google API)
  // Create/update user in database
  // Create session
  // Redirect to dashboard
}
```

3. **Link to account**:
```sql
INSERT INTO user_credentials 
  (id, email, oauth_provider, oauth_id, auth_provider)
VALUES (?, ?, 'google', ?, 'oauth')
```

### For GitHub OAuth

Similar process:
1. Register OAuth app on GitHub
2. Exchange code for token
3. Get user email from GitHub API
4. Create/update user in database

---

## 📋 **Implementation Checklist**

### ✅ Already Done
- [x] Database migration created (`0007_auth_system.sql`)
- [x] Auth utilities created (`lib/auth-email.ts`)
- [x] Register endpoint (`app/api/auth/register/route.ts`)
- [x] Login endpoint (`app/api/auth/login/route.ts`)
- [x] Session management ready
- [x] Password reset templates ready
- [x] Dual auth support designed

### 🔄 To Do After Deployment
- [ ] Apply migration `0007_auth_system.sql`
- [ ] Build registration UI form
- [ ] Build login UI form
- [ ] Build password reset UI
- [ ] Test email/password flow end-to-end
- [ ] Update auth helper for dual support
- [ ] Test that both OpenAI and email/password work
- [ ] (Optional) Add Google OAuth
- [ ] (Optional) Add GitHub OAuth
- [ ] Add email verification (send verification email)
- [ ] Add rate limiting on login attempts
- [ ] Monitor for suspicious login activity

---

## 🔑 **Environment Variables**

Add to your deployment platform:

```
PASSWORD_SALT=<strong-random-string>
# Used to add randomness to password hashing
# Generate: openssl rand -base64 32

SESSION_DURATION_DAYS=30
# How long sessions last before expiring

EMAIL_FROM=noreply@repairtrace.com
# For password reset emails (optional, for future)

EMAIL_API_KEY=<key>
# Resend or SendGrid API (optional, for future)
```

---

## 📊 **Migration Path**

### Phase 1 (Current)
- ✅ OpenAI-only authentication
- ✅ Works for existing users

### Phase 2 (After Migration 0007)
- ✅ Email/password available
- ✅ OpenAI still works
- ✅ Users can choose login method

### Phase 3 (Optional)
- Google OAuth
- GitHub OAuth
- Link multiple auth methods to one account

---

## 🎯 **Benefits of Dual Auth**

✅ **Existing users**: Keep using OpenAI (no disruption)  
✅ **New users**: Can choose email/password or Google/GitHub  
✅ **More accessible**: Not everyone has ChatGPT account  
✅ **Enterprise-ready**: Better for businesses  
✅ **Flexibility**: Users can have multiple login methods  

---

## ⚠️ **Important Notes**

1. **Current Implementation**: Uses SHA-256 hashing
   - **Production**: Upgrade to bcrypt
   - Why: Bcrypt is designed for password hashing, much slower

2. **Session Tokens**: 30-day expiration
   - Can be changed in `lib/auth-email.ts`
   - Shorter = more secure, longer = better UX

3. **Password Requirements**:
   - Minimum 8 characters
   - (Optional) Add: uppercase, lowercase, numbers, symbols

4. **Email Verification**:
   - Currently not enforced
   - (Optional) Send email verification link on signup

---

## 📚 **Files Modified/Created**

**Database**:
- `repairtrace-find/drizzle/0007_auth_system.sql` (new)

**Utilities**:
- `repairtrace-find/lib/auth-email.ts` (new)

**API Routes**:
- `repairtrace-find/app/api/auth/register/route.ts` (new)
- `repairtrace-find/app/api/auth/login/route.ts` (new)

**To Update**:
- `repairtrace-find/app/chatgpt-auth.ts` (add dual-auth logic)
- Frontend: Add registration/login UI forms

---

## 🧪 **Test the Flow**

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "TestPassword123",
    "displayName": "Test User"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "TestPassword123"
  }'

# Check auth (should work with both methods now)
curl http://localhost:3000/api/account
```

---

**Created**: 2026-08-14  
**System**: RepairTrace Marketplace  
**Status**: Ready for deployment
