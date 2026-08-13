import { createPublicKey, database, ensureRepairDatabase, getRepair } from "../../../../../lib/server-repairs";
import { ownerIdFromRequest } from "../../../../../lib/server-identity";
import { apiError, assertSameOrigin, privateHeaders } from "../../../../../lib/server-http";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);await ensureRepairDatabase();
    const ownerId = await ownerIdFromRequest(request);
    const { id } = await context.params;
    const current = await getRepair(id, false, ownerId);
    if (!current) return Response.json({ error: "Repair not found." }, { status: 404 });
    const input = await request.json() as Record<string, unknown>;
    const action = String(input.action ?? "");
    const db = database();
    let eventTitle = "Commercial document updated";
    let eventDetail = "";

    if (action === "send_quote") {
      if (current.estimate <= 0) return Response.json({ error: "Set a customer estimate before sending the quote." }, { status: 400 });
      await db.prepare("UPDATE repairs SET quote_status='sent',quote_key=?,quote_sent_at=CURRENT_TIMESTAMP,quote_responded_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?").bind(createPublicKey("quote"),id, ownerId).run();
      eventTitle = "Quote prepared for customer";
      eventDetail = `Customer estimate: €${current.estimate.toFixed(2)}. Secure approval link activated.`;
    } else if (action === "reset_quote") {
      await db.prepare("UPDATE repairs SET quote_status='draft',quote_key=?,quote_sent_at=NULL,quote_responded_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?").bind(createPublicKey("quote"),id, ownerId).run();
      eventTitle = "Quote returned to draft";
      eventDetail = "Customer approval can be requested again after the estimate is reviewed.";
    } else if (["create_invoice", "send_invoice", "mark_paid", "void_invoice"].includes(action)) {
      const taxRate = input.taxRate === undefined ? current.taxRate : Number(input.taxRate);
      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return Response.json({ error: "Tax rate must be between 0% and 100%." }, { status: 400 });
      const invoiceNumber = current.invoiceNumber || `RT-${new Date().getUTCFullYear()}-${current.ticket.replace(/[^A-Za-z0-9]/g, "").slice(-10)}`;
      const total = current.finalCost > 0 ? current.finalCost : current.estimate;
      if (total <= 0) return Response.json({ error: "Set a repair price before creating an invoice draft." }, { status: 400 });
      let invoiceStatus = "draft";
      let amountPaid = current.amountPaid;
      if (action === "send_invoice") invoiceStatus = "sent";
      if (action === "mark_paid") {
        invoiceStatus = "paid";
        amountPaid = input.amountPaid === undefined ? total : Number(input.amountPaid);
        if (!Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > 1_000_000) return Response.json({ error: "Enter a valid paid amount." }, { status: 400 });
      }
      if (action === "void_invoice") invoiceStatus = "void";
      await db.prepare(`UPDATE repairs SET invoice_number=?,invoice_status=?,tax_rate=?,amount_paid=?,
        invoice_issued_at=CASE WHEN ? IN ('sent','paid') THEN COALESCE(invoice_issued_at,CURRENT_TIMESTAMP) ELSE invoice_issued_at END,
        updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?`).bind(invoiceNumber, invoiceStatus, taxRate, amountPaid, invoiceStatus, id, ownerId).run();
      eventTitle = action === "create_invoice" ? "Invoice draft created" : action === "send_invoice" ? "Invoice marked as sent" : action === "mark_paid" ? "Payment recorded" : "Invoice voided";
      eventDetail = action === "mark_paid" ? `€${amountPaid.toFixed(2)} recorded against ${invoiceNumber}.` : `${invoiceNumber} · €${total.toFixed(2)}`;
    } else {
      return Response.json({ error: "Unsupported commercial action." }, { status: 400 });
    }

    await db.prepare("INSERT INTO repair_events (id,repair_id,title,detail) VALUES (?,?,?,?)")
      .bind(crypto.randomUUID(), id, eventTitle, eventDetail).run();
    return Response.json({ repair: await getRepair(id, false, ownerId) },{headers:privateHeaders});
  } catch (error) {
    return apiError(error,"Could not update quote or invoice.");
  }
}
