import { NextResponse } from "next/server";
import { accountForRequest, isSameOriginMutation, privateHeaders } from "@/lib/account-auth";
import { clean, getD1, uid } from "@/lib/server-marketplace";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Blocked" }, { status: 403, headers: privateHeaders });
    const declaredLength=Number(request.headers.get("content-length")||0);
    if(declaredLength>20_000)return NextResponse.json({error:"Rating information is too large"},{status:413,headers:privateHeaders});

    const { account } = await accountForRequest(request);
    if (!account || account.role !== "customer") {
      return NextResponse.json({ error: "Only customers can rate sellers" }, { status: 403, headers: privateHeaders });
    }
    const rate=await checkRateLimit(`seller-rating:${account.id}`,20,3600);
    if(!rate.allowed)return NextResponse.json({error:"Too many rating updates. Please try again later."},{status:429,headers:privateHeaders});

    const rawBody=await request.text();
    if(new TextEncoder().encode(rawBody).byteLength>20_000)return NextResponse.json({error:"Rating information is too large"},{status:413,headers:privateHeaders});
    let body:Record<string,unknown>;
    try{body=JSON.parse(rawBody) as Record<string,unknown>;}catch{return NextResponse.json({error:"Rating information is not valid JSON"},{status:400,headers:privateHeaders});}
    const sellerId = clean(body.sellerId, 100);
    const offerId = clean(body.offerId, 100);
    const rating = Number(body.rating);
    const comment = clean(body.comment, 500);
    const categories = normalizeCategories(body.categories);

    if (!sellerId || !offerId || !Number.isInteger(rating) || rating < 1 || rating > 5 || categories===null) {
      return NextResponse.json({ error: "Invalid rating data" }, { status: 400, headers: privateHeaders });
    }

    const db = getD1();

    const eligibleOffer=await db.prepare(`
      SELECT o.id FROM repair_offers o
      JOIN repair_announcements p ON p.id=o.announcement_id
      WHERE o.id=? AND o.provider_account_id=? AND p.owner_account_id=? AND o.status='accepted'
      LIMIT 1
    `).bind(offerId,sellerId,account.id).first<{id:string}>();
    if(!eligibleOffer)return NextResponse.json({error:"Only an accepted offer for your own repair can be rated"},{status:403,headers:privateHeaders});

    const ratingId=uid("rating");
    await db.prepare(`
      INSERT INTO seller_ratings (id,seller_account_id,customer_account_id,offer_id,rating,comment,categories)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(customer_account_id,offer_id) DO UPDATE SET
        seller_account_id=excluded.seller_account_id,
        rating=excluded.rating,
        comment=excluded.comment,
        categories=excluded.categories
    `).bind(ratingId,sellerId,account.id,offerId,rating,comment,categories?JSON.stringify(categories):null).run();
    const savedRating=await db.prepare("SELECT id FROM seller_ratings WHERE customer_account_id=? AND offer_id=? LIMIT 1").bind(account.id,offerId).first<{id:string}>();
    if(savedRating)await db.prepare("UPDATE repair_offers SET customer_rating_id=? WHERE id=?").bind(savedRating.id,offerId).run();

    // Update seller's trust score and repair count
    const stats = await db.prepare(`
      SELECT COUNT(*) as total, AVG(rating) as avg_rating
      FROM seller_ratings WHERE seller_account_id=?
    `).bind(sellerId).first<{ total: number; avg_rating: number }>();

    const trustScore = (stats?.avg_rating || 0) * Math.min(1,(stats?.total || 0)/10);

    await db.prepare(
      "UPDATE marketplace_accounts SET trust_score=?, updated_at=CURRENT_TIMESTAMP WHERE id=?"
    ).bind(trustScore, sellerId).run();

    return NextResponse.json({
      ok: true,
      message: "Rating submitted. Thank you!",
      trustScore
    }, { status: 201, headers: privateHeaders });
  } catch (error) {
    console.error("rating failed", error);
    return NextResponse.json({ error: "Rating failed" }, { status: 500, headers: privateHeaders });
  }
}

function normalizeCategories(value:unknown):Record<string,number>|null|undefined{
  if(value===undefined||value===null)return undefined;
  if(typeof value!=="object"||Array.isArray(value))return null;
  const allowed=new Set(["communication","quality","speed","value"]);
  const output:Record<string,number>={};
  for(const [key,raw] of Object.entries(value as Record<string,unknown>)){
    const score=Number(raw);
    if(!allowed.has(key)||!Number.isInteger(score)||score<1||score>5)return null;
    output[key]=score;
  }
  return output;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sellerId = clean(url.searchParams.get("sellerId"), 100);

    if (!sellerId) {
      return NextResponse.json({ error: "Seller ID required" }, { status: 400, headers: privateHeaders });
    }

    const db = getD1();
    const ratings = await db.prepare(
      `SELECT rating, comment, categories, created_at FROM seller_ratings
       WHERE seller_account_id=? ORDER BY created_at DESC LIMIT 50`
    ).bind(sellerId).all<Record<string, unknown>>();

    const stats = await db.prepare(`
      SELECT COUNT(*) as total, AVG(rating) as avg_rating, MIN(rating) as min, MAX(rating) as max
      FROM seller_ratings WHERE seller_account_id=?
    `).bind(sellerId).first<Record<string, unknown>>();

    return NextResponse.json({
      ratings: ratings.results || [],
      stats: {
        total: stats?.total || 0,
        averageRating: stats?.avg_rating || 0,
        minRating: stats?.min || 0,
        maxRating: stats?.max || 0
      }
    }, { headers: privateHeaders });
  } catch (error) {
    console.error("ratings fetch failed", error);
    return NextResponse.json({ error: "Failed to load ratings" }, { status: 500, headers: privateHeaders });
  }
}
