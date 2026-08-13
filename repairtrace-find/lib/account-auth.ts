import { clean, getD1 } from "./server-marketplace";

export const accountRoles=["customer","provider"] as const;
export const providerKinds=["repair_shop","independent_technician","parts_seller","goods_services"] as const;
export type AccountRole=typeof accountRoles[number];

export type MarketplaceAccount={
  id:string;role:AccountRole;displayName:string;phone:string;city:string;region:string;countryCode:string;
  latitude:number|null;longitude:number|null;providerKind:string;businessName:string;bio:string;serviceRadiusKm:number;
};

type RequestUser={email:string;displayName:string};

function decodeFullName(request:Request){
  const encoded=request.headers.get("oai-authenticated-user-full-name");
  if(!encoded||request.headers.get("oai-authenticated-user-full-name-encoding")!=="percent-encoded-utf-8")return null;
  try{return decodeURIComponent(encoded);}catch{return null;}
}

export function getRequestUser(request:Request):RequestUser|null{
  const email=clean(request.headers.get("oai-authenticated-user-email"),254).toLowerCase();
  if(!email)return null;
  return {email,displayName:clean(decodeFullName(request),100)||email.split("@")[0]||"RepairTrace user"};
}

export function isSameOriginMutation(request:Request){
  const fetchSite=request.headers.get("sec-fetch-site");
  if(fetchSite&&fetchSite!=="same-origin"&&fetchSite!=="none")return false;
  const origin=request.headers.get("origin");
  if(!origin)return true;
  try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}

export async function findAccountByEmail(email:string){
  const row=await getD1().prepare("SELECT id,role,display_name,phone,city,region,country_code,latitude,longitude,provider_kind,business_name,bio,service_radius_km FROM marketplace_accounts WHERE email=? LIMIT 1").bind(email).first<Record<string,unknown>>();
  return row?mapAccount(row):null;
}

export async function accountForRequest(request:Request){
  const user=getRequestUser(request);
  if(!user)return {user:null,account:null};
  return {user,account:await findAccountByEmail(user.email)};
}

export function mapAccount(row:Record<string,unknown>):MarketplaceAccount{
  return {id:String(row.id),role:row.role as AccountRole,displayName:String(row.display_name),phone:String(row.phone??""),city:String(row.city),region:String(row.region??""),countryCode:String(row.country_code),latitude:row.latitude===null?null:Number(row.latitude),longitude:row.longitude===null?null:Number(row.longitude),providerKind:String(row.provider_kind??""),businessName:String(row.business_name??""),bio:String(row.bio??""),serviceRadiusKm:Number(row.service_radius_km)||50};
}

export const privateHeaders={"cache-control":"private, no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"};
