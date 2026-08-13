import { accountForRequest, privateHeaders } from "@/lib/account-auth";
import { clean, getBucket, getD1 } from "@/lib/server-marketplace";

export async function GET(request:Request,context:{params:Promise<{id:string;photoId:string}>}){
  try{
    const {account}=await accountForRequest(request);if(!account)return Response.json({error:"Sign in to view repair photos."},{status:401,headers:privateHeaders});const {id,photoId}=await context.params;const postId=clean(id,100),safePhotoId=clean(photoId,100);
    const row=await getD1().prepare("SELECT ph.object_key,ph.content_type,p.owner_account_id FROM repair_announcement_photos ph JOIN repair_announcements p ON p.id=ph.announcement_id WHERE ph.id=? AND p.id=? LIMIT 1").bind(safePhotoId,postId).first<{object_key:string;content_type:string;owner_account_id:string}>();if(!row||(account.role!=="provider"&&row.owner_account_id!==account.id))return Response.json({error:"Photo not found."},{status:404,headers:privateHeaders});const object=await getBucket().get(row.object_key);if(!object)return Response.json({error:"Photo not found."},{status:404,headers:privateHeaders});
    const headers=new Headers(privateHeaders);headers.set("content-type",row.content_type);headers.set("content-security-policy","default-src 'none'; sandbox");headers.set("content-disposition",`inline; filename="repair-photo-${safePhotoId.slice(-8)}"`);headers.set("content-length",String(object.size));return new Response(object.body,{headers});
  }catch(error){console.error("repair photo failed",error);return Response.json({error:"We could not load this repair photo."},{status:500,headers:privateHeaders});}
}
