import { NextResponse } from "next/server";
import { accountForRequest, isSameOriginMutation, privateHeaders } from "@/lib/account-auth";
import { clean, getD1 } from "@/lib/server-marketplace";

const ADMIN_EMAILS = ["admin@repairtrace.com", process.env.ADMIN_EMAIL || ""].filter(Boolean);

function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Blocked" }, { status: 403, headers: privateHeaders });

    const { account } = await accountForRequest(request);
    if (!account || !isAdmin(account.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403, headers: privateHeaders });
    }

    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 20);
    const rejectionReason = action === "reject" ? clean(body.reason, 500) : "";

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400, headers: privateHeaders });
    }

    if (action === "reject" && !rejectionReason) {
      return NextResponse.json({ error: "Rejection reason required" }, { status: 400, headers: privateHeaders });
    }

    const db = getD1();

    // Get the document and its account
    const doc = await db.prepare(`
      SELECT d.id, d.account_id, d.status, a.seller_type
      FROM seller_verification_docs d
      JOIN marketplace_accounts a ON a.id = d.account_id
      WHERE d.id = ? LIMIT 1
    `).bind(id).first<{ id: string; account_id: string; status: string; seller_type: string }>();

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404, headers: privateHeaders });
    }

    if (doc.seller_type !== "shop") {
      return NextResponse.json({ error: "Only shop documents can be verified" }, { status: 400, headers: privateHeaders });
    }

    const accountId = doc.account_id;

    if (action === "approve") {
      // Update document status
      await db.prepare(`
        UPDATE seller_verification_docs
        SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(id).run();

      // Check if all documents for this account are now approved
      const pendingDocs = await db.prepare(`
        SELECT COUNT(*) as count FROM seller_verification_docs
        WHERE account_id = ? AND status != 'approved'
      `).bind(accountId).first<{ count: number }>();

      if (pendingDocs && pendingDocs.count === 0) {
        // All documents approved - verify the account
        await db.prepare(`
          UPDATE marketplace_accounts
          SET is_verified = 1, verification_status = 'approved', verification_approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(accountId).run();
      }
    } else {
      // Reject
      await db.prepare(`
        UPDATE seller_verification_docs
        SET status = 'rejected', rejection_reason = ?, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(rejectionReason, id).run();

      // Mark account as rejected
      await db.prepare(`
        UPDATE marketplace_accounts
        SET verification_status = 'rejected', rejection_reason = ?, is_verified = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(rejectionReason, accountId).run();
    }

    const result = await db.prepare(`
      SELECT id, status FROM seller_verification_docs WHERE id = ? LIMIT 1
    `).bind(id).first<{ id: string; status: string }>();

    return NextResponse.json({
      ok: true,
      documentId: result?.id,
      status: result?.status,
      message: action === "approve" ? "Document approved" : "Document rejected"
    }, { status: 200, headers: privateHeaders });
  } catch (error) {
    console.error("admin verification action failed", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500, headers: privateHeaders });
  }
}
