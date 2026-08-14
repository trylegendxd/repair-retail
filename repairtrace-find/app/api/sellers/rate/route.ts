import { NextResponse } from "next/server";
import { accountForRequest, isSameOriginMutation, privateHeaders } from "@/lib/account-auth";
import { clean, getD1, uid } from "@/lib/server-marketplace";

export async function POST(request: Request) {
  try {
    if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Blocked" }, { status: 403, headers: privateHeaders });

    const { account, user } = await accountForRequest(request);
    if (!account || account.role !== "customer") {
      return NextResponse.json({ error: "Only customers can rate sellers" }, { status: 403, headers: privateHeaders });
    }

    const body = await request.json() as Record<string, unknown>;
    const sellerId = clean(body.sellerId, 100);
    const offerId = clean(body.offerId, 100);
    const rating = Math.min(5, Math.max(1, Number(body.rating) || 0));
    const comment = clean(body.comment, 500);
    const categories = body.categories as Record<string, number> | undefined;

    if (!sellerId || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid rating data" }, { status: 400, headers: privateHeaders });
    }

    const db = getD1();

    // Verify seller exists
    const seller = await db.prepare("SELECT id FROM marketplace_accounts WHERE id=? AND role='provider' LIMIT 1")
      .bind(sellerId).first<{ id: string }>();

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404, headers: privateHeaders });
    }

    // Check if already rated this offer
    if (offerId) {
      const existing = await db.prepare(
        "SELECT id FROM seller_ratings WHERE customer_account_id=? AND offer_id=?"
      ).bind(account.id, offerId).first<{ id: string }>();

      if (existing) {
        // Update existing rating
        await db.prepare(
          "UPDATE seller_ratings SET rating=?, comment=?, categories=? WHERE id=?"
        ).bind(rating, comment, categories ? JSON.stringify(categories) : null, existing.id).run();
      } else {
        // Create new rating
        const ratingId = uid("rating");
        await db.prepare(`
          INSERT INTO seller_ratings (id, seller_account_id, customer_account_id, offer_id, rating, comment, categories)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(ratingId, sellerId, account.id, offerId, rating, comment, categories ? JSON.stringify(categories) : null).run();
      }
    }

    // Update seller's trust score and repair count
    const stats = await db.prepare(`
      SELECT COUNT(*) as total, AVG(rating) as avg_rating
      FROM seller_ratings WHERE seller_account_id=?
    `).bind(sellerId).first<{ total: number; avg_rating: number }>();

    const trustScore = (stats?.avg_rating || 0) * (Math.min(stats?.total || 0, 50) / 50);

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
