import { env } from "cloudflare:workers";
import { database, defaultClientMessage, ensureRepairDatabase, getRepair, validStatus } from "../../../../lib/server-repairs";
import { removeRepairContribution, syncRepairContribution } from "../../../../lib/server-intelligence";
import { ownerIdFromRequest } from "../../../../lib/server-identity";
import { apiError, assertSameOrigin, cleanMultiline, privateHeaders } from "../../../../lib/server-http";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try { const { id } = await context.params; const ownerId=await ownerIdFromRequest(request); const repair = await getRepair(id,false,ownerId); return repair ? Response.json({ repair },{headers:privateHeaders}) : Response.json({ error:"Repair not found" }, { status:404,headers:privateHeaders }); }
  catch (error) { return apiError(error,"Could not load repair"); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);await ensureRepairDatabase(); const { id } = await context.params; const input = await request.json() as Record<string, unknown>;
    const ownerId=await ownerIdFromRequest(request);
    const current = await getRepair(id,false,ownerId); if (!current) return Response.json({ error:"Repair not found" }, { status:404 });
    const status = validStatus(input.status) ? input.status : current.status;
    const diagnosis = input.diagnosis===undefined?current.diagnosis:cleanMultiline(input.diagnosis,3000);
    const finalCost = input.finalCost === undefined ? current.finalCost : Number(input.finalCost);
    const estimate = input.estimate === undefined ? current.estimate : Number(input.estimate);
    const requestedLaborRate=input.laborRate===undefined?current.laborRate:Number(input.laborRate);
    if(!Number.isFinite(requestedLaborRate)||requestedLaborRate<0||requestedLaborRate>1000)return Response.json({error:"Hourly labour rate must be between €0 and €1,000."},{status:400});
    const includeLabor=input.includeLabor===undefined?current.includeLabor:Boolean(input.includeLabor);
    const actualLaborHours=input.actualLaborHours===undefined?current.actualLaborHours:Number(input.actualLaborHours);
    if(!Number.isFinite(actualLaborHours)||actualLaborHours<0||actualLaborHours>1000)return Response.json({error:"Actual labour time must be between 0 and 1,000 hours."},{status:400});
    if(!Number.isFinite(finalCost)||finalCost<0||finalCost>1000000||!Number.isFinite(estimate)||estimate<0||estimate>1000000)return Response.json({error:"Repair prices must be valid positive amounts."},{status:400});
    const allowedPartQualities=new Set(["Unspecified","OEM","Refurbished","Aftermarket"]);
    const partQuality=allowedPartQualities.has(String(input.partQuality))?String(input.partQuality):current.partQuality;
    const allowedOutcomes=new Set(["Pending","Successful","Partial","Unsuccessful"]);
    let repairOutcome=allowedOutcomes.has(String(input.repairOutcome))?String(input.repairOutcome):current.repairOutcome;
    if(status==="Completed"&&repairOutcome==="Pending")repairOutcome="Successful";
    const warrantyReturn=input.warrantyReturn===undefined?current.warrantyReturn:Boolean(input.warrantyReturn);
    const requestedPublished = input.published === undefined ? current.published : Boolean(input.published);
    if(input.published===true&&(status!=="Completed"||!current.tests?.length||current.tests.some((test)=>test.result!=="passed")))return Response.json({error:"Complete the repair and pass every quality check before publishing its certificate."},{status:400});
    const published=status==="Completed"&&requestedPublished;
    const completedAt = status === "Completed" ? (current.completedAt ?? new Date().toISOString()) : null;
    const requestedClientUpdate=typeof input.clientUpdate==="string"?input.clientUpdate.replace(/[\r\n]+/g," ").trim().slice(0,500):"";
    const clientUpdate=requestedClientUpdate||(status!==current.status?defaultClientMessage(status):current.clientUpdate);
    const clientUpdateChanged=status!==current.status||clientUpdate!==current.clientUpdate;
    const assignedTechnician=typeof input.assignedTechnician==="string"?input.assignedTechnician.trim().slice(0,160):current.assignedTechnician;
    const appointmentAt=typeof input.appointmentAt==="string"?input.appointmentAt.trim().slice(0,60):current.appointmentAt;
    if(appointmentAt&&Number.isNaN(new Date(appointmentAt).valueOf()))return Response.json({error:"Choose a valid appointment date and time."},{status:400});
    const internalNotes=typeof input.internalNotes==="string"?input.internalNotes.trim().slice(0,3000):current.internalNotes;
    const db = database();
    const statements=[db.prepare("UPDATE repairs SET status=?, diagnosis=?, estimate=?, labor_rate=?, include_labor=?, actual_labor_hours=?, part_quality=?, repair_outcome=?, warranty_return=?, final_cost=?, published=?, completed_at=?, client_update=?, client_updated_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE client_updated_at END, assigned_technician=?, appointment_at=?, internal_notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?").bind(status, diagnosis, estimate, requestedLaborRate, includeLabor?1:0, actualLaborHours, partQuality, repairOutcome, warrantyReturn?1:0, finalCost, published ? 1 : 0, completedAt, clientUpdate, clientUpdateChanged?1:0, assignedTechnician, appointmentAt, internalNotes, id, ownerId)];
    if (status !== current.status) statements.push(db.prepare("INSERT INTO repair_events (id,repair_id,title,detail) VALUES (?,?,?,?)").bind(crypto.randomUUID(), id, `Status changed to ${status}`, status === "Completed" ? "Repair closed and certificate made ready." : "Workshop status updated."));
    if(clientUpdateChanged)statements.push(db.prepare("INSERT INTO repair_client_updates (id,repair_id,status,message) VALUES (?,?,?,?)").bind(crypto.randomUUID(),id,status,clientUpdate));
    await db.batch(statements);
    await syncRepairContribution(ownerId,id);
    return Response.json({ repair: await getRepair(id,false,ownerId) },{headers:privateHeaders});
  } catch (error) { return apiError(error,"Could not update repair"); }
}

