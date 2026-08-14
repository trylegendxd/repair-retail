import { NextResponse } from "next/server";
import { accountForRequest, privateHeaders } from "@/lib/account-auth";
import { getD1 } from "@/lib/server-marketplace";

export async function GET(request: Request) {
  try {
    const { account } = await accountForRequest(request);
    if (!account) return NextResponse.json({ error: "Sign in" }, { status: 401, headers: privateHeaders });

    const db = getD1();

    // Get seller profile if provider
    let shopProfile = null;
    let verificationDocs = null;

    if (account.role === "provider") {
      const shop = await db.prepare(`
        SELECT id, business_name, business_type, specializations, warranty_offered
        FROM shop_profiles WHERE account_id = ? LIMIT 1
      `).bind(account.id).first<Record<string, unknown>>();

      if (shop) {
        shopProfile = {
          businessName: String(shop.business_name),
          businessType: String(shop.business_type),
          specializations: shop.specializations ? JSON.parse(String(shop.specializations)) : [],
          warrantyOffered: Number(shop.warranty_offered)
        };
      }

      // Get verification status
      const docs = await db.prepare(`
        SELECT doc_type, status, rejection_reason, uploaded_at
        FROM seller_verification_docs WHERE account_id = ?
        ORDER BY uploaded_at DESC
      `).bind(account.id).all<Record<string, unknown>>();

      verificationDocs = (docs.results || []).map(d => ({
        type: String(d.doc_type),
        status: String(d.status),
        rejectionReason: d.rejection_reason ? String(d.rejection_reason) : null,
        uploadedAt: String(d.uploaded_at)
      }));
    }

    return NextResponse.json({
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      role: account.role,
      city: account.city,
      region: account.region,
      country: account.countryCode,
      phone: account.phone,
      sellerType: account.sellerType,
      isVerified: account.isVerified,
      verificationStatus: account.verificationStatus,
      trustScore: account.trustScore,
      shopProfile,
      verificationDocs,
      stats: {
        totalRepairs: account.totalRepairs,
        successfulRepairs: account.successfulRepairs,
        successRate: account.totalRepairs > 0 ? (account.successfulRepairs / account.totalRepairs * 100) : 0
      }
    }, { headers: privateHeaders });
  } catch (error) {
    console.error("me endpoint failed", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500, headers: privateHeaders });
  }
}
