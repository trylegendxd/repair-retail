import { marketplaceInbox, replyMarketplace } from "../../../lib/server-marketplace";
import { ownerIdFromRequest } from "../../../lib/server-identity";
import { apiError, assertSameOrigin, privateHeaders } from "../../../lib/server-http";

export async function GET(request:Request){try{return Response.json(await marketplaceInbox(await ownerIdFromRequest(request)),{headers:privateHeaders});}catch(error){return apiError(error,"Could not load marketplace.");}}

export async function PATCH(request:Request){
  try{assertSameOrigin(request);const ownerId=await ownerIdFromRequest(request);const input=await request.json() as Record<string,unknown>;const requestId=String(input.requestId??"").trim();const status=String(input.status??"");const allowed=new Set(["viewed","quoted","accepted","declined","closed"]);const shopReply=String(input.shopReply??"").replace(/[\r\n]{3,}/g,"\n\n").trim().slice(0,1200);const price=input.shopPrice===null||input.shopPrice===""||input.shopPrice===undefined?null:Number(input.shopPrice);if(!requestId||!allowed.has(status))return Response.json({error:"Choose a valid request and status."},{status:400});if(price!==null&&(!Number.isFinite(price)||price<0||price>1000000))return Response.json({error:"Enter a valid quote price."},{status:400});if(status==="quoted"&&(!shopReply||price===null))return Response.json({error:"A quoted request needs a message and price."},{status:400});await replyMarketplace(ownerId,{requestId,status,shopReply,shopPrice:price});return Response.json(await marketplaceInbox(ownerId),{headers:privateHeaders});}catch(error){return apiError(error,"Could not send marketplace reply.");}
}
