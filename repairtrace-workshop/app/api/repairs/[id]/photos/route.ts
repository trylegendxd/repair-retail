import { env } from "cloudflare:workers";
import { database, ensureRepairDatabase, getRepair } from "../../../../../lib/server-repairs";
import { ownerIdFromRequest } from "../../../../../lib/server-identity";
import { apiError, assertSameOrigin, cleanText, privateHeaders } from "../../../../../lib/server-http";

type Context={params:Promise<{id:string}>};
function detectedImage(bytes:Uint8Array){
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return{type:"image/jpeg",extension:"jpg"};
  if(bytes.length>=8&&[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index)=>bytes[index]===value))return{type:"image/png",extension:"png"};
  if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP")return{type:"image/webp",extension:"webp"};
  return null;
}

export async function POST(request:Request,context:Context){
  let storedKey="";
  try{
    assertSameOrigin(request);await ensureRepairDatabase();const{id}=await context.params;const ownerId=await ownerIdFromRequest(request);const current=await getRepair(id,false,ownerId);
    if(!current)return Response.json({error:"Repair not found"},{status:404,headers:privateHeaders});
    const form=await request.formData();const file=form.get("photo");if(!(file instanceof File))return Response.json({error:"Choose an image"},{status:400});
    if(file.size<=0||file.size>5*1024*1024)return Response.json({error:"Image must be between 1 byte and 5 MB"},{status:400});
    const buffer=await file.arrayBuffer();const image=detectedImage(new Uint8Array(buffer));if(!image)return Response.json({error:"Upload a JPEG, PNG or WebP image."},{status:400});
    if(!env.BUCKET)throw new Error("Evidence storage is unavailable.");
    const photoId=crypto.randomUUID();storedKey=`repairs/${id}/${photoId}.${image.extension}`;const fileName=cleanText(file.name,100)||`repair-photo.${image.extension}`;const caption=cleanText(form.get("caption"),300)||"Repair evidence";
    await env.BUCKET.put(storedKey,buffer,{httpMetadata:{contentType:image.type}});
    const db=database();
    try{await db.batch([db.prepare("INSERT INTO repair_photos (id,repair_id,object_key,file_name,content_type,caption) VALUES (?,?,?,?,?,?)").bind(photoId,id,storedKey,fileName,image.type,caption),db.prepare("INSERT INTO repair_events (id,repair_id,title,detail) VALUES (?,?,?,?)").bind(crypto.randomUUID(),id,"Evidence photo added",fileName)]);}catch(error){await env.BUCKET.delete(storedKey);storedKey="";throw error;}
    return Response.json({repair:await getRepair(id,false,ownerId)},{status:201,headers:privateHeaders});
  }catch(error){if(storedKey&&env.BUCKET)await env.BUCKET.delete(storedKey);return apiError(error,"Could not upload photo");}
}
