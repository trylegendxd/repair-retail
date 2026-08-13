import { generateAndSaveAiEstimate } from "../../../../../lib/server-ai";
import { syncRepairContribution } from "../../../../../lib/server-intelligence";
import { ownerIdFromRequest } from "../../../../../lib/server-identity";
import { apiError, assertSameOrigin, privateHeaders } from "../../../../../lib/server-http";

type Context={params:Promise<{id:string}>};

export async function POST(request:Request,context:Context){
  try{
    assertSameOrigin(request);
    const{id}=await context.params;
    const ownerId=await ownerIdFromRequest(request);
    let input:Record<string,unknown>={};
    try{input=await request.json() as Record<string,unknown>;}catch{/* A refresh without settings uses the saved values. */}
    const requestedRate=Number(input.laborRate);
    if(input.laborRate!==undefined&&(!Number.isFinite(requestedRate)||requestedRate<0||requestedRate>1000))return Response.json({error:"Hourly labour rate must be between €0 and €1,000."},{status:400});
    const repair=await generateAndSaveAiEstimate(id,{ownerId,laborRate:input.laborRate===undefined?undefined:requestedRate,includeLabor:input.includeLabor===undefined?undefined:Boolean(input.includeLabor)});
    await syncRepairContribution(ownerId,id);
    return Response.json({repair},{headers:privateHeaders});
  }
  catch(error){return apiError(error,"Could not research parts");}
}
