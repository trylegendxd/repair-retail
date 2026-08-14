import { NextResponse } from "next/server";
import { accountForRequest, privateHeaders } from "@/lib/account-auth";
import { clean, getD1 } from "@/lib/server-marketplace";

export async function GET(request: Request) {
  try {
    const { account } = await accountForRequest(request);
    if (!account) return NextResponse.json({ error: "Sign in" }, { status: 401, headers: privateHeaders });

    const url = new URL(request.url);
    const category = clean(url.searchParams.get("category"), 30) || "";
    const verified = url.searchParams.get("verified") === "true";
    const minRating = Number(url.searchParams.get("minRating")) || 0;
    const radius = Math.min(account.serviceRadiusKm, Math.max(2, Number(url.searchParams.get("radius")) || account.serviceRadiusKm));

    const db = getD1();

    // Build query prioritizing verified shops
    let query = `
      SELECT
        a.id, a.display_name, a.city, a.region, a.latitude, a.longitude,
        a.seller_type, a.is_verified, a.trust_score, a.total_repairs, a.successful_repairs,
        s.business_name, s.business_type, s.specializations, s.average_turnaround_days, s.warranty_offered,
        CASE
          WHEN a.seller_type = 'shop' AND a.is_verified = 1 THEN 1
          WHEN a.seller_type = 'individual_seller' THEN 2
          ELSE 3
        END as priority,
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(r.id) as total_ratings
      FROM marketplace_accounts a
      LEFT JOIN shop_profiles s ON a.id = s.account_id
      LEFT JOIN seller_ratings r ON a.id = r.seller_account_id
      WHERE a.role = 'provider'
        AND a.country_code = ?
        ${verified ? "AND a.is_verified = 1" : ""}
        ${minRating > 0 ? "AND COALESCE(AVG(r.rating), 0) >= ?" : ""}
      GROUP BY a.id
      ORDER BY priority ASC, a.trust_score DESC, average_rating DESC
      LIMIT 100
    `;

    const params: unknown[] = [account.countryCode];
    if (minRating > 0) params.push(minRating);

    const result = await db.prepare(query).bind(...params).all<Record<string, unknown>>();

    const sellers = (result.results || []).map(row => {
      const lat = row.latitude ? Number(row.latitude) : null;
      const lng = row.longitude ? Number(row.longitude) : null;
      const distance = lat && lng && account.latitude && account.longitude
        ? Math.round(distanceKm(account.latitude, account.longitude, lat, lng) * 10) / 10
        : null;

      const badge = row.seller_type === "shop" && row.is_verified === 1 ? "verified_shop" :
                    row.seller_type === "individual_seller" ? "individual" : "unverified";

      return {
        id: String(row.id),
        name: row.seller_type === "shop" ? String(row.business_name) : String(row.display_name),
        sellerType: String(row.seller_type),
        badge,
        isVerified: row.is_verified === 1,
        city: String(row.city),
        region: String(row.region),
        distanceKm: distance,
        trustScore: Number(row.trust_score),
        averageRating: Number(row.average_rating),
        totalRatings: Number(row.total_ratings),
        successRate: row.total_repairs ? (Number(row.successful_repairs) / Number(row.total_repairs) * 100) : 0,
        specializations: row.specializations ? JSON.parse(String(row.specializations)) : [],
        turnaroundDays: Number(row.average_turnaround_days) || 3,
        warranty: Number(row.warranty_offered) || 0
      };
    }).filter(s => !distance || s.distanceKm === null || s.distanceKm <= radius);

    return NextResponse.json({
      sellers,
      count: sellers.length,
      priorityInfo: {
        1: "✓ Verified Shop (prioritized)",
        2: "Individual Seller",
        3: "Unverified Provider"
      }
    }, { headers: privateHeaders });
  } catch (error) {
    console.error("seller search failed", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500, headers: privateHeaders });
  }
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(bLat - aLat), dLng = radians(bLng - aLng);
  const x = Math.max(0, Math.min(1, Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLng / 2) ** 2));
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
