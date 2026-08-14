# RepairTrace Vercel Refactor Plan

**Goal**: Convert from Cloudflare Workers to standard Vercel deployment  
**Effort**: 4-6 hours  
**Risk**: Medium (requires database/storage layer rewrite)

---

## Changes Required

### 1. Package.json Cleanup
**Remove:**
- `vinext` (Cloudflare Next.js adapter)
- `wrangler` (Cloudflare CLI)
- `@cloudflare/vite-plugin`

**Keep:**
- All other dependencies
- Next.js, React, Drizzle

**Result:** Standard Next.js app

### 2. Database Access Layer
**Current (Worker Binding):**
```typescript
export function getD1() {
  const db = runtimeEnv().DB; // Comes from Cloudflare binding
  return db;
}
```

**New (REST API):**
```typescript
export function getD1() {
  return new CloudflareD1API({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN
  });
}
```

### 3. File Storage Access Layer
**Current (Worker Binding):**
```typescript
export function getBucket() {
  const bucket = runtimeEnv().BUCKET; // Comes from Cloudflare binding
  return bucket;
}
```

**New (S3-Compatible API):**
```typescript
export function getBucket() {
  return new CloudflareR2API({
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME
  });
}
```

### 4. Build Scripts
**Current:** Uses `vinext` build tool  
**New:** Standard `next build`

### 5. Environment Variables
**Add to Vercel:**
```
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_DATABASE_ID=...
CLOUDFLARE_API_TOKEN=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
ADMIN_EMAIL=...
```

---

## Step-by-Step Implementation

### Phase 1: Setup (30 min)
- [ ] Update package.json
- [ ] Create new database access module
- [ ] Create new file storage module
- [ ] Create Cloudflare API wrapper classes

### Phase 2: Database Layer (90 min)
- [ ] Implement D1 REST API client
- [ ] Update lib/server-marketplace.ts
- [ ] Test database queries
- [ ] Verify migrations work

### Phase 3: Storage Layer (60 min)
- [ ] Implement R2/S3 API client
- [ ] Update file upload endpoints
- [ ] Test file operations
- [ ] Verify image serving

### Phase 4: Build Configuration (30 min)
- [ ] Update build scripts
- [ ] Update next.config.ts
- [ ] Remove Cloudflare-specific config
- [ ] Test local build

### Phase 5: Testing (60 min)
- [ ] Run `npm run build`
- [ ] Test locally with `npm run dev`
- [ ] Verify database queries work
- [ ] Verify file uploads work
- [ ] Test all API endpoints

### Phase 6: Deployment (30 min)
- [ ] Deploy to Vercel
- [ ] Verify environment variables
- [ ] Test production deployment
- [ ] Monitor logs

---

## Implementation Order

1. ✅ Update package.json
2. ✅ Create D1 REST API wrapper
3. ✅ Create R2 REST API wrapper  
4. ✅ Update lib/server-marketplace.ts
5. ✅ Update build scripts
6. ✅ Test locally
7. ✅ Commit changes
8. ✅ Deploy to Vercel

---

## What Stays the Same

- All API endpoints (no changes needed)
- All React components (no changes needed)
- All business logic (no changes needed)
- Authentication flow (OpenAI headers still work)
- Database schema (same D1 database)
- File storage (same R2 bucket)

**Only the access layer changes—the rest of the app is unaffected.**

---

## Rollback Plan

If something breaks:
1. Revert commits on GitHub
2. Vercel automatically redeploys from GitHub
3. Back to Cloudflare Workers version

**Time to rollback:** 2 minutes

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Database queries fail | High | Use REST API spec, test each endpoint |
| File uploads break | High | Test R2 API with sample files |
| Build fails | High | Test `npm run build` locally first |
| Auth stops working | Medium | Auth uses headers, shouldn't change |
| Performance degrades | Low | REST API slightly slower but acceptable |

---

## Success Criteria

✅ `npm run build` completes without errors  
✅ `npm run dev` starts successfully  
✅ Database queries return data  
✅ File uploads work  
✅ All API endpoints respond  
✅ Deployed to Vercel and live  
✅ No user-facing changes  

---

## Files Being Modified

```
repairtrace-find/
├── package.json [MODIFY]
├── package-lock.json [REGENERATE]
├── next.config.ts [MODIFY]
├── tsconfig.json [MAYBE MODIFY]
├── scripts/
│   ├── build-verified.sh [REPLACE]
│   └── ... other scripts
├── lib/
│   ├── server-marketplace.ts [MODIFY - KEY FILE]
│   ├── cloudflare-d1-api.ts [NEW]
│   ├── cloudflare-r2-api.ts [NEW]
│   └── account-auth.ts [NO CHANGE]
└── app/
    └── api/
        └── ... [NO CHANGES - uses existing exports]
```

---

## Timeline

- **Phase 1-4**: 4-5 hours
- **Phase 5**: 1-2 hours (testing)
- **Phase 6**: 30 minutes (deployment)

**Total: 5-7 hours of development time**

---

## Next Steps

Ready to start? I'll:

1. Update package.json
2. Create CloudflareD1API wrapper class
3. Create CloudflareR2API wrapper class
4. Update server-marketplace.ts to use REST APIs
5. Update build scripts
6. Commit everything
7. Guide you through deployment

Let me begin Phase 1 now.
