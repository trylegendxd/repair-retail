import { NextResponse } from "next/server";
import { accountForRequest, isSameOriginMutation, privateHeaders } from "@/lib/account-auth";
import { clean, getD1, uid } from "@/lib/server-marketplace";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    if (!isSameOriginMutation(request)) return NextResponse.json({ error: "This request was blocked for your protection." }, { status: 403, headers: privateHeaders });
    const declaredLength=Number(request.headers.get("content-length")||0);
    if(declaredLength>20_000)return NextResponse.json({error:"Seller information is too large."},{status:413,headers:privateHeaders});
    const { account } = await accountForRequest(request);
    if (!account) return NextResponse.json({ error: "Sign in and finish provider registration first." }, { status: 401, headers: privateHeaders });
    if(account.role!=="provider")return NextResponse.json({error:"Only provider accounts can register as sellers."},{status:403,headers:privateHeaders});
    const rate=await checkRateLimit(`seller-profile:${account.id}`,10,3600);
    if(!rate.allowed)return NextResponse.json({error:"Too many seller profile updates. Please try again later."},{status:429,headers:privateHeaders});

    const body = await request.json() as Record<string, unknown>;
    const sellerType = clean(body.sellerType, 20);

    // Validate seller type
    if (!["individual_seller", "shop"].includes(sellerType)) {
      return NextResponse.json({ error: "Invalid seller type" }, { status: 400, headers: privateHeaders });
    }

    const db = getD1();

    // Update account with seller type
    await db.prepare("UPDATE marketplace_accounts SET seller_type=?,is_verified=CASE WHEN ?='shop' THEN is_verified ELSE 0 END,verification_status=CASE WHEN ?='shop' THEN verification_status ELSE 'none' END,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(sellerType,sellerType,sellerType,account.id).run();

    // If registering as shop, create shop profile with pending verification
    if (sellerType === "shop") {
      const shopName = clean(body.businessName, 120) || account?.displayName || "Unnamed Shop";
      const businessType = clean(body.businessType, 40) || "general";
      const allowedBusinessTypes=["electronics_repair","phone_repair","computer_repair","electronics_parts","goods_services","general","other"];
      if(!allowedBusinessTypes.includes(businessType))return NextResponse.json({error:"Invalid business type"},{status:400,headers:privateHeaders});

      await db.prepare(`
        INSERT INTO shop_profiles (id, account_id, business_name, business_type, service_area_radius_km)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
          business_name=excluded.business_name,
          business_type=excluded.business_type,
          service_area_radius_km=excluded.service_area_radius_km,
          updated_at=CURRENT_TIMESTAMP
      `).bind(uid("shop"),account.id,shopName,businessType,account.serviceRadiusKm).run();
    }

    const updated = await db.prepare("SELECT verification_status FROM marketplace_accounts WHERE id=? LIMIT 1")
      .bind(account.id).first<{verification_status:string}>();

    return NextResponse.json({
      ok: true,
      sellerType,
      verificationStatus: updated?.verification_status,
      message: sellerType === "shop" ? "Shop profile saved. Upload verification documents when ready." : "Individual seller status activated"
    }, { status: 201, headers: privateHeaders });
  } catch (error) {
    console.error("seller registration failed", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500, headers: privateHeaders });
  }
}
