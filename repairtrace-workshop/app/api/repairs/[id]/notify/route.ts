import { sendTrackingLink } from "../../../../../lib/server-client-tracking";
import { getRepair } from "../../../../../lib/server-repairs";
import { ownerIdFromRequest } from "../../../../../lib/server-identity";
import { apiError, assertSameOrigin, privateHeaders } from "../../../../../lib/server-http";

type Context={params:Promise<{id:string}>};

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const {id}=await context.params;
    const ownerId=await ownerIdFromRequest(request);
    const current=await getRepair(id,false,ownerId);
    if (!current) return Response.json({error:"Repair not found"},{status:404});
    const delivery=await sendTrackingLink(ownerId,id,new URL(request.url).origin);
    return Response.json({delivery,repair:await getRepair(id,false,ownerId)},{headers:privateHeaders});
  } catch (error) {
    return apiError(error,"Could not send the tracking link");
  }
}
