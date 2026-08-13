import { env } from "cloudflare:workers";
import { detectRepairFaults, normalized } from "./repair-ai";
import { database, ensureRepairDatabase } from "./server-repairs";
import { getShopSettings } from "./server-intelligence";

type Row=Record<string,unknown>;
type PartnerInbox={requests?:Row[];error?:string};
export type MarketplaceSync={status:"connected"|"disabled"|"configuration_required"|"location_required"|"failed";servicesPublished:number;message:string};
const encoder=new TextEncoder();

function runtimeValue(name:string){const value=(env as unknown as Record<string,unknown>)[name];return typeof value==="string"?value.trim():"";}
function marketplaceConfig(){
  const key=runtimeValue("REPAIRTRACE_FIND_SYNC_KEY");const raw=runtimeValue("REPAIRTRACE_FIND_URL").replace(/\/+$/,"");
  if(key.length<32||!raw)return null;
  try{const url=new URL(raw);if(url.protocol!=="https:"&&url.hostname!=="localhost")return null;return {url:url.origin,key};}catch{return null;}
}
function round(value:number){return Math.round(value*100)/100;}
function percentile(values:number[],fraction:number){const sorted=[...values].sort((a,b)=>a-b);if(!sorted.length)return 0;const index=(sorted.length-1)*fraction;const low=Math.floor(index),high=Math.ceil(index);return round(sorted[low]+(sorted[high]-sorted[low])*(index-low));}
function safeModel(value:string){return value.replace(/\b(?:imei|serial|s\/?n)\s*[:#-]?\s*[a-z0-9-]{5,}\b/gi,"").replace(/\b[a-f0-9]{12,}\b/gi,"").replace(/\b\d{10,}\b/g,"").replace(/\s+/g," ").trim().slice(0,100)||"Other device";}
function slug(value:string){return normalized(value).replace(/\+/g,"plus").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||"other";}
function brandFor(model:string){if(/iphone|ipad|macbook/i.test(model))return"Apple";if(/galaxy|samsung/i.test(model))return"Samsung";if(/pixel/i.test(model))return"Google";if(/switch/i.test(model))return"Nintendo";if(/playstation|sony/i.test(model))return"Sony";if(/surface/i.test(model))return"Microsoft";if(/xbox/i.test(model))return"Microsoft";return model.trim().split(/\s+/)[0]?.slice(0,60)??"";}
function issueKey(value:string){const key=value.split("|")[0];if(key==="charge-port")return"charging";if(key==="cooling")return"fan";return key||"diagnostic";}
function issueLabel(key:string){return ({screen:"Screen repair",battery:"Battery replacement",charging:"Charging repair","back-glass":"Rear glass / housing",camera:"Camera repair",liquid:"Liquid damage",fan:"Cooling repair",hinge:"Hinge / frame",keyboard:"Keyboard repair",speaker:"Speaker / audio",microphone:"Microphone",joystick:"Controller joystick",storage:"Storage",power:"Power / board",buttons:"Buttons",connectivity:"Wi-Fi / Bluetooth",diagnostic:"Diagnosis"} as Record<string,string>)[key]??"Device repair";}

async function externalId(ownerId:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`repairtrace-marketplace:${ownerId}`));return `rt_${Array.from(new Uint8Array(bytes)).slice(0,18).map((byte)=>byte.toString(16).padStart(2,"0")).join("")}`;}

async function publishedServices(ownerId:string){
  await ensureRepairDatabase();
  const rows=await database().prepare(`SELECT r.device,r.category,r.issue,r.final_cost,r.estimate,r.created_at,r.completed_at,e.recognized_model,e.fault_key,e.fault_label,e.faults_json
    FROM repairs r LEFT JOIN repair_ai_estimates e ON e.repair_id=r.id
    WHERE r.owner_id=? AND r.status='Completed' AND COALESCE(NULLIF(r.final_cost,0),r.estimate)>0 AND r.repair_outcome<>'Unsuccessful'
    ORDER BY datetime(COALESCE(r.completed_at,r.updated_at)) DESC LIMIT 1000`).bind(ownerId).all<Row>();
  const groups=new Map<string,{category:string;brand:string;modelKey:string;modelLabel:string;issueKey:string;issueLabel:string;prices:number[];days:number[]}>();
  for(const row of rows.results){
    let faults:Array<{key:string;label:string}>=[];
    try{const parsed=JSON.parse(String(row.faults_json??"[]"));if(Array.isArray(parsed))faults=parsed.filter((item):item is {key:string;label:string}=>Boolean(item)&&typeof item==="object"&&typeof item.key==="string");}catch{/* Fall through to stored or detected fault. */}
    if(!faults.length&&row.fault_key)faults=String(row.fault_key).split("|").map((key,index)=>({key,label:String(row.fault_label??"").split("·")[index]?.trim()||key}));
    if(!faults.length)faults=detectRepairFaults(String(row.issue??"")).map((fault)=>({key:fault.key,label:fault.label}));
    if(faults.length!==1)continue;
    const modelLabel=safeModel(String(row.recognized_model??row.device??""));const modelKey=slug(modelLabel);const mappedIssue=issueKey(faults[0].key);const category=String(row.category??"Other");const key=`${modelKey}:${mappedIssue}`;const price=Number(row.final_cost)||Number(row.estimate);if(!Number.isFinite(price)||price<=0)continue;
    const started=new Date(String(row.created_at??"")).valueOf(),finished=new Date(String(row.completed_at??"")).valueOf();const days=Number.isFinite(started)&&Number.isFinite(finished)&&finished>=started?Math.max(1,Math.ceil((finished-started)/86400000)):3;
    const group=groups.get(key)??{category,brand:brandFor(modelLabel),modelKey,modelLabel,issueKey:mappedIssue,issueLabel:issueLabel(mappedIssue),prices:[],days:[]};group.prices.push(price);group.days.push(days);groups.set(key,group);
  }
  return [...groups.values()].slice(0,200).map((group)=>{const typical=percentile(group.prices,.5);const priceLow=group.prices.length===1?round(typical*.9):percentile(group.prices,.25);const priceHigh=group.prices.length===1?round(typical*1.1):percentile(group.prices,.75);return {category:group.category,brand:group.brand,modelKey:group.modelKey,modelLabel:group.modelLabel,issueKey:group.issueKey,issueLabel:group.issueLabel,priceLow,priceHigh:Math.max(priceLow,priceHigh),currency:"EUR",turnaroundDays:Math.max(1,Math.round(group.days.reduce((sum,value)=>sum+value,0)/group.days.length)),sampleSize:group.prices.length};});
}

async function anonymousSamples(ownerId:string){
  const result=await database().prepare(`SELECT i.* FROM repair_intelligence_records i
    JOIN repair_contribution_links l ON l.contribution_id=i.id WHERE l.owner_id=?
    ORDER BY datetime(i.repair_date) DESC LIMIT 1000`).bind(ownerId).all<Row>();
  const samples=[];
  for(const row of result.results){
    let faults:Array<{key:string}>=[];
    try{const parsed=JSON.parse(String(row.faults_json??"[]"));if(Array.isArray(parsed))faults=parsed.filter((item):item is {key:string}=>Boolean(item)&&typeof item==="object"&&typeof item.key==="string");}catch{/* Invalid legacy rows are skipped. */}
    const totalPrice=Number(row.total_price);if(faults.length!==1||!Number.isFinite(totalPrice)||totalPrice<=0)continue;
    const laborHours=Number(row.labor_hours),laborRate=Number(row.labor_rate);const laborCost=Number.isFinite(laborHours)&&Number.isFinite(laborRate)&&laborHours>0&&laborRate>0?round(laborHours*laborRate):null;const partsCost=row.part_cost===null?null:Number(row.part_cost);const observed=String(row.repair_date??"");const month=/^\d{4}-\d{2}/.test(observed)?`${observed.slice(0,7)}-01T00:00:00Z`:new Date().toISOString();
    samples.push({modelKey:slug(String(row.display_model??row.model_key??"")),category:String(row.category??"Other"),issueKey:issueKey(faults[0].key),countryCode:String(row.country_code??"PT"),region:"",totalPrice,partsCost:Number.isFinite(partsCost)?partsCost:null,laborCost,currency:String(row.currency??"EUR"),observedAt:month});
  }
  return samples;
}

async function partnerFetch(path:string,init:RequestInit={}){
  const config=marketplaceConfig();if(!config)throw new Error("Marketplace connection is not configured.");
  const method=(init.method??"GET").toUpperCase();const body=typeof init.body==="string"?init.body:"";const timestamp=String(Math.floor(Date.now()/1000));
  const key=await crypto.subtle.importKey("raw",encoder.encode(config.key),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signature=[...new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(`${timestamp}\n${method}\n${path}\n${body}`)))].map(value=>value.toString(16).padStart(2,"0")).join("");
  const headers=new Headers(init.headers);headers.set("x-repairtrace-timestamp",timestamp);headers.set("x-repairtrace-signature",signature);if(body)headers.set("content-type","application/json");
  return fetch(`${config.url}${path}`,{...init,body:body||undefined,headers,signal:AbortSignal.timeout(9000)});
}

