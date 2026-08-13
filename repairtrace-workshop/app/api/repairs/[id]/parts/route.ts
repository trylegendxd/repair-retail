import { database, ensureRepairDatabase, getRepair } from "../../../../../lib/server-repairs";
import { syncRepairContribution } from "../../../../../lib/server-intelligence";
import { ownerIdFromRequest } from "../../../../../lib/server-identity";
import { allocateInventoryForRepair } from "../../../../../lib/server-operations";
import { apiError, assertSameOrigin, cleanText, privateHeaders } from "../../../../../lib/server-http";

type Context={params:Promise<{id:string}>};

export async function POST(request:Request,context:Context){
  let allocation:Awaited<ReturnType<typeof allocateInventoryForRepair>>=null;
  let ownerId="";
  try{
    assertSameOrigin(request);await ensureRepairDatabase();const{id}=await context.params;ownerId=await ownerIdFromRequest(request);
    const current=await getRepair(id,false,ownerId);if(!current)return Response.json({error:"Repair not found"},{status:404,headers:privateHeaders});
    const input=await request.json() as Record<string,unknown>;const name=cleanText(input.name,180);if(!name)return Response.json({error:"Part name is required"},{status:400});
    const cost=Number(input.cost??0);const quantity=Number(input.quantity??1);
    if(!Number.isFinite(cost)||cost<0||cost>1_000_000||!Number.isInteger(quantity)||quantity<=0||quantity>1000)return Response.json({error:"Enter a valid part cost and whole-number quantity."},{status:400});
    const sku=cleanText(input.sku,100).toUpperCase();const supplier=cleanText(input.supplier,180)||"Manual entry";
    if(input.useInventory!==false&&sku)allocation=await allocateInventoryForRepair(ownerId,id,sku,quantity);
    const db=database();const statements=[db.prepare("INSERT INTO repair_parts (id,repair_id,name,sku,supplier,quantity,cost) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),id,name,sku,supplier,quantity,cost)];
    if(allocation)statements.push(db.prepare("INSERT INTO repair_events (id,repair_id,title,detail) VALUES (?,?,?,?)").bind(crypto.randomUUID(),id,"Inventory allocated",`${allocation.used} × ${allocation.name} (${sku})`));
    try{await db.batch(statements);}catch(error){if(allocation)await db.prepare("UPDATE inventory_items SET quantity=quantity+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?").bind(allocation.used,allocation.id,ownerId).run();throw error;}
    await syncRepairContribution(ownerId,id);return Response.json({repair:await getRepair(id,false,ownerId)},{status:201,headers:privateHeaders});
  }catch(error){
    if(error instanceof Error&&(/available for SKU|Inventory changed/.test(error.message)))return Response.json({error:error.message},{status:409,headers:privateHeaders});
    return apiError(error,"Could not add part");
  }
}
