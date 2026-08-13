import { NextResponse } from "next/server";
import { clean, ensureMarketplace, getD1, uid } from "@/lib/server-marketplace";
import { getIssue, getModel, repairIssues } from "@/lib/repair-catalog";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+()\d\s.-]{7,24}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (clean(body.website, 20)) return NextResponse.json({ ok: true });

    const shopId = clean(body.shopId, 80);
    const customerName = clean(body.customerName, 80);
    const contactType = body.contactType === "phone" ? "phone" : "email";
    const rawContact = clean(body.contactValue, 160);
    const consent = body.consent === true;
    const modelKey = clean(body.modelKey, 80);
    const category = clean(body.category, 30) || "Phone";
    const model = getModel(modelKey, clean(body.modelLabel, 100), category);
    const requestedIssueKey=clean(body.issueKey,60);
    if(!repairIssues.some(item=>item.key===requestedIssueKey&&item.categories.includes(model.category)))return NextResponse.json({error:"That repair request is not supported."},{status:400});
    const issue = getIssue(requestedIssueKey, model.category);
    const contactValue=contactType==="email"?rawContact.toLowerCase():rawContact.replace(/\s+/g," ");
    const validContact = contactType === "email" ? emailPattern.test(contactValue) : phonePattern.test(contactValue);
    if (!shopId || !customerName || !validContact || !consent) {
      return NextResponse.json({ error: "Add your name, a valid contact and permission to share it with the shop." }, { status: 400 });
    }

    await ensureMarketplace();
    const db = getD1();
    const shop = await db.prepare(`SELECT s.id,s.name,v.currency FROM partner_shops s JOIN shop_services v ON v.shop_id=s.id
      WHERE s.id=? AND s.marketplace_enabled=1 AND v.issue_key=? AND (
        v.model_key=? OR (v.model_key='' AND v.brand<>'' AND v.brand=?) OR (v.model_key='' AND v.brand='' AND v.category=?)
      ) LIMIT 1`).bind(shopId,issue.key,model.key,model.brand,model.category).first<{id:string;name:string;currency:string}>();
    if (!shop) return NextResponse.json({ error: "This shop is not accepting requests right now." }, { status: 404 });
    const recent=await db.prepare("SELECT COUNT(*) count FROM quote_requests WHERE shop_id=? AND contact_value=? AND datetime(created_at)>datetime('now','-10 minutes')").bind(shopId,contactValue).first<{count:number}>();
    if(Number(recent?.count??0)>=3)return NextResponse.json({error:"You have already sent several requests to this shop. Please wait a few minutes."},{status:429});
    const recentOverall=await db.prepare("SELECT COUNT(*) count FROM quote_requests WHERE contact_value=? AND datetime(created_at)>datetime('now','-10 minutes')").bind(contactValue).first<{count:number}>();
    if(Number(recentOverall?.count??0)>=6)return NextResponse.json({error:"You have sent several requests recently. Please wait a few minutes."},{status:429});

    const id = uid("request");
    const publicToken = uid("track");
    await db.prepare("INSERT INTO quote_requests (id,public_token,shop_id,status,device_category,brand,model_key,model_label,issue_key,issue_detail,city,customer_name,contact_type,contact_value,message,currency,consent) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id, publicToken, shopId, "new", model.category, model.brand, model.key, model.label, issue.key, clean(body.issueDetail, 600), clean(body.city, 100), customerName, contactType, contactValue, clean(body.message, 900), shop.currency, 1).run();

    return NextResponse.json({ ok: true, token: publicToken, shopName: shop.name, trackingPath: `/request/${publicToken}` }, { status: 201,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"} });
  } catch (error) {
    console.error("quote request failed", error);
    return NextResponse.json({ error: error instanceof SyntaxError?"The request was not valid JSON.":"Your message could not be sent. Please try again." }, { status: error instanceof SyntaxError?400:500 });
  }
}
