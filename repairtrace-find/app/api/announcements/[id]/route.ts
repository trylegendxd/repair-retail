import { NextResponse } from "next/server";
import { accountForRequest, isSameOriginMutation, privateHeaders } from "@/lib/account-auth";
import { clean, getD1 } from "@/lib/server-marketplace";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  try{
    if(!isSameOriginMutation(request))return NextResponse.json({error:"This request was blocked for your protection."},{status:403,headers:privateHeaders});
    const {account}=await accountForRequest(request);if(!account)return NextResponse.json({error:"Sign in first."},{status:401,headers:privateHeaders});if(account.role!=="customer")return NextResponse.json({error:"Only customers can manage repair posts."},{status:403,headers:privateHeaders});
    const {id}=await context.params;const postId=clean(id,100);const body=await request.json() as Record<string,unknown>;const action=clean(body.action,20);if(action!=="close"&&action!=="reopen")return NextResponse.json({error:"Choose close or reopen."},{status:400,headers:privateHeaders});
    const db=getD1();const post=await db.prepare("SELECT status,accepted_offer_id FROM repair_announcements WHERE id=? AND owner_account_id=? LIMIT 1").bind(postId,account.id).first<{status:string;accepted_offer_id:string|null}>();if(!post)return NextResponse.json({error:"Repair post not found."},{status:404,headers:privateHeaders});
    if(action==="reopen"&&post.accepted_offer_id)return NextResponse.json({error:"A post with an accepted offer cannot be reopened."},{status:409,headers:privateHeaders});
    const result=action==="close"?await db.prepare("UPDATE repair_announcements SET status='closed',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_account_id=?").bind(postId,account.id).run():await db.prepare("UPDATE repair_announcements SET status='open',expires_at=datetime('now','+30 days'),updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_account_id=?").bind(postId,account.id).run();
    if(!result.meta.changes)return NextResponse.json({error:"Repair post not found."},{status:404,headers:privateHeaders});return NextResponse.json({ok:true,status:action==="close"?"closed":"open"},{headers:privateHeaders});
  }catch(error){console.error("announcement update failed",error);return NextResponse.json({error:"We could not update this repair post."},{status:500,headers:privateHeaders});}
}
