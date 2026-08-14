import { NextResponse } from "next/server";
import { accountForRequest, accountRoles, isSameOriginMutation, mapAccount, privateHeaders, providerKinds } from "@/lib/account-auth";
import { countries } from "@/lib/repair-catalog";
import { clean, getD1, uid } from "@/lib/server-marketplace";
import { checkRateLimit } from "@/lib/rate-limit";

const phonePattern=/^[+()\d\s.-]{0,24}$/;

export async function GET(request:Request){
  try{
    const {user,account}=await accountForRequest(request);
    if(!user)return NextResponse.json({signedIn:false,profile:null},{headers:privateHeaders});
    return NextResponse.json({signedIn:true,user:{displayName:user.displayName},profile:account},{headers:privateHeaders});
  }catch(error){
    console.error("account lookup failed",error);
    return NextResponse.json({error:"We could not load your RepairTrace account."},{status:500,headers:privateHeaders});
  }
}

export async function POST(request:Request){
  try{
    if(!isSameOriginMutation(request))return NextResponse.json({error:"This request was blocked for your protection."},{status:403,headers:privateHeaders});
    const {user,account}=await accountForRequest(request);
    if(user){const {allowed}=await checkRateLimit(user.email,10,3600);if(!allowed)return NextResponse.json({error:"Too many account updates. Please wait before trying again."},{status:429,headers:privateHeaders});}
    const declaredLength=Number(request.headers.get("content-length")||0);
    if(declaredLength>30_000)return NextResponse.json({error:"Profile information is too large."},{status:413,headers:privateHeaders});
    if(!user)return NextResponse.json({error:"Sign in to create a RepairTrace account."},{status:401,headers:privateHeaders});
    const rawBody=await request.text();
    if(new TextEncoder().encode(rawBody).byteLength>30_000)return NextResponse.json({error:"Profile information is too large."},{status:413,headers:privateHeaders});
    const body=JSON.parse(rawBody) as Record<string,unknown>;
    const role=clean(body.role,20);
    const displayName=clean(body.displayName,100)||user.displayName;
    const phone=clean(body.phone,24);
    const city=clean(body.city,100);
    const region=clean(body.region,100);
    const countryCode=clean(body.countryCode,2).toUpperCase()||"PT";
    const providerKind=clean(body.providerKind,40);
    const businessName=clean(body.businessName,120);
    const bio=clean(body.bio,500);
    const serviceRadiusKm=Math.min(250,Math.max(2,Math.round(Number(body.serviceRadiusKm)||50)));
    const sellerType=role==="provider"?(providerKind==="independent_technician"?"individual_seller":"shop"):"customer";
    const hasLatitude=body.latitude!==undefined&&body.latitude!==null&&body.latitude!=="";
    const hasLongitude=body.longitude!==undefined&&body.longitude!==null&&body.longitude!=="";
    const latitude=hasLatitude?Number(body.latitude):null;
    const longitude=hasLongitude?Number(body.longitude):null;

    if(!accountRoles.includes(role as typeof accountRoles[number]))return NextResponse.json({error:"Choose either a customer or provider account."},{status:400,headers:privateHeaders});
    if(account&&account.role!==role)return NextResponse.json({error:"Account type cannot be changed after registration. Contact support if you need a separate provider account."},{status:409,headers:privateHeaders});
    if(displayName.length<2||!city||!countries.some(country=>country.code===countryCode)||!phonePattern.test(phone))return NextResponse.json({error:"Add a valid name, location and optional phone number."},{status:400,headers:privateHeaders});
    if(hasLatitude!==hasLongitude||(latitude!==null&&longitude!==null&&(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<-90||latitude>90||longitude<-180||longitude>180)))return NextResponse.json({error:"Location coordinates are invalid."},{status:400,headers:privateHeaders});
    if(role==="provider"&&(!providerKinds.includes(providerKind as typeof providerKinds[number])||businessName.length<2))return NextResponse.json({error:"Providers need a business type and public business name."},{status:400,headers:privateHeaders});

    const db=getD1();
    if(account){
      await db.prepare("UPDATE marketplace_accounts SET display_name=?,phone=?,city=?,region=?,country_code=?,latitude=?,longitude=?,provider_kind=?,business_name=?,bio=?,service_radius_km=?,seller_type=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(displayName,phone,city,region,countryCode,latitude,longitude,role==="provider"?providerKind:"",role==="provider"?businessName:"",role==="provider"?bio:"",serviceRadiusKm,sellerType,account.id).run();
    }else{
      await db.prepare("INSERT OR IGNORE INTO marketplace_accounts (id,email,role,display_name,phone,city,region,country_code,latitude,longitude,provider_kind,business_name,bio,service_radius_km,seller_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(uid("account"),user.email,role,displayName,phone,city,region,countryCode,latitude,longitude,role==="provider"?providerKind:"",role==="provider"?businessName:"",role==="provider"?bio:"",serviceRadiusKm,sellerType).run();
      const created=await db.prepare("SELECT role FROM marketplace_accounts WHERE email=? LIMIT 1").bind(user.email).first<{role:string}>();
      if(!created)throw new Error("ACCOUNT_CREATE_FAILED");
      if(created.role!==role)return NextResponse.json({error:"This signed-in email already has a different account type. Sign in with another email for a separate role."},{status:409,headers:privateHeaders});
    }
    const updated=await db.prepare("SELECT id,role,display_name,phone,city,region,country_code,latitude,longitude,provider_kind,business_name,bio,service_radius_km,seller_type,is_verified,verification_status,trust_score FROM marketplace_accounts WHERE email=? LIMIT 1").bind(user.email).first<Record<string,unknown>>();
    if(!updated)throw new Error("ACCOUNT_LOOKUP_FAILED");
    if(role==="provider"&&sellerType==="shop"){
      const businessType=providerKind==="repair_shop"?"electronics_repair":providerKind==="parts_seller"?"electronics_parts":providerKind==="goods_services"?"goods_services":"general";
      await db.prepare("INSERT INTO shop_profiles (id,account_id,business_name,business_type,service_area_radius_km) VALUES (?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET business_name=excluded.business_name,business_type=excluded.business_type,service_area_radius_km=excluded.service_area_radius_km,updated_at=CURRENT_TIMESTAMP")
        .bind(uid("shop"),String(updated.id),businessName,businessType,serviceRadiusKm).run();
    }
    return NextResponse.json({ok:true,profile:mapAccount(updated)},{status:account?200:201,headers:privateHeaders});
  }catch(error){
    console.error("account save failed",error);
    return NextResponse.json({error:error instanceof SyntaxError?"Profile information is not valid JSON.":"We could not save your RepairTrace account."},{status:error instanceof SyntaxError?400:500,headers:privateHeaders});
  }
}
