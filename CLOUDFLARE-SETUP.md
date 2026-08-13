# Cloudflare Workers Setup Guide

**Status**: Code is ready, but needs Cloudflare infrastructure setup

---

## What Needs to Happen

The RepairTrace code is currently configured for **OpenAI's hosting platform** (see `.openai/hosting.json`). To deploy to **Cloudflare Workers**, you need to:

1. Create a Cloudflare account (or use existing)
2. Create D1 databases
3. Create R2 buckets
4. Configure wrangler.toml files
5. Authenticate wrangler CLI
6. Deploy

---

## Step 1: Cloudflare Account Setup

### 1a. Create Cloudflare Account (if needed)
- Visit https://dash.cloudflare.com/sign-up
- Create account
- Verify email

### 1b. Upgrade to Workers Paid Plan
- Visit https://dash.cloudflare.com/profile/billing/workers-paid
- Upgrade to paid plan ($5/month, required for D1)

---

## Step 2: Create D1 Databases

### For Find App:
```bash
# Set your Cloudflare email and API token in environment
export CLOUDFLARE_EMAIL="your-email@example.com"
export CLOUDFLARE_API_TOKEN="your-api-token"

# Create D1 database for Find app
npx wrangler d1 create repairtrace-find

# Note the database ID (something like: 12345678-90ab-cdef-ghij-klmnopqrstuv)
```

### For Workshop App:
```bash
# Create D1 database for Workshop app
npx wrangler d1 create repairtrace-workshop

# Note the database ID
```

Both commands will output your database ID - **save these**.

---

## Step 3: Create R2 Buckets

### For Find App (photos):
1. Go to https://dash.cloudflare.com/?to=/:account/r2
2. Click "Create Bucket"
3. Name: `repairtrace-find-photos`
4. Click "Create"

### For Workshop App (photos):
1. Click "Create Bucket"
2. Name: `repairtrace-workshop-photos`
3. Click "Create"

---

## Step 4: Create wrangler.toml Files

### For Find App

Create `/home/shitiforgot3301/RepairTrace-Complete/repairtrace-find/wrangler.toml`:

```toml
name = "repairtrace-find"
type = "javascript"
account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"
main = "worker/index.ts"
compatibility_date = "2024-12-19"
compatibility_flags = ["nodejs_compat"]

[env.production]
name = "repairtrace-find"
routes = [
  { pattern = "repairtrace-find.*.cloudflare.app/*", zone_id = "YOUR_ZONE_ID" }
]

[[d1_databases]]
binding = "D1"
database_name = "repairtrace-find"
database_id = "YOUR_FIND_DB_ID"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "repairtrace-find-photos"

[build]
command = "npm run build"
cwd = "."
watch_paths = ["src/**/*.ts"]

[build.upload]
format = "service-worker"
```

### For Workshop App

Create `/home/shitiforgot3301/RepairTrace-Complete/repairtrace-workshop/wrangler.toml`:

```toml
name = "repairtrace-app"
type = "javascript"
account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"
main = "worker/index.ts"
compatibility_date = "2024-12-19"
compatibility_flags = ["nodejs_compat"]

[env.production]
name = "repairtrace-app"
routes = [
  { pattern = "repairtrace-app.*.cloudflare.app/*", zone_id = "YOUR_ZONE_ID" }
]

[[d1_databases]]
binding = "D1"
database_name = "repairtrace-workshop"
database_id = "YOUR_WORKSHOP_DB_ID"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "repairtrace-workshop-photos"

[build]
command = "npm run build"
cwd = "."
watch_paths = ["src/**/*.ts"]

[build.upload]
format = "service-worker"
```

### Where to Find Your IDs:

1. **CLOUDFLARE_ACCOUNT_ID**: 
   - Visit https://dash.cloudflare.com/?to=/:account/overview
   - Copy "Account ID" from right sidebar

2. **YOUR_FIND_DB_ID** and **YOUR_WORKSHOP_DB_ID**:
   - From Step 2 output when you ran `npx wrangler d1 create`

3. **ZONE_ID**:
   - If using custom domain: https://dash.cloudflare.com
   - If using cloudflare.app: Not needed, use wildcard pattern

---

## Step 5: Get Cloudflare API Token

1. Visit https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Click "Create Token"
5. Copy the token

Set as environment variable:
```bash
export CLOUDFLARE_API_TOKEN="your-token-here"
```

---

## Step 6: Authenticate Wrangler

```bash
source ~/.nvm/nvm.sh
nvm use 22.13.0

npx wrangler login
# This will open browser for OAuth authentication
# Or use API token approach instead
```

---

## Step 7: Deploy

Once everything is configured:

```bash
source ~/.nvm/nvm.sh
nvm use 22.13.0
cd /home/shitiforgot3301/RepairTrace-Complete

# Apply database migrations
npx wrangler d1 execute repairtrace-find \
  --file=./repairtrace-find/drizzle/0004_add_foreign_keys.sql

npx wrangler d1 execute repairtrace-find \
  --file=./repairtrace-find/drizzle/0005_add_rate_limiting.sql

npx wrangler d1 execute repairtrace-workshop \
  --file=./repairtrace-workshop/drizzle/0010_add_foreign_keys.sql

# Deploy both apps
cd repairtrace-find && npx wrangler deploy
cd ../repairtrace-workshop && npx wrangler deploy
```

---

## Alternative: Stay on OpenAI Platform

If you want to **keep using OpenAI's hosting platform** instead of Cloudflare:

1. You already have all the fixes applied ✅
2. Push the code to GitHub
3. Deploy via OpenAI's platform as before
4. Redeploy to pick up the security fixes

The security improvements work on any platform (OpenAI, Cloudflare, AWS, etc.)

---

## Quick Checklist

- [ ] Cloudflare account created
- [ ] Workers paid plan enabled
- [ ] D1 databases created (and IDs noted)
- [ ] R2 buckets created
- [ ] wrangler.toml files created with proper IDs
- [ ] Cloudflare API token generated
- [ ] wrangler login/authentication done
- [ ] Database migrations applied
- [ ] Both apps deployed

---

## Troubleshooting

### "Couldn't find a D1 DB"
**Solution**: Make sure wrangler.toml has correct `database_id` value

### "No authentication token found"
**Solution**: Run `npx wrangler login` or set `CLOUDFLARE_API_TOKEN` environment variable

### "Bucket not found"
**Solution**: Make sure R2 bucket exists and `bucket_name` in wrangler.toml matches exactly

### "Account ID is invalid"
**Solution**: Copy from https://dash.cloudflare.com/?to=/:account/overview right sidebar

---

## Support

- Cloudflare Workers: https://developers.cloudflare.com/workers/
- D1 Database: https://developers.cloudflare.com/d1/
- R2 Storage: https://developers.cloudflare.com/r2/
- wrangler CLI: https://developers.cloudflare.com/workers/wrangler/

---

*Last updated: 2026-08-14*
