import { NextResponse } from "next/server";
import { accountForRequest, isSameOriginMutation, privateHeaders } from "@/lib/account-auth";
import { countries, deviceCategories, getModel, inferIssueFromProblem } from "@/lib/repair-catalog";
import { clean, getBucket, getD1, uid } from "@/lib/server-marketplace";

type Row=Record<string,unknown>;
const MAX_PHOTOS=5;const MAX_PHOTO_BYTES=8_000_000;const MAX_TOTAL_BYTES=25_000_000;

function distanceKm(aLat:number,aLng:number,bLat:number,bLng:number){const radians=(value:number)=>value*Math.PI/180;const dLat=radians(bLat-aLat),dLng=radians(bLng-aLng);const x=Math.max(0,Math.min(1,Math.sin(dLat/2)**2+Math.cos(radians(aLat))*Math.cos(radians(bLat))*Math.sin(dLng/2)**2));return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
function safeCustomerName(value:string){const parts=value.trim().split(/\s+/);return parts.length>1?`${parts[0]} ${parts.at(-1)?.slice(0,1)}.`:parts[0]||"Customer";}
function mapPost(row:Row,viewer:"customer"|"provider",viewerLat:number|null,viewerLng:number|null,hasAccepted:boolean=false){const lat=row.latitude===null?null:Number(row.latitude),lng=row.longitude===null?null:Number(row.longitude);const canDistance=viewerLat!==null&&viewerLng!==null&&lat!==null&&lng!==null&&Number.isFinite(lat)&&Number.isFinite(lng);const showFullName=viewer==="customer"||hasAccepted;const displayName=showFullName?String(row.customer_display_name):"Customer";return {id:String(row.id),status:String(row.status),deviceCategory:String(row.device_category),brand:String(row.brand??""),modelKey:String(row.model_key),modelLabel:String(row.model_label),issueKey:String(row.issue_key),problemDetail:String(row.problem_detail),customerName:displayName,city:String(row.city),region:String(row.region??""),countryCode:String(row.country_code),distanceKm:canDistance?Math.round(distanceKm(viewerLat!,viewerLng!,lat!,lng!)*10)/10:null,photoCount:Number(row.photo_count)||0,offerCount:Number(row.offer_count)||0,acceptedOfferId:row.accepted_offer_id?String(row.accepted_offer_id):null,primaryPhotoId:row.primary_photo_id?String(row.primary_photo_id):null,expiresAt:String(row.expires_at),createdAt:String(row.created_at),updatedAt:String(row.updated_at)};}

async function offersForPosts(postIds:string[]){
  if(!postIds.length)return new Map<string,unknown[]>();
  const placeholders=postIds.map(()=>"?").join(",");
  const result=await getD1().prepare(`SELECT o.*,a.business_name,a.display_name,a.provider_kind,a.city provider_city,a.phone provider_phone FROM repair_offers o JOIN marketplace_accounts a ON a.id=o.provider_account_id WHERE o.announcement_id IN (${placeholders}) ORDER BY o.created_at DESC`).bind(...postIds).all<Row>();
  const grouped=new Map<string,unknown[]>();
  for(const row of result.results??[]){const postId=String(row.announcement_id);const value={id:String(row.id),status:String(row.status),offerType:String(row.offer_type),priceLow:Number(row.price_low),priceHigh:Number(row.price_high),currency:String(row.currency),estimatedDays:Number(row.estimated_days),message:String(row.message),providerName:String(row.business_name||row.display_name),providerKind:String(row.provider_kind),providerCity:String(row.provider_city),providerPhone:String(row.status)==="accepted"?String(row.provider_phone??""):"",createdAt:String(row.created_at),updatedAt:String(row.updated_at)};grouped.set(postId,[...(grouped.get(postId)??[]),value]);}
  return grouped;
}

export async function GET(request:Request){
  try{
    const {account}=await accountForRequest(request);
    if(!account)return NextResponse.json({error:"Sign in and finish account registration to use the repair marketplace."},{status:401,headers:privateHeaders});
    const params=new URL(request.url).searchParams;const scope=clean(params.get("scope"),20);
    if(account.role==="customer"){
      const result=await getD1().prepare("SELECT p.*,(SELECT id FROM repair_announcement_photos ph WHERE ph.announcement_id=p.id ORDER BY ph.sort_order LIMIT 1) primary_photo_id FROM repair_announcements p WHERE p.owner_account_id=? ORDER BY p.created_at DESC LIMIT 50").bind(account.id).all<Row>();
      const posts=(result.results??[]).map(row=>mapPost(row,"customer",account.latitude,account.longitude));const offers=await offersForPosts(posts.map(post=>post.id));
      return NextResponse.json({mode:"customer",posts:posts.map(post=>({...post,offers:offers.get(post.id)??[]}))},{headers:privateHeaders});
    }
    if(scope==="offers"){
      const result=await getD1().prepare("SELECT o.id offer_id,o.status offer_status,o.offer_type,o.price_low,o.price_high,o.currency,o.estimated_days,o.message,o.created_at offer_created_at,o.updated_at offer_updated_at,p.*,c.display_name customer_full_name,c.phone customer_phone,(SELECT id FROM repair_announcement_photos ph WHERE ph.announcement_id=p.id ORDER BY ph.sort_order LIMIT 1) primary_photo_id FROM repair_offers o JOIN repair_announcements p ON p.id=o.announcement_id JOIN marketplace_accounts c ON c.id=p.owner_account_id WHERE o.provider_account_id=? ORDER BY o.updated_at DESC LIMIT 100").bind(account.id).all<Row>();
      const offers=(result.results??[]).map(row=>{const post=mapPost(row,"provider",account.latitude,account.longitude);const accepted=String(row.offer_status)==="accepted";return {id:String(row.offer_id),status:String(row.offer_status),offerType:String(row.offer_type),priceLow:Number(row.price_low),priceHigh:Number(row.price_high),currency:String(row.currency),estimatedDays:Number(row.estimated_days),message:String(row.message),createdAt:String(row.offer_created_at),updatedAt:String(row.offer_updated_at),post:{...post,customerName:accepted?String(row.customer_full_name):post.customerName,customerPhone:accepted?String(row.customer_phone??""):""}}});
      return NextResponse.json({mode:"provider-offers",offers},{headers:privateHeaders});
    }
    const category=clean(params.get("category"),30);const query=clean(params.get("q"),100).toLowerCase();const radius=Math.min(account.serviceRadiusKm,Math.max(2,Number(params.get("radius"))||account.serviceRadiusKm));
    const result=await getD1().prepare("SELECT p.*,(SELECT id FROM repair_announcement_photos ph WHERE ph.announcement_id=p.id ORDER BY ph.sort_order LIMIT 1) primary_photo_id,EXISTS(SELECT 1 FROM repair_offers o WHERE o.announcement_id=p.id AND o.provider_account_id=?) already_offered FROM repair_announcements p WHERE p.status='open' AND p.country_code=? AND datetime(p.expires_at)>datetime('now') AND (?='' OR p.device_category=?) AND (?='' OR instr(lower(p.model_label||' '||p.brand||' '||p.problem_detail||' '||p.city),?)>0) ORDER BY p.created_at DESC LIMIT 300").bind(account.id,account.countryCode,category,category,query,query).all<Row>();
    const posts=(result.results??[]).map(row=>({...mapPost(row,"provider",account.latitude,account.longitude,Boolean(row.accepted_offer_id)),alreadyOffered:Boolean(row.already_offered)})).filter(post=>post.distanceKm!==null?post.distanceKm<=radius:post.city.toLowerCase()===account.city.toLowerCase()||Boolean(account.region&&post.region.toLowerCase()===account.region.toLowerCase())).slice(0,100);
    return NextResponse.json({mode:"provider-feed",posts,radius},{headers:privateHeaders});
  }catch(error){
    console.error("announcement list failed",error);
    return NextResponse.json({error:"We could not load repair opportunities."},{status:500,headers:privateHeaders});
  }
}

function detectImage(bytes:Uint8Array){
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return {contentType:"image/jpeg",extension:"jpg"};
  if(bytes.length>=8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a)return {contentType:"image/png",extension:"png"};
  if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP")return {contentType:"image/webp",extension:"webp"};
  return null;
}

export async function POST(request:Request){
  const uploadedKeys:string[]=[];
  try{
    if(!isSameOriginMutation(request))return NextResponse.json({error:"This request was blocked for your protection."},{status:403,headers:privateHeaders});
    const declaredLength=Number(request.headers.get("content-length")||0);if(declaredLength>27_000_000)return NextResponse.json({error:"The listing is too large. Upload at most five photos under 8 MB each."},{status:413,headers:privateHeaders});
    const {account}=await accountForRequest(request);if(!account)return NextResponse.json({error:"Sign in and finish account registration first."},{status:401,headers:privateHeaders});if(account.role!=="customer")return NextResponse.json({error:"Only customer accounts can post a repair need."},{status:403,headers:privateHeaders});
    const form=await request.formData();const problem=clean(form.get("problem"),2000);const category=clean(form.get("category"),30)||"Other";const model=getModel(clean(form.get("modelKey"),80),clean(form.get("modelLabel"),120),category);const customerName=clean(form.get("customerName"),100)||account.displayName;const city=clean(form.get("city"),100)||account.city;const region=clean(form.get("region"),100)||account.region;const countryCode=clean(form.get("countryCode"),2).toUpperCase()||account.countryCode;const country=countries.find(item=>item.code===countryCode);
    const latitudeValue=clean(form.get("latitude"),30),longitudeValue=clean(form.get("longitude"),30);const latitude=latitudeValue?Number(latitudeValue):account.latitude;const longitude=longitudeValue?Number(longitudeValue):account.longitude;
    if(problem.length<15||customerName.length<2||!city||!country||!deviceCategories.includes(model.category as typeof deviceCategories[number]))return NextResponse.json({error:"Add your name, location, device and a clear description of the problem."},{status:400,headers:privateHeaders});
    if((latitude===null)!==(longitude===null)||(latitude!==null&&longitude!==null&&(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<-90||latitude>90||longitude<-180||longitude>180)))return NextResponse.json({error:"Location coordinates are invalid."},{status:400,headers:privateHeaders});
    const files=form.getAll("photos").filter(value=>value instanceof File&&value.size>0) as File[];if(files.length>MAX_PHOTOS||files.some(file=>file.size>MAX_PHOTO_BYTES)||files.reduce((total,file)=>total+file.size,0)>MAX_TOTAL_BYTES)return NextResponse.json({error:"Upload at most five JPEG, PNG or WebP photos under 8 MB each."},{status:400,headers:privateHeaders});
    const db=getD1();const rate=await db.prepare("SELECT COUNT(*) count FROM repair_announcements WHERE owner_account_id=? AND datetime(created_at)>datetime('now','-1 hour')").bind(account.id).first<{count:number}>();if(Number(rate?.count??0)>=5)return NextResponse.json({error:"You have posted several repair needs recently. Please wait before posting another."},{status:429,headers:privateHeaders});
    const open=await db.prepare("SELECT COUNT(*) count FROM repair_announcements WHERE owner_account_id=? AND status='open' AND datetime(expires_at)>datetime('now')").bind(account.id).first<{count:number}>();if(Number(open?.count??0)>=20)return NextResponse.json({error:"Close an existing repair post before creating another."},{status:409,headers:privateHeaders});
    const announcementId=uid("repair");const photoStatements:D1PreparedStatement[]=[];
    if(files.length){const bucket=getBucket();for(let index=0;index<files.length;index+=1){const file=files[index];const data=new Uint8Array(await file.arrayBuffer());const detected=detectImage(data);if(!detected)throw new Error("UNSUPPORTED_IMAGE");const photoId=uid("photo");const objectKey=`repair-announcements/${announcementId}/${photoId}.${detected.extension}`;await bucket.put(objectKey,data,{httpMetadata:{contentType:detected.contentType,cacheControl:"private, no-store"}});uploadedKeys.push(objectKey);photoStatements.push(db.prepare("INSERT INTO repair_announcement_photos (id,announcement_id,object_key,content_type,size_bytes,sort_order) VALUES (?,?,?,?,?,?)").bind(photoId,announcementId,objectKey,detected.contentType,data.byteLength,index));}}
    const issueKey=inferIssueFromProblem(problem,model.category);const expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
    await db.batch([db.prepare("INSERT INTO repair_announcements (id,owner_account_id,status,device_category,brand,model_key,model_label,issue_key,problem_detail,customer_display_name,city,region,country_code,latitude,longitude,photo_count,offer_count,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(announcementId,account.id,"open",model.category,model.brand,model.key,model.label,issueKey,problem,customerName,city,region,country.code,latitude,longitude,files.length,0,expiresAt),...photoStatements]);
    return NextResponse.json({ok:true,id:announcementId,issueKey},{status:201,headers:privateHeaders});
  }catch(error){
    if(uploadedKeys.length){try{await getBucket().delete(uploadedKeys);}catch(cleanupError){console.error("announcement photo cleanup failed",cleanupError);}}
    console.error("announcement create failed",error);
    return NextResponse.json({error:error instanceof Error&&error.message==="UNSUPPORTED_IMAGE"?"Photos must be genuine JPEG, PNG or WebP images.":"We could not publish this repair need."},{status:error instanceof Error&&error.message==="UNSUPPORTED_IMAGE"?400:500,headers:privateHeaders});
  }
}
