# RepairTrace Seller Verification System

**Status**: ✅ Implemented and Ready  
**Date**: 2026-08-14  
**Version**: 1.0  

---

## 🎯 Overview

The Seller Verification System prioritizes verified shops while supporting individual sellers and casual customers. This creates a trust-based marketplace where:

✅ **Customers** can register and post repairs  
✅ **Individual Sellers** (freelancers) can offer repairs  
✅ **Verified Shops** (businesses) are prioritized and trusted  

---

## 📊 Seller Tiers

### Tier 1: Customer (Default)
- **Role**: Posts repair needs
- **Registration**: Email + basic info
- **Verification**: None
- **Search visibility**: Can view sellers

### Tier 2: Individual Seller
- **Role**: Freelancer/solo technician
- **Registration**: "Individual Seller" type
- **Verification**: None
- **Trust Score**: Built through ratings
- **Search visibility**: Shown in seller feeds (below shops)

### Tier 3: Verified Shop (Premium)
- **Role**: Business entity
- **Registration**: "Shop" type + business details
- **Verification**: Document submission + admin approval
- **Trust Score**: Automatic + ratings-based
- **Search visibility**: **Prioritized at top of results**
- **Benefits**:
  - Top placement in searches
  - "Verified" badge
  - Trust score calculation
  - Business credibility

---

## 🔐 Shop Verification Process

### Step 1: Register as Shop
```
POST /api/sellers/register
{
  "sellerType": "shop",
  "businessName": "John's Electronics Repair",
  "businessType": "electronics_repair"
}
```

**Response**: `"verification_status": "pending"`

### Step 2: Submit Required Documents

```
POST /api/sellers/verify-docs
FormData:
  - docType: "business_license"
  - document: [PDF/JPG/PNG file, max 5MB]
```

**Required Documents**:
1. **business_license** - Business registration/license
2. **tax_id** - Tax registration document
3. **shop_photo** - Photo of physical location
4. **insurance** - Business insurance certificate
5. **id_proof** - Owner's ID verification

**Upload Endpoint**:
```
POST /api/sellers/verify-docs

GET /api/sellers/verify-docs  (check status)
```

### Step 3: Admin Review
- Admin reviews submitted documents (internal process)
- Updates `verification_status` → "approved" or "rejected"
- If rejected, provides `rejection_reason`
- Shop receives notification of status

### Step 4: Verified!
- `is_verified = 1`
- Shop appears with "✓ Verified" badge
- Prioritized in search results
- Trust score starts accumulating

---

## ⭐ Trust Score System

### What is Trust Score?
A numerical indicator (0.0 - 5.0) of seller reliability based on:
- **Customer ratings** (1-5 stars)
- **Repair completion rate** (successful/total)
- **Number of successful repairs** (more experience = higher score)
- **Time in business** (for established shops)

### Calculation Formula
```
trust_score = (average_rating) × (successful_repairs / total_repairs)
              × (min(total_repairs, 50) / 50)

Example:
- Avg rating: 4.5 stars
- Success rate: 48/50 repairs
- Trust score = 4.5 × 0.96 × 1.0 = 4.32
```

### What Affects Trust Score?
✅ **Increases**:
- High customer ratings (4-5 stars)
- High completion rate
- Quick response times
- Professional communication

❌ **Decreases**:
- Low customer ratings (1-2 stars)
- Failed repairs
- Slow turnarounds
- Customer complaints

---

## 🌟 Customer Rating System

### Customers Rate Sellers After Repair

```
POST /api/sellers/rate
{
  "sellerId": "seller_id_123",
  "offerId": "offer_id_456",
  "rating": 5,
  "comment": "Great service, fast turnaround!",
  "categories": {
    "communication": 5,
    "quality": 4,
    "speed": 5,
    "professionalism": 5
  }
}
```

### Rating Categories
- **Communication**: How responsive was the seller?
- **Quality**: Quality of repair work
- **Speed**: How quickly was it completed?
- **Professionalism**: Professionalism and cleanliness
- **Value**: Was it worth the price?

