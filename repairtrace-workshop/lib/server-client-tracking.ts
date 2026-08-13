import { env } from "cloudflare:workers";
import { database, ensureRepairDatabase, getRepair } from "./server-repairs";
import { getShopSettings } from "./server-intelligence";

type Row = Record<string, unknown>;
type Channel = "email" | "sms";

export type NotificationResult = {
  channel: Channel;
  destinationMasked: string;
  status: "sent" | "queued" | "configuration_required" | "skipped" | "invalid" | "failed" | "rate_limited";
  detail: string;
  providerMessageId?: string;
};

function runtimeValue(name: string) {
  const value=(env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" ? value.trim() : "";
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "email not recorded";
  return `${local.slice(0, 1)}***@${domain}`;
}

function maskPhone(phone: string) {
  const digits=phone.replace(/\D/g, "");
  return digits ? `•••• ${digits.slice(-4)}` : "phone not recorded";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character] ?? character));
}

function safeOrigin(value: string) {
  const url=new URL(runtimeValue("REPAIRTRACE_PUBLIC_URL")||value);
  const local=url.hostname==="localhost"||url.hostname==="127.0.0.1"||url.hostname==="terminal.local";
  if (url.protocol !== "https:" && !(local&&url.protocol==="http:")) throw new Error("Invalid tracking link origin.");
  return url.origin;
}

async function providerJson(response: Response) {
  try { return await response.json() as Record<string, unknown>; }
  catch { return {}; }
}

async function sendEmail(input: { to:string; customer:string; device:string; ticket:string; shopName:string; trackingUrl:string }): Promise<NotificationResult> {
  const destinationMasked=maskEmail(input.to);
  if (!input.to) return {channel:"email",destinationMasked,status:"skipped",detail:"No customer email was recorded."};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) return {channel:"email",destinationMasked,status:"invalid",detail:"The customer email address is not valid."};
  const apiKey=runtimeValue("RESEND_API_KEY");
  const from=runtimeValue("REPAIRTRACE_FROM_EMAIL");
  if (!apiKey || !from) return {channel:"email",destinationMasked,status:"configuration_required",detail:"Email delivery needs a Resend API key and verified sender."};
  const firstName=input.customer.trim().split(/\s+/)[0] || "there";
  const subject=`Track your ${input.device} repair · ${input.ticket}`;
  const text=`Hi ${firstName},\n\nThank you for choosing ${input.shopName}. You can check the current state of your ${input.device} repair at any time:\n${input.trackingUrl}\n\nRepair reference: ${input.ticket}\nThis private service link is for repair updates, not marketing.`;
  const html=`<div style="font-family:Arial,sans-serif;color:#18231f;line-height:1.6"><p>Hi ${escapeHtml(firstName)},</p><p>Thank you for choosing <strong>${escapeHtml(input.shopName)}</strong>. You can check the current state of your <strong>${escapeHtml(input.device)}</strong> repair at any time.</p><p><a href="${escapeHtml(input.trackingUrl)}" style="display:inline-block;padding:12px 18px;border-radius:9px;background:#1b9a68;color:#fff;text-decoration:none;font-weight:700">Check repair status</a></p><p style="color:#748078;font-size:13px">Repair reference: ${escapeHtml(input.ticket)}<br>This private service link is for repair updates, not marketing.</p></div>`;
  try {
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:`Bearer ${apiKey}`,"content-type":"application/json"},body:JSON.stringify({from,to:[input.to],subject,text,html}),signal:AbortSignal.timeout(12000)});
    const payload=await providerJson(response);
    if (!response.ok) return {channel:"email",destinationMasked,status:"failed",detail:`Email provider rejected the request (${response.status}).`};
    return {channel:"email",destinationMasked,status:"sent",detail:"Tracking email accepted for delivery.",providerMessageId:String(payload.id??"")};
  } catch {
    return {channel:"email",destinationMasked,status:"failed",detail:"Email delivery could not be reached."};
  }
}

async function sendSms(input: { to:string; device:string; ticket:string; shopName:string; trackingUrl:string }): Promise<NotificationResult> {
  const destinationMasked=maskPhone(input.to);
  if (!input.to) return {channel:"sms",destinationMasked,status:"skipped",detail:"No customer phone number was recorded."};
  const compact=input.to.replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(compact)) return {channel:"sms",destinationMasked,status:"invalid",detail:"Use an international phone number such as +351…"};
  const accountSid=runtimeValue("TWILIO_ACCOUNT_SID");
  const authToken=runtimeValue("TWILIO_AUTH_TOKEN");
  const messagingServiceSid=runtimeValue("TWILIO_MESSAGING_SERVICE_SID");
  const fromNumber=runtimeValue("TWILIO_FROM_NUMBER");
  if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) return {channel:"sms",destinationMasked,status:"configuration_required",detail:"SMS delivery needs Twilio credentials and a sender."};
  const body=`Thank you for choosing ${input.shopName}. Track your ${input.device} repair: ${input.trackingUrl} Ref ${input.ticket}`;
  const form=new URLSearchParams({To:compact,Body:body,ContentRetention:"discard",AddressRetention:"obfuscate"});
  if (messagingServiceSid) form.set("MessagingServiceSid",messagingServiceSid); else form.set("From",fromNumber);
  try {
    const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,{method:"POST",headers:{authorization:`Basic ${btoa(`${accountSid}:${authToken}`)}`,"content-type":"application/x-www-form-urlencoded;charset=UTF-8"},body:form.toString(),signal:AbortSignal.timeout(12000)});
    const payload=await providerJson(response);
    if (!response.ok) return {channel:"sms",destinationMasked,status:"failed",detail:`SMS provider rejected the request (${response.status}).`};
    const providerStatus=String(payload.status??"queued");
    return {channel:"sms",destinationMasked,status:providerStatus === "sent" || providerStatus === "delivered" ? "sent" : "queued",detail:"Tracking SMS accepted for delivery.",providerMessageId:String(payload.sid??"")};
  } catch {
    return {channel:"sms",destinationMasked,status:"failed",detail:"SMS delivery could not be reached."};
  }
}

