# RepairTrace Audit Report (In Progress)

**Date**: 2026-08-13  
**Project**: RepairTrace (Workshop + Find + Android Wrapper)  
**Node.js Requirement**: 22.13+ (Current: v18.19.1 - Version mismatch detected)

## Initial Observations from Code Review

### ✅ Strengths Identified

1. **Strong Authorization Patterns**
   - `ownerIdFromRequest()` hashes email to non-readable ID for DB isolation
   - All API routes validate ownership server-side (not client-side)
   - Workshop app queries filter by `owner_id` at database level
   - Find app uses `accountForRequest()` to verify marketplace account

2. **Privacy-by-Design**
   - Customer email/phone hidden from provider feeds in announcements
   - Only revealed after offer acceptance (line 34, announcements/route.ts)
   - `repairIntelligenceRecords` table deliberately excludes customer details, serial numbers, notes, photos
   - Shop data sanitized before marketplace sync

3. **Input Validation**
   - Photo validation: size (8MB max), count (5 max), MIME type check
   - Byte signature detection (JPEG, PNG, WebP magic bytes)
   - Text input cleaned: `cleanText()`, `cleanMultiline()` with size limits
   - Email/phone patterns validated with regex before storage
   - Request size validation on declared Content-Length

4. **Database Schema Design**
   - Proper foreign key relationships and indexes
   - Unique constraints on sensitive identifiers (tickets, quote keys, invoice keys)
   - Separate D1 databases for each app (not merged)
   - Drizzle migrations preserve history (not rewritten)

### 🔍 Areas Requiring Investigation

1. **Concurrent Offer Acceptance**
   - CLAUDE.md states "Prevent concurrent acceptance of multiple offers for one repair announcement"
   - Need to verify `acceptedOfferId` column prevents race conditions
   - Check if UPDATE is atomic or if race window exists

2. **Rate Limiting**
   - Found basic rate check (line 65, announcements/route.ts): 5 posts per hour, 20 max open
   - Need to verify this is enforced consistently across all POST endpoints
   - Check if authenticated vs unauthenticated endpoints have rate limits

3. **Image Upload Cleanup**
   - Code uploads photos, if later error occurs, bucket.delete() called in catch
   - Need to verify cleanup runs reliably and orphaned photos don't accumulate

4. **Device Catalogue Handling**
   - `lib/generated/google-play-devices.ts` ~26k devices
   - Correctly kept server-only (not in browser bundle)
   - Need to verify catalogue doesn't leak through API responses

5. **Same-Origin Protection**
   - Found `isSameOriginMutation()` check in Find app
   - Need to verify same protection exists in Workshop app for mutations
   - Check if all mutation endpoints enforce this

6. **Marketplace Sync Security**
   - Server-to-server sync uses `REPAIRTRACE_FIND_SYNC_KEY` and `REPAIRTRACE_FIND_URL`
   - Need to verify secrets are not in source code
   - Check if sync leaks workshop identities or customer data

## Database Structure Summary

### Workshop App (10 migrations)
- repairs (core table with ownership isolation)
- customers, inventoryItems, shopTechnicians, shopAppointments
- repairTests, repairParts, repairPhotos, repairEvents
- repairClientUpdates, repairNotifications
- repairAiEstimates, repairAiSources
- repairGuides, repairIfixitGuides
- shopSettings
- repairContributionLinks (for marketplace sync)
- repairIntelligenceRecords (sanitized data only)

### Find App (4 migrations)
- partnerShops (synced from Workshop)
- shopServices (price samples from Workshop)
- marketPriceSamples (anonymized repairs)
- quoteRequests (legacy, needs review)
- marketplaceAccounts (customer/provider accounts)
- repairAnnouncements (customer repair posts)
- repairAnnouncementPhotos (max 5 per announcement)
- repairOffers (provider offers)

## Known Limitations (From Handoff Guide)

1. ⚠️ **Node.js 22.13+ required** but system has v18.19.1
   - Cannot run `--experimental-strip-types` test flag
   - Tests cannot run until Node is upgraded
   
2. ⚠️ **Platform authentication dependency**
   - Uses `oai-authenticated-user-email` header from hosting layer
   - If moved to different host, must implement session layer first
   
3. ⚠️ **Email/SMS integrations inactive**
   - Resend API, Twilio SMS require valid credentials
   - Currently dead code but configured in schema

4. ⚠️ **Browser-based geolocation**
   - Repair announcements rely on browser coordinates
   - Should validate or use real geocoding

## Linting Status

✅ **Workshop app**: `npm run lint` - PASS (0 errors)  
✅ **Find app**: `npm run lint` - PASS (0 errors)

## Full Audit

Detailed security audit running in background. Findings will include:
- Authorization bypass scenarios
- Privacy leak vectors
- Upload attack vectors
- Race condition vulnerabilities
- Missing rate limits
- API contract inconsistencies

---

*Detailed findings pending completion of full codebase scan.*