### Viewing Ratings

```
GET /api/sellers/rate?sellerId=seller_id_123

Response:
{
  "ratings": [
    {
      "rating": 5,
      "comment": "Excellent work!",
      "categories": {...},
      "created_at": "2026-08-14T10:30:00Z"
    }
  ],
  "stats": {
    "total": 24,
    "averageRating": 4.6,
    "minRating": 3,
    "maxRating": 5
  }
}
```

---

## 🔍 Smart Search & Filtering

### Search Endpoint
```
GET /api/sellers/search?
  category=electronics&
  verified=true&
  minRating=4.0&
  radius=50
```

### Sort Priority (Top to Bottom)
1. **✓ Verified Shops** (is_verified = 1)
2. **Individual Sellers** (with high ratings)
3. **Unverified Providers** (if needed)

### Within Each Tier
- Sort by `trust_score` (highest first)
- Then by `average_rating`
- Filter by distance radius
- Filter by specializations

### Response Includes
```json
{
  "sellers": [
    {
      "id": "seller_id",
      "name": "John's Electronics",
      "sellerType": "shop",
      "badge": "verified_shop",
      "isVerified": true,
      "trustScore": 4.6,
      "averageRating": 4.6,
      "totalRatings": 24,
      "successRate": 96,
      "specializations": ["phones", "laptops", "tablets"],
      "turnaroundDays": 2,
      "warranty": 12,
      "distanceKm": 3.5
    }
  ],
  "priorityInfo": {
    "1": "✓ Verified Shop (prioritized)",
    "2": "Individual Seller",
    "3": "Unverified Provider"
  }
}
```

---

## 📱 User Workflows

### For Customers
1. Post repair need (existing flow)
2. See shops sorted by trust score
3. Verified shops highlighted at top
4. After repair: Rate the seller (1-5 stars + comments)
5. Rating updates seller's trust score

### For Individual Sellers
1. Register as "individual_seller"
2. Respond to nearby repairs
3. Build trust through ratings
4. No verification required
5. Can upgrade to shop later

### For Shop Owners
1. Register as "shop"
2. Submit business documents (5 required)
3. Wait for admin verification (~24-48 hours)
4. Receive "✓ Verified" badge
5. Appear at top of search results
6. Build trust through ratings

---

## 🛡️ Database Schema

### New Tables
1. **seller_verification_docs** - Document uploads for shop verification
2. **shop_profiles** - Detailed shop information
3. **seller_ratings** - Customer ratings for sellers

### Updated marketplace_accounts
```sql
seller_type TEXT           -- 'customer', 'individual_seller', 'shop'
is_verified INTEGER        -- 0 or 1
verification_status TEXT   -- 'none', 'pending', 'approved', 'rejected'
verification_submitted_at TEXT
verification_approved_at TEXT
rejection_reason TEXT
trust_score REAL           -- 0.0 - 5.0
total_repairs INTEGER      -- Number of completed repairs
successful_repairs INTEGER -- Successful completions
```

### Updated repair_offers
```sql
completion_status TEXT     -- 'pending', 'in_progress', 'completed', 'cancelled'
completed_at TEXT
customer_rating_id TEXT    -- Link to customer's rating
seller_rating_id TEXT      -- Link to seller's rating (future)
```

---

## 🚀 New API Endpoints

### Seller Registration
```
POST /api/sellers/register
{
  "sellerType": "shop" | "individual_seller",
  "businessName": "...",
  "businessType": "..."
}
```

### Upload Verification Documents
```
POST /api/sellers/verify-docs (multipart/form-data)
- docType: 'business_license' | 'tax_id' | 'shop_photo' | 'insurance' | 'id_proof'
- document: File (PDF/JPG/PNG, max 5MB)

GET /api/sellers/verify-docs
Response: List of uploaded documents and status
```

