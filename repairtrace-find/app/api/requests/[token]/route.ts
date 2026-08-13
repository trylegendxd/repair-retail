import { NextResponse } from "next/server";
import { clean, ensureMarketplace, getD1 } from "@/lib/server-marketplace";

function maskContact(value: string, type: string) {
  if (type === "email") {
    const [name, domain] = value.split("@");
    return `${name.slice(0, 2)}•••@${domain ?? ""}`;
  }
  return `•••• ${value.replace(/\D/g, "").slice(-4)}`;
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const safeToken = clean(token, 80);
    await ensureMarketplace();
    const row = await getD1().prepare("SELECT q.public_token,q.status,q.model_label,q.issue_key,q.city,q.contact_type,q.contact_value,q.shop_reply,q.shop_price,q.currency,q.created_at,q.updated_at,s.name shop_name,s.city shop_city FROM quote_requests q JOIN partner_shops s ON s.id=q.shop_id WHERE q.public_token=? LIMIT 1")
      .bind(safeToken).first<Record<string, unknown>>();
    const headers={"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"};
    if (!row) return NextResponse.json({ error: "Request not found." }, { status: 404,headers });
    return NextResponse.json({
      token: row.public_token,
      status: row.status,
      modelLabel: row.model_label,
      issueKey: row.issue_key,
      city: row.city,
      maskedContact: maskContact(String(row.contact_value), String(row.contact_type)),
      shopName: row.shop_name,
      shopCity: row.shop_city,
      shopReply: row.shop_reply,
      shopPrice: row.shop_price,
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },{headers});
  } catch (error) {
    console.error("request lookup failed", error);
    return NextResponse.json({ error: "We could not load this request." }, { status: 500,headers:{"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"} });
  }
}