export async function DELETE(request: Request, context: Context) {
  try { assertSameOrigin(request);await ensureRepairDatabase(); const { id } = await context.params; const ownerId=await ownerIdFromRequest(request); const current=await getRepair(id,false,ownerId);if(!current)return Response.json({error:"Repair not found"},{status:404});await removeRepairContribution(ownerId,id);const db=database();const photos=await db.prepare("SELECT object_key FROM repair_photos WHERE repair_id=?").bind(id).all<{object_key:string}>();if(env.BUCKET&&photos.results.length)await env.BUCKET.delete(photos.results.map((photo)=>photo.object_key));await db.batch([db.prepare("DELETE FROM repair_ai_sources WHERE estimate_id IN (SELECT id FROM repair_ai_estimates WHERE repair_id=?)").bind(id),db.prepare("DELETE FROM repair_ai_estimates WHERE repair_id=?").bind(id),db.prepare("DELETE FROM repair_guides WHERE repair_id=?").bind(id),db.prepare("DELETE FROM repair_ifixit_guides WHERE repair_id=?").bind(id),db.prepare("DELETE FROM repair_tests WHERE repair_id=?").bind(id),db.prepare("DELETE FROM repair_parts WHERE repair_id=?").bind(id),db.prepare("DELETE FROM repair_photos WHERE repair_id=?").bind(id),db.prepare("DELETE FROM repair_events WHERE repair_id=?").bind(id),db.prepare("DELETE FROM repair_client_updates WHERE repair_id=?").bind(id),db.prepare("DELETE FROM repair_notifications WHERE repair_id=?").bind(id),db.prepare("DELETE FROM repairs WHERE id=? AND owner_id=?").bind(id,ownerId)]); return new Response(null,{status:204,headers:privateHeaders}); }
  catch (error) { return apiError(error,"Could not delete repair"); }
}
