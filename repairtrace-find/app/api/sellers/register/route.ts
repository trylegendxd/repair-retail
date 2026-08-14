import { NextResponse } from "next/server";
import { accountForRequest, privateHeaders } from "@/lib/account-auth";
import { clean, getD1 } from "@/lib/server-marketplace";

export async function POST(request: Request) {
  try {
    const { account, user } = await accountForRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401, headers: privateHeaders });

    const body = await request.json() as Record<string, unknown>;
    const sellerType = clean(body.sellerType, 20);

    // Validate seller type
    if (!["individual_seller", "shop"].includes(sellerType)) {
      return NextResponse.json({ error: "Invalid seller type" }, { status: 400, headers: privateHeaders });
    }

    const db = getD1();

    // Update account with seller type
    await db.prepare("UPDATE marketplace_accounts SET seller_type=?, updated_at=CURRENT_TIMESTAMP WHERE email=?")
      .bind(sellerType, user.email).run();

    // If registering as shop, create shop profile with pending verification
    if (sellerType === "shop") {
      const shopName = clean(body.businessName, 120) || account?.displayName || "Unnamed Shop";
      const businessType = clean(body.businessType, 40) || "general";

      const shopId = `shop_${crypto.randomUUID().slice(0, 12)}`;

      await db.prepare(`
        INSERT INTO shop_profiles (id, account_id, business_name, business_type, created_at)
        VALUES (?, (SELECT id FROM marketplace_accounts WHERE email=?), ?, ?, CURRENT_TIMESTAMP)
      `).bind(shopId, user.email, shopName, businessType).run();

      // Mark verification as pending
      await db.prepare(`
        UPDATE marketplace_accounts
        SET verification_status='pending', verification_submitted_at=CURRENT_TIMESTAMP
        WHERE email=?
      `).bind(user.email).run();
    }

    const updated = await db.prepare("SELECT * FROM marketplace_accounts WHERE email=? LIMIT 1")
      .bind(user.email).first<Record<string, unknown>>();

    return NextResponse.json({
      ok: true,
      sellerType,
      verificationStatus: updated?.verification_status,
      message: sellerType === "shop" ? "Shop registration submitted. Awaiting verification." : "Individual seller status activated"
    }, { status: 201, headers: privateHeaders });
  } catch (error) {
    console.error("seller registration failed", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500, headers: privateHeaders });
  }
}
