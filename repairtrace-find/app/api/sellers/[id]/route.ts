import { NextResponse } from "next/server";
import { accountForRequest, privateHeaders } from "@/lib/account-auth";
import { getD1 } from "@/lib/server-marketplace";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { account } = await accountForRequest(request);
    if (!account) return NextResponse.json({ error: "Sign in" }, { status: 401, headers: privateHeaders });

    const { id } = await params;
    const db = getD1();

    // Get seller account and shop profile
    const seller = await db.prepare(`
      SELECT
        a.id, a.display_name, a.email, a.city, a.region, a.country_code,
        a.latitude, a.longitude, a.seller_type, a.is_verified, a.trust_score,
        a.total_repairs, a.successful_repairs, a.service_radius_km,
        s.business_name, s.business_type, s.specializations, s.average_turnaround_days,
        s.warranty_offered, s.registration_number, s.website, s.social_media_handles,
        s.years_in_business, s.employee_count
      FROM marketplace_accounts a
      LEFT JOIN shop_profiles s ON s.account_id = a.id
      WHERE a.id = ? AND a.role = 'provider' LIMIT 1
    `).bind(id).first<Record<string, unknown>>();

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404, headers: privateHeaders });
    }

    // Get ratings
    const ratings = await db.prepare(`
      SELECT rating, comment, categories, created_at
      FROM seller_ratings
      WHERE seller_account_id = ?
      ORDER BY created_at DESC LIMIT 30
    `).bind(id).all<Record<string, unknown>>();

    const stats = await db.prepare(`
      SELECT COUNT(*) as total, AVG(rating) as avg_rating, MIN(rating) as min, MAX(rating) as max
      FROM seller_ratings WHERE seller_account_id = ?
    `).bind(id).first<Record<string, unknown>>();

    // Parse specializations if present
    let specializations: string[] = [];
    if (seller.specializations) {
      try {
        const parsed = JSON.parse(String(seller.specializations));
        specializations = Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
      } catch {
        specializations = [];
      }
    }

    return NextResponse.json({
      id: String(seller.id),
      displayName: String(seller.display_name),
      sellerType: String(seller.seller_type),
      isVerified: seller.is_verified === 1,
      businessName: seller.business_name ? String(seller.business_name) : null,
      businessType: seller.business_type ? String(seller.business_type) : null,
      location: {
        city: String(seller.city),
        region: String(seller.region),
        country: String(seller.country_code),
        latitude: seller.latitude ? Number(seller.latitude) : null,
        longitude: seller.longitude ? Number(seller.longitude) : null,
        serviceRadiusKm: Number(seller.service_radius_km)
      },
      stats: {
        trustScore: Number(seller.trust_score),
        totalRepairs: Number(seller.total_repairs),
        successfulRepairs: Number(seller.successful_repairs),
        successRate: seller.total_repairs ? (Number(seller.successful_repairs) / Number(seller.total_repairs) * 100) : 0
      },
      shop: seller.seller_type === "shop" ? {
        businessType: String(seller.business_type),
        specializations,
        turnaroundDays: Number(seller.average_turnaround_days) || 3,
        warrantyOffered: Number(seller.warranty_offered) || 0,
        registrationNumber: seller.registration_number ? String(seller.registration_number) : null,
        website: seller.website ? String(seller.website) : null,
        socialMedia: seller.social_media_handles ? String(seller.social_media_handles) : null,
        yearsInBusiness: seller.years_in_business ? Number(seller.years_in_business) : null,
        employeeCount: seller.employee_count ? Number(seller.employee_count) : null
      } : null,
      ratings: {
        data: (ratings.results || []).map(r => ({
          rating: Number(r.rating),
          comment: r.comment ? String(r.comment) : null,
          categories: r.categories ? JSON.parse(String(r.categories)) : null,
          createdAt: String(r.created_at)
        })),
        stats: {
          total: Number(stats?.total || 0),
          average: Number(stats?.avg_rating || 0),
          min: Number(stats?.min || 0),
          max: Number(stats?.max || 0)
        }
      }
    }, { headers: privateHeaders });
  } catch (error) {
    console.error("seller details failed", error);
    return NextResponse.json({ error: "Failed to load seller" }, { status: 500, headers: privateHeaders });
  }
}
