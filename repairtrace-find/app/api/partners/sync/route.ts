import { NextResponse } from "next/server";
import { clean, ensureMarketplace, getD1, getPartnerKey, uid } from "@/lib/server-marketplace";
import { countries, deviceCategories, repairIssues } from "@/lib/repair-catalog";

const encoder=new TextEncoder();
const maxClockSkewSeconds=300;

function hex(buffer:ArrayBuffer){return [...new Uint8Array(buffer)].map(value=>value.toString(16).padStart(2,"0")).join("");}
function constantTimeEqual(expected:string,supplied:string){
  if(expected.length!==supplied.length)return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  return mismatch === 0;
}

async function authorized(request:Request,body:string){
  const secret=getPartnerKey();const timestamp=request.headers.get("x-repairtrace-timestamp")??"";const supplied=request.headers.get("x-repairtrace-signature")??"";
  if(secret.length<32||!/^[0-9]{10}$/.test(timestamp)||!/^[a-f0-9]{64}$/i.test(supplied))return false;
  if(Math.abs(Math.floor(Date.now()/1000)-Number(timestamp))>maxClockSkewSeconds)return false;
  const url=new URL(request.url);const canonical=`${timestamp}\n${request.method.toUpperCase()}\n${url.pathname}${url.search}\n${body}`;
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return constantTimeEqual(hex(await crypto.subtle.sign("HMAC",key,encoder.encode(canonical))),supplied.toLowerCase());
}