export function deliveryConfiguration() {
  return {
    emailConfigured:Boolean(runtimeValue("RESEND_API_KEY") && runtimeValue("REPAIRTRACE_FROM_EMAIL")),
    smsConfigured:Boolean(runtimeValue("TWILIO_ACCOUNT_SID") && runtimeValue("TWILIO_AUTH_TOKEN") && (runtimeValue("TWILIO_MESSAGING_SERVICE_SID") || runtimeValue("TWILIO_FROM_NUMBER"))),
  };
}

export async function sendTrackingLink(ownerId: string, repairId: string, origin: string) {
  await ensureRepairDatabase();
  const repair=await getRepair(repairId,false,ownerId);
  if (!repair) throw new Error("Repair not found");
  if (!repair.trackingPath) throw new Error("Tracking link is unavailable.");
  const settings=await getShopSettings(ownerId);
  const trackingUrl=`${safeOrigin(origin)}${repair.trackingPath}`;
  const recent=await database().prepare("SELECT channel FROM repair_notifications WHERE repair_id=? AND status IN ('sent','queued','failed') AND datetime(created_at)>datetime('now','-60 seconds')").bind(repairId).all<Row>();
  const recentlySent=new Set(recent.results.map((row)=>String(row.channel)));
  const emailPromise=recentlySent.has("email") ? Promise.resolve<NotificationResult>({channel:"email",destinationMasked:maskEmail(repair.customerEmail),status:"rate_limited",detail:"Email was already sent in the last minute."}) : sendEmail({to:repair.customerEmail,customer:repair.customer,device:repair.device,ticket:repair.ticket,shopName:settings.shopName,trackingUrl});
  const smsPromise=recentlySent.has("sms") ? Promise.resolve<NotificationResult>({channel:"sms",destinationMasked:maskPhone(repair.customerPhone),status:"rate_limited",detail:"SMS was already sent in the last minute."}) : sendSms({to:repair.customerPhone,device:repair.device,ticket:repair.ticket,shopName:settings.shopName,trackingUrl});
  const results=await Promise.all([emailPromise,smsPromise]);
  const statements=results.filter((item)=>item.status!=="rate_limited").map((item)=>database().prepare("INSERT INTO repair_notifications (id,repair_id,channel,destination_masked,status,provider_message_id,detail) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),repairId,item.channel,item.destinationMasked,item.status,item.providerMessageId??"",item.detail));
  if (statements.length) await database().batch(statements);
  return {trackingUrl,results,configuration:deliveryConfiguration()};
}

export async function getPublicTracking(trackingKey: string) {
  await ensureRepairDatabase();
  if (!/^track_[A-Za-z0-9_-]{24,}$/.test(trackingKey)) return null;
  const db=database();
  const row=await db.prepare(`SELECT r.id,r.ticket,r.customer_name,r.device,r.status,r.due,r.client_update,r.client_updated_at,
    r.created_at,r.updated_at,r.published,r.warranty_days,r.certificate_key,s.shop_name
    FROM repairs r LEFT JOIN shop_settings s ON s.owner_id=r.owner_id WHERE r.tracking_key=?`).bind(trackingKey).first<Row>();
  if (!row) return null;
  const updates=await db.prepare("SELECT id,status,message,created_at FROM repair_client_updates WHERE repair_id=? ORDER BY datetime(created_at) DESC LIMIT 40").bind(String(row.id)).all<Row>();
  return {
    shopName:String(row.shop_name??"Repair workshop"),
    ticket:String(row.ticket),
    customerFirstName:String(row.customer_name??"").trim().split(/\s+/)[0]||"Customer",
    device:String(row.device),
    status:String(row.status),
    due:String(row.due??""),
    currentUpdate:String(row.client_update??"Your repair record is active."),
    clientUpdatedAt:String(row.client_updated_at??row.updated_at),
    createdAt:String(row.created_at),
    warrantyDays:Number(row.warranty_days??90),
    certificatePath:Boolean(row.published)&&row.certificate_key?`/c/${String(row.certificate_key)}`:null,
    updates:updates.results.map((update)=>({id:String(update.id),status:String(update.status),message:String(update.message),createdAt:String(update.created_at)})),
  };
}
