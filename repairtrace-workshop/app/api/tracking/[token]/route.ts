import { getPublicTracking } from "../../../../lib/server-client-tracking";

type Context={params:Promise<{token:string}>};

export async function GET(_: Request, context: Context) {
  try {
    const headers={"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"};
    const {token}=await context.params;
    const tracking=await getPublicTracking(token);
    if (!tracking) return Response.json({error:"Tracking link not found"},{status:404,headers});
    return Response.json({tracking},{headers});
  } catch {
    return Response.json({error:"Tracking link unavailable"},{status:500,headers:{"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"}});
  }
}
