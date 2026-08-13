import { createPublicKey, database, defaultClientMessage, ensureRepairDatabase, getRepair, listRepairs } from "../../../lib/server-repairs";
import { getShopSettings } from "../../../lib/server-intelligence";
import { ownerIdFromRequest } from "../../../lib/server-identity";
import { upsertCustomerForRepair } from "../../../lib/server-operations";
import { apiError, assertSameOrigin, cleanMultiline, cleanText, privateHeaders } from "../../../lib/server-http";

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern=/^[+()\d\s.-]{7,30}$/;
const categories=new Set(["Phone","Laptop","Tablet","Console","Audio","Other"]);

function ticketNumber(id: string) {
  const date = new Date();
  const stamp = `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `RT-${stamp}-${id.slice(0, 8).toUpperCase()}`;
}

export async function GET(request: Request) {
  try { const ownerId=await ownerIdFromRequest(request); return Response.json({ repairs: await listRepairs(ownerId) },{headers:privateHeaders}); }
  catch (error) { return apiError(error,"Could not load repairs"); }
}

export async function POST(request: Request) {
  let ownerId="";
  let intakeKey="";
  try {
    assertSameOrigin(request);
    await ensureRepairDatabase();
    ownerId=await ownerIdFromRequest(request);
    const input = await request.json() as Record<string, unknown>;
    const customer = cleanText(input.customer,160);
    const device = cleanText(input.device,160);
    const issue = cleanMultiline(input.issue,1500);
    if (!customer || !device || !issue) return Response.json({ error: "Customer, device and issue are required." }, { status: 400 });
    intakeKey=String(input.intakeKey??"").trim();
    if(intakeKey&&!/^[A-Za-z0-9_-]{20,100}$/.test(intakeKey))return Response.json({error:"The repair request identifier is invalid."},{status:400});
    if(intakeKey){
      const existing=await database().prepare("SELECT id FROM repairs WHERE owner_id=? AND intake_key=?").bind(ownerId,intakeKey).first<{id:string}>();
      if(existing)return Response.json({repair:await getRepair(String(existing.id),false,ownerId),duplicate:true},{status:200,headers:privateHeaders});
    }
    const id = crypto.randomUUID();
    const ticket = ticketNumber(id);
    const db = database();
    const manualEstimate=Number(input.estimate??0);
    if(!Number.isFinite(manualEstimate)||manualEstimate<0||manualEstimate>1_000_000)return Response.json({error:"Estimate must be between €0 and €1,000,000."},{status:400});
    const shopSettings=await getShopSettings(ownerId);
    const requestedLaborRate=input.laborRate===undefined?shopSettings.defaultLaborRate:Number(input.laborRate);
    if(!Number.isFinite(requestedLaborRate)||requestedLaborRate<0||requestedLaborRate>1000)return Response.json({error:"Hourly labour rate must be between €0 and €1,000."},{status:400});
    const laborRate=requestedLaborRate;
    const includeLabor=input.includeLabor===undefined?shopSettings.includeLaborByDefault:input.includeLabor!==false;
    const clientUpdate=defaultClientMessage("Intake");
    const customerEmail=cleanText(input.customerEmail,200).toLowerCase();
    const customerPhone=cleanText(input.customerPhone,30);
    if(customerEmail&&!emailPattern.test(customerEmail))return Response.json({error:"Enter a valid customer email address."},{status:400});
    if(customerPhone&&!phonePattern.test(customerPhone))return Response.json({error:"Enter a valid customer phone number."},{status:400});
    const category=cleanText(input.category,30);if(!categories.has(category))return Response.json({error:"Choose a valid device category."},{status:400});
    const serialNumber=cleanText(input.serialNumber,100);const due=cleanText(input.due,20);
    const dueDate=due?new Date(`${due}T12:00:00Z`):null;
    if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!dueDate||Number.isNaN(dueDate.valueOf())||dueDate.toISOString().slice(0,10)!==due))return Response.json({error:"Choose a valid due date."},{status:400});
    const customerId=await upsertCustomerForRepair(ownerId,{name:customer,email:customerEmail,phone:customerPhone});
    const insertRepair=db.prepare(`INSERT INTO repairs
      (id,owner_id,intake_key,ticket,customer_name,customer_email,customer_phone,customer_id,device,category,serial_number,issue,diagnosis,status,priority,due,estimate,labor_rate,include_labor,final_cost,warranty_days,published,tracking_key,certificate_key,quote_key,invoice_key,client_update,client_updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(
        id, ownerId, intakeKey, ticket, customer, customerEmail, customerPhone, customerId, device,
        category, serialNumber, issue, "Awaiting diagnosis.", "Intake",
        input.priority === "Priority" ? "Priority" : "Standard", due, manualEstimate, laborRate, includeLabor?1:0, 0, 90, 0,
        createPublicKey("track"),createPublicKey("certificate"),createPublicKey("quote"),createPublicKey("invoice"),clientUpdate,
      );
    const labels = ["Power and charging", "Controls and ports", "Wireless connectivity", "Thermal stability", "Cosmetic inspection"];
    const statements = [insertRepair,...labels.map((label) => db.prepare("INSERT INTO repair_tests (id,repair_id,label,result) VALUES (?,?,?,?)").bind(crypto.randomUUID(), id, label, "pending"))];
    statements.push(db.prepare("INSERT INTO repair_events (id,repair_id,title,detail) VALUES (?,?,?,?)").bind(crypto.randomUUID(), id, "Device checked in", issue));
    statements.push(db.prepare("INSERT INTO repair_client_updates (id,repair_id,status,message) VALUES (?,?,?,?)").bind(crypto.randomUUID(),id,"Intake",clientUpdate));
    await db.batch(statements);
    return Response.json({repair:await getRepair(id,false,ownerId)},{status:201,headers:privateHeaders});
  } catch (error) {
    if(ownerId&&intakeKey){
      try{
        const existing=await database().prepare("SELECT id FROM repairs WHERE owner_id=? AND intake_key=?").bind(ownerId,intakeKey).first<{id:string}>();
        if(existing)return Response.json({repair:await getRepair(String(existing.id),false,ownerId),duplicate:true},{status:200,headers:privateHeaders});
      }catch{/* Return the original create error below. */}
    }
    return apiError(error,"Could not create repair");
  }
}