function denied() {
  return NextResponse.json({ error: "Partner authentication failed." }, { status: 401,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"} });
}

export async function PUT(request: Request) {
  try {
    const rawBody=await request.text();
    if(rawBody.length>1_000_000)return NextResponse.json({error:"Partner payload is too large."},{status:413});
    if (!await authorized(request,rawBody)) return denied();
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const externalId = clean(body.externalId, 100);
    const name = clean(body.name, 100);
    const city = clean(body.city, 100);
    const services = Array.isArray(body.services) ? body.services.slice(0, 200) as Record<string, unknown>[] : [];
    const hasSamples = Array.isArray(body.samples);
    const samples = hasSamples ? (body.samples as Record<string, unknown>[]).slice(0, 1000) : [];
    const countryCode=clean(body.countryCode,2).toUpperCase()||"PT";
    const country=countries.find(item=>item.code===countryCode);
    const latitude=body.latitude===null||body.latitude===undefined?null:Number(body.latitude);
    const longitude=body.longitude===null||body.longitude===undefined?null:Number(body.longitude);
    if (!externalId || !name || !city) return NextResponse.json({ error: "externalId, name and city are required." }, { status: 400 });
    if(!country)return NextResponse.json({error:"Unsupported marketplace country."},{status:400});
    if((latitude===null)!==(longitude===null)||(latitude!==null&&longitude!==null&&(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<-90||latitude>90||longitude<-180||longitude>180)))return NextResponse.json({error:"Latitude and longitude must be supplied together and be valid."},{status:400});

    await ensureMarketplace();
    const db = getD1();
    const existing = await db.prepare("SELECT id FROM partner_shops WHERE external_id=? LIMIT 1").bind(externalId).first<{id:string}>();
    const shopId = existing?.id ?? uid("shop");
    await db.prepare("INSERT INTO partner_shops (id,external_id,name,city,region,country_code,address_label,latitude,longitude,service_radius_km,contact_mode,verified,marketplace_enabled) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(external_id) DO UPDATE SET name=excluded.name,city=excluded.city,region=excluded.region,country_code=excluded.country_code,address_label=excluded.address_label,latitude=excluded.latitude,longitude=excluded.longitude,service_radius_km=excluded.service_radius_km,contact_mode=excluded.contact_mode,marketplace_enabled=excluded.marketplace_enabled,updated_at=CURRENT_TIMESTAMP")
      .bind(shopId, externalId, name, city, clean(body.region, 100), countryCode, clean(body.addressLabel, 180), latitude, longitude, Math.min(250, Math.max(1, Number(body.serviceRadiusKm) || 50)), "in_app", 0, body.marketplaceEnabled === true ? 1 : 0).run();

    const statements = [db.prepare("DELETE FROM shop_services WHERE shop_id=?").bind(shopId)];
    let servicesPublished=0;
    let anonymousSamplesReceived=0;
    const serviceKeys=new Set<string>();
    for (const service of services) {
      const priceLow = Number(service.priceLow);
      const priceHigh = Number(service.priceHigh);
      const category = clean(service.category, 30);
      const issueKey = clean(service.issueKey, 60);
      const currency=clean(service.currency,3).toUpperCase();const modelKey=clean(service.modelKey,80);const dedupeKey=`${modelKey}:${issueKey}`;
      if (!deviceCategories.includes(category as typeof deviceCategories[number]) || !repairIssues.some(issue=>issue.key===issueKey&&issue.categories.includes(category)) || currency!==country.currency || !Number.isFinite(priceLow) || !Number.isFinite(priceHigh) || priceLow < 0 || priceHigh < priceLow || priceHigh>1_000_000 || serviceKeys.has(dedupeKey)) continue;
      serviceKeys.add(dedupeKey);
      statements.push(db.prepare("INSERT INTO shop_services (id,shop_id,category,brand,model_key,model_label,issue_key,issue_label,price_low,price_high,currency,turnaround_days,sample_size) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(uid("service"), shopId, category, clean(service.brand, 60), modelKey, clean(service.modelLabel, 100), issueKey, clean(service.issueLabel, 100) || issueKey, priceLow, priceHigh, currency, Math.min(60, Math.max(1, Number(service.turnaroundDays) || 3)), Math.min(10000,Math.max(0, Math.floor(Number(service.sampleSize) || 0)))));
      servicesPublished+=1;
    }
    if(hasSamples){
      statements.push(db.prepare("DELETE FROM market_price_samples WHERE contributor_key=?").bind(externalId));
      for(const sample of samples){const totalPrice=Number(sample.totalPrice);const modelKey=clean(sample.modelKey,80);const issueKey=clean(sample.issueKey,60);const sampleCountryCode=clean(sample.countryCode,2).toUpperCase();const sampleCountry=countries.find(item=>item.code===sampleCountryCode);const sampleCategory=clean(sample.category,30)||"Other";const observedAt=clean(sample.observedAt,40);const observedTime=new Date(observedAt).valueOf();if(!modelKey||!sampleCountry||!deviceCategories.includes(sampleCategory as typeof deviceCategories[number])||!repairIssues.some(issue=>issue.key===issueKey&&issue.categories.includes(sampleCategory))||clean(sample.currency,3).toUpperCase()!==sampleCountry.currency||!Number.isFinite(totalPrice)||totalPrice<=0||totalPrice>1_000_000||!Number.isFinite(observedTime)||observedTime>Date.now()+86_400_000)continue;const partsCost=sample.partsCost===null||sample.partsCost===undefined?null:Number(sample.partsCost);const laborCost=sample.laborCost===null||sample.laborCost===undefined?null:Number(sample.laborCost);statements.push(db.prepare("INSERT INTO market_price_samples (id,contributor_key,model_key,category,issue_key,country_code,region,total_price,parts_cost,labor_cost,currency,source_type,observed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(uid("sample"),externalId,modelKey,sampleCategory,issueKey,sampleCountryCode,clean(sample.region,100),totalPrice,partsCost!==null&&Number.isFinite(partsCost)&&partsCost>=0&&partsCost<=totalPrice?partsCost:null,laborCost!==null&&Number.isFinite(laborCost)&&laborCost>=0&&laborCost<=totalPrice?laborCost:null,sampleCountry.currency,"partner_anonymous",new Date(observedTime).toISOString()));anonymousSamplesReceived+=1;}
    }
    await db.batch(statements);
    return NextResponse.json({ ok: true, shopId, servicesPublished, anonymousSamplesReceived },{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
  } catch (error) {
    console.error("partner sync failed", error);
    return NextResponse.json({ error: error instanceof SyntaxError?"Partner payload is not valid JSON.":"Partner data could not be synchronized." }, { status: error instanceof SyntaxError?400:500 });
  }
}

export async function GET(request: Request) {
  if (!await authorized(request,"")) return denied();
  try {
    await ensureMarketplace();
    const externalId = clean(new URL(request.url).searchParams.get("externalId"), 100);
    const shop = await getD1().prepare("SELECT id FROM partner_shops WHERE external_id=? LIMIT 1").bind(externalId).first<{id:string}>();
    if (!shop) return NextResponse.json({ requests: [] },{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
    const result = await getD1().prepare("SELECT id,status,model_label,issue_key,issue_detail,city,customer_name,contact_type,contact_value,message,shop_reply,shop_price,currency,created_at,updated_at FROM quote_requests WHERE shop_id=? ORDER BY created_at DESC LIMIT 100").bind(shop.id).all();
    return NextResponse.json({ requests: result.results ?? [] },{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
  } catch (error) {
    console.error("partner inbox failed", error);
    return NextResponse.json({ error: "Partner requests could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const rawBody=await request.text();
    if(rawBody.length>20_000)return NextResponse.json({error:"Partner reply is too large."},{status:413});
    if (!await authorized(request,rawBody)) return denied();
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const requestId = clean(body.requestId, 100);
    const externalId = clean(body.externalId, 100);
    const allowedStatuses = new Set(["new", "viewed", "quoted", "accepted", "declined", "closed"]);
    const status = clean(body.status, 20);
    if (!requestId || !externalId || !allowedStatuses.has(status)) return NextResponse.json({ error: "Valid requestId, externalId and status are required." }, { status: 400 });
    await ensureMarketplace();
    const shop = await getD1().prepare("SELECT id FROM partner_shops WHERE external_id=? LIMIT 1").bind(externalId).first<{id:string}>();
    if (!shop) return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    const current=await getD1().prepare("SELECT status FROM quote_requests WHERE id=? AND shop_id=? LIMIT 1").bind(requestId,shop.id).first<{status:string}>();
    if(!current)return NextResponse.json({error:"Request not found."},{status:404});
    const transitions:Record<string,Set<string>>={new:new Set(["viewed","quoted","declined","closed"]),viewed:new Set(["quoted","declined","closed"]),quoted:new Set(["accepted","declined","closed"]),accepted:new Set(["closed"]),declined:new Set(["closed"]),closed:new Set()};
    if(status!==current.status&&!transitions[current.status]?.has(status))return NextResponse.json({error:`A ${current.status} request cannot move to ${status}.`},{status:409});
    const price = body.shopPrice === null || body.shopPrice === "" || body.shopPrice === undefined ? null : Number(body.shopPrice);
    if (price !== null && (!Number.isFinite(price) || price < 0 || price>1_000_000)) return NextResponse.json({ error: "Invalid price." }, { status: 400 });
    const result = await getD1().prepare("UPDATE quote_requests SET status=?,shop_reply=?,shop_price=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND shop_id=?")
      .bind(status, clean(body.shopReply, 1200), price, requestId, shop.id).run();
    if (!result.meta.changes) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    return NextResponse.json({ ok: true },{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
  } catch (error) {
    console.error("partner reply failed", error);
    return NextResponse.json({ error: error instanceof SyntaxError?"Partner reply is not valid JSON.":"The response could not be saved." }, { status: error instanceof SyntaxError?400:500 });
  }
}