export async function syncMarketplace(ownerId:string):Promise<MarketplaceSync>{
  const settings=await getShopSettings(ownerId);const config=marketplaceConfig();if(!config)return {status:"configuration_required",servicesPublished:0,message:"The customer marketplace is built and waiting for its production connection."};
  if(settings.marketplaceEnabled&&!settings.marketplaceCity.trim())return {status:"location_required",servicesPublished:0,message:"Add the public city or town before joining the marketplace."};
  const services=settings.marketplaceEnabled?await publishedServices(ownerId):[];
  const samples=settings.shareRepairData?await anonymousSamples(ownerId):[];
  try{
    const response=await partnerFetch("/api/partners/sync",{method:"PUT",body:JSON.stringify({externalId:await externalId(ownerId),name:settings.shopName,city:settings.marketplaceCity||"Not published",region:settings.marketplaceRegion,countryCode:settings.countryCode,addressLabel:settings.marketplaceAddressLabel,latitude:settings.marketplaceLatitude,longitude:settings.marketplaceLongitude,serviceRadiusKm:settings.marketplaceRadiusKm,marketplaceEnabled:settings.marketplaceEnabled,services,samples})});
    const body=await response.json() as Record<string,unknown>;
    if(!response.ok)throw new Error(String(body.error??`Marketplace returned ${response.status}.`));
    const servicesPublished=Number(body.servicesPublished??0);
    return {status:settings.marketplaceEnabled?"connected":"disabled",servicesPublished,message:settings.marketplaceEnabled?`${servicesPublished} repair price range${servicesPublished===1?"":"s"} published.`:"The public listing is disabled."};
  }catch(error){return {status:"failed",servicesPublished:0,message:error instanceof Error?error.message:"Marketplace connection failed."};}
}