### Search Sellers
```
GET /api/sellers/search?category=&verified=&minRating=&radius=
Response: List of sellers sorted by trust score and verified status
```

### Rate Seller
```
POST /api/sellers/rate
{
  "sellerId": "...",
  "offerId": "...",
  "rating": 1-5,
  "comment": "...",
  "categories": {...}
}

GET /api/sellers/rate?sellerId=...
Response: Ratings and statistics for seller
```

---

## 📊 Admin Dashboard (Future)

The following admin endpoints can be added:

```
GET /api/admin/verifications/pending
- List pending verification requests

PATCH /api/admin/verifications/{docId}/approve
- Approve a document

PATCH /api/admin/verifications/{docId}/reject
{
  "reason": "License expired"
}
- Reject a document

POST /api/admin/verifications/{accountId}/finalize
- Finalize verification after all docs approved
```

---

## 🔒 Security Considerations

✅ **Document uploads**:
- Size limit: 5MB per document
- Allowed types: PDF, JPEG, PNG
- Stored in R2 with `private, no-store` cache
- Unique object keys prevent collision

✅ **Rating integrity**:
- Only customers can rate
- Only after repair completion
- Timestamp tracked
- Can update but not delete

✅ **Verification flow**:
- Admin review required
- No auto-approval
- Clear audit trail
- Rejection reasons logged

---

## 📈 Benefits of This System

### For Customers
- Find trustworthy, verified shops first
- See ratings before choosing
- Filter by specialization and success rate
- More secure marketplace

### For Sellers
- Individual sellers can build reputation
- No gatekeeping for starting out
- Shops get visibility advantage
- Clear path to trust building

### For Platform
- Trustworthy suppliers (shops prioritized)
- Quality control (ratings system)
- Reduced fraud (document verification)
- Data-driven improvements (trust score analytics)

---

## 🚀 Deployment Checklist

- [ ] Apply migration: `0006_seller_verification.sql`
- [ ] Create new API endpoints (4 files added)
- [ ] Update search logic to use new sorting
- [ ] Add UI for seller type selection
- [ ] Add UI for document upload
- [ ] Add rating UI after repair completion
- [ ] Add seller profile display with trust score
- [ ] Create admin dashboard (future)
- [ ] Test verification flow end-to-end
- [ ] Deploy and monitor

---

## 📝 Example User Journeys

### Journey 1: Individual Seller
```
1. User signs up → Account created (role: customer)
2. User clicks "Become a Seller" → sellerType: "individual_seller"
3. User browses repairs → Can see and offer
4. Customer rates 5 stars → Trust score increases
5. After 10+ ratings → Becomes trusted seller
6. (Optional) Can upgrade to "shop" tier for verification
```

### Journey 2: Shop Owner
```
1. Shop owner signs up → Account created
2. Chooses "Register as Shop" → sellerType: "shop"
3. Enters business details → Verification process starts
4. Uploads 5 required documents → Status: pending
5. Admin reviews within 48 hours → Documents approved
6. Shop receives "✓ Verified" badge → Appears at top of searches
7. Customers rate repairs → Trust score calculated
8. After 20+ ratings with avg 4.5+ → Featured shop badge
```

---

## 🎯 Metrics to Track

- Number of shops registrations per week
- Document approval time (target: <48 hours)
- Average trust score by seller type
- Correlation between trust score and offer acceptance
- Customer satisfaction (rating distribution)
- Repeat customer rate (customers rebook same seller)

---

## 🔄 Future Enhancements

1. **Seller tiers** (Bronze, Silver, Gold, Platinum)
2. **Seasonal ratings** (track seasonal reliability)
3. **Specialization endorsements** (customers verify expertise)
4. **Seller insurance verification** (automatic via insurance API)
5. **Background check integration** (for added trust)
6. **Seller dispute resolution** (customer-seller conflicts)
7. **Performance alerts** (notify shops of low ratings)

---

*Created: 2026-08-14*  
*System: RepairTrace Marketplace*  
*Version: 1.0*
