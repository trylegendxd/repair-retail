import { NextResponse } from "next/server";
import { accountForRequest, privateHeaders } from "@/lib/account-auth";
import { getD1 } from "@/lib/server-marketplace";

const ADMIN_EMAILS = ["admin@repairtrace.com", process.env.ADMIN_EMAIL || ""].filter(Boolean);

function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function GET(request: Request) {
  try {
    const { account } = await accountForRequest(request);
    if (!account || !isAdmin(account.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403, headers: privateHeaders });
    }

    const url = new URL(request.url);
    const status = (url.searchParams.get("status") || "pending") as "pending" | "approved" | "rejected" | "all";
    const countryCode = url.searchParams.get("countryCode") || "PT";

    const db = getD1();

    let query = `
      SELECT
        d.id, d.account_id, d.doc_type, d.object_key, d.file_name, d.status,
        d.rejection_reason, d.uploaded_at, d.reviewed_at,
        a.display_name, a.email, a.city, a.region,
        s.business_name, s.business_type
      FROM seller_verification_docs d
      JOIN marketplace_accounts a ON a.id = d.account_id
      LEFT JOIN shop_profiles s ON s.account_id = d.account_id
      WHERE a.country_code = ?
    `;

    const params: unknown[] = [countryCode];

    if (status !== "all") {
      query += ` AND d.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY d.uploaded_at ASC LIMIT 500`;

    const result = await db.prepare(query).bind(...params).all<Record<string, unknown>>();

    const grouped: Record<string, Record<string, unknown>[]> = {};
    const accountIds = new Set<string>();

    (result.results || []).forEach(doc => {
      const accountId = String(doc.account_id);
      accountIds.add(accountId);

      if (!grouped[accountId]) {
        grouped[accountId] = [];
      }
      grouped[accountId].push(doc);
    });

    // Get aggregated status for each account
    const accounts = await Promise.all(
      Array.from(accountIds).map(async (accountId) => {
        const docs = grouped[accountId];
        if (!docs.length) return null;

        const firstDoc = docs[0];
        const docsData = docs.map(d => ({
          id: String(d.id),
          type: String(d.doc_type),
          status: String(d.status),
          uploadedAt: String(d.uploaded_at),
          fileName: String(d.file_name),
          rejectionReason: d.rejection_reason ? String(d.rejection_reason) : null
        }));

        return {
          accountId,
          displayName: String(firstDoc.display_name),
          email: String(firstDoc.email),
          city: String(firstDoc.city),
          businessName: firstDoc.business_name ? String(firstDoc.business_name) : null,
          businessType: firstDoc.business_type ? String(firstDoc.business_type) : null,
          documents: docsData,
          allDocsPending: docsData.every(d => d.status === "pending"),
          overallStatus: docsData.some(d => d.status === "rejected") ? "rejected" :
                        docsData.every(d => d.status === "approved") ? "approved" : "pending"
        };
      })
    );

    return NextResponse.json({
      count: accounts.filter(Boolean).length,
      accounts: accounts.filter(Boolean),
      filterStatus: status,
      filterCountryCode: countryCode
    }, { headers: privateHeaders });
  } catch (error) {
    console.error("admin verification list failed", error);
    return NextResponse.json({ error: "Failed to load verifications" }, { status: 500, headers: privateHeaders });
  }
}