export async function marketplaceInbox(ownerId:string){
  const sync=await syncMarketplace(ownerId);
  if(sync.status!=="connected")return {sync,requests:[]};
  try{
    const id=await externalId(ownerId);
    const response=await partnerFetch(`/api/partners/sync?externalId=${encodeURIComponent(id)}`);
    const body=await response.json() as PartnerInbox;
    if(!response.ok)throw new Error(body.error??"Could not load customer requests.");
    return {sync,requests:(body.requests??[]).map((row)=>({id:String(row.id),status:String(row.status),modelLabel:String(row.model_label),issueKey:String(row.issue_key),issueDetail:String(row.issue_detail??""),city:String(row.city??""),customerName:String(row.customer_name),contactType:String(row.contact_type),contactValue:String(row.contact_value),message:String(row.message??""),shopReply:String(row.shop_reply??""),shopPrice:row.shop_price===null?null:Number(row.shop_price),currency:String(row.currency??"EUR"),createdAt:String(row.created_at),updatedAt:String(row.updated_at)}))};
  }catch(error){
    const failedSync:MarketplaceSync={...sync,status:"failed",message:error instanceof Error?error.message:"Could not load requests."};
    return {sync:failedSync,requests:[]};
  }
}

export async function replyMarketplace(ownerId:string,input:{requestId:string;status:string;shopReply:string;shopPrice:number|null}){
  const settings=await getShopSettings(ownerId);if(!settings.marketplaceEnabled)throw new Error("Enable the customer marketplace before replying.");
  const response=await partnerFetch("/api/partners/sync",{method:"PATCH",body:JSON.stringify({externalId:await externalId(ownerId),...input})});const body=await response.json() as Record<string,unknown>;if(!response.ok)throw new Error(String(body.error??"The reply could not be delivered."));return true;
}
