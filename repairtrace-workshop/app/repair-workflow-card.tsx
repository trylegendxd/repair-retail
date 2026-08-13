"use client";

export type RepairWorkflowAction =
  | "research"
  | "apply_estimate"
  | "activate_quote"
  | "open_quote"
  | "review_quote"
  | "plan_bench"
  | "start_repair"
  | "open_inventory"
  | "mark_ready"
  | "notify_customer"
  | "complete_repair"
  | "create_invoice"
  | "issue_certificate"
  | "open_invoice"
  | "done";

type WorkflowRepair = {
  status: "Intake" | "Diagnosing" | "Waiting for part" | "Ready" | "Completed";
  diagnosis?: string;
  estimate: number;
  aiEstimate?: { quoteRecommended?:number } | null;
  quoteStatus?: "draft" | "sent" | "approved" | "declined";
  invoiceStatus?: "not_created" | "draft" | "sent" | "paid" | "void";
  published?: boolean;
  assignedTechnician?: string;
  appointmentAt?: string;
  customerEmail?: string;
  customerPhone?: string;
  notifications?: Array<{ status:string }>;
};

type Step = { label:string; done:boolean };
type Recommendation = { action:RepairWorkflowAction; eyebrow:string; title:string; detail:string; label:string };

function isUsefulDiagnosis(value?:string){
  const normalized=(value??"").trim().toLowerCase();
  return Boolean(normalized&&!normalized.startsWith("awaiting diagnosis"));
}

function getRecommendation(repair:WorkflowRepair):Recommendation{
  const diagnosisReady=Boolean(repair.aiEstimate)||isUsefulDiagnosis(repair.diagnosis)||repair.status!=="Intake";
  const suggestedEstimate=repair.aiEstimate?.quoteRecommended??0;
  const hasDelivery=Boolean(repair.notifications?.some(item=>item.status==="sent"||item.status==="queued"));
  const hasContact=Boolean(repair.customerEmail||repair.customerPhone);

  if(repair.status==="Completed"){
    if(!repair.invoiceStatus||repair.invoiceStatus==="not_created"||repair.invoiceStatus==="void")return {action:"create_invoice",eyebrow:"PAYMENT",title:"Create the invoice draft",detail:"The repair is complete. Prepare the final payment record from the recorded repair price.",label:"Create invoice"};
    if(!repair.published)return {action:"issue_certificate",eyebrow:"WARRANTY",title:"Issue the warranty certificate",detail:"Publish the recorded procedures, fitted parts and final checks for after-service proof.",label:"Review certificate"};
    if(repair.invoiceStatus==="draft"||repair.invoiceStatus==="sent")return {action:"open_invoice",eyebrow:"PAYMENT",title:"Finish the payment hand-off",detail:"Open the invoice record to send it or confirm payment when received.",label:"Open invoice"};
    return {action:"done",eyebrow:"COMPLETE",title:"Repair hand-off complete",detail:"The repair, payment record and warranty proof are connected and up to date.",label:"All done"};
  }
  if(!diagnosisReady)return {action:"research",eyebrow:"DIAGNOSIS",title:"Identify faults and price the repair",detail:"Run problem detection, compatible-parts research and a labour-aware estimate.",label:"Run AI diagnosis"};
  if(repair.estimate<=0&&suggestedEstimate>0)return {action:"apply_estimate",eyebrow:"PRICING",title:"Apply the suggested estimate",detail:`Use the AI parts-and-labour calculation of €${suggestedEstimate.toFixed(2)} as the customer quote total.`,label:`Use €${suggestedEstimate.toFixed(2)}`};
  if(repair.estimate<=0)return {action:"research",eyebrow:"PRICING",title:"Calculate a repair estimate",detail:"Refresh parts and labour research before preparing the customer quote.",label:"Refresh estimate"};
  if(!repair.quoteStatus||repair.quoteStatus==="draft")return {action:"activate_quote",eyebrow:"CUSTOMER APPROVAL",title:"Send the price for approval",detail:"Create one private link where the customer can approve or decline the current estimate.",label:"Activate quote"};
  if(repair.quoteStatus==="sent")return {action:"open_quote",eyebrow:"CUSTOMER APPROVAL",title:"Waiting for the customer",detail:"Open or copy the approval link to follow up. Their response will sync back automatically.",label:"Open approval link"};
  if(repair.quoteStatus==="declined")return {action:"review_quote",eyebrow:"QUOTE DECLINED",title:"Review the repair scope",detail:"Adjust the diagnosis, parts or labour before preparing a revised customer quote.",label:"Review estimate"};
  if(repair.status==="Waiting for part")return {action:"open_inventory",eyebrow:"PARTS",title:"Resolve the parts blocker",detail:"Check stock levels, supplier details and compatible SKUs before returning the job to the bench.",label:"Open inventory"};
  if(!repair.assignedTechnician&&!repair.appointmentAt)return {action:"plan_bench",eyebrow:"WORKSHOP PLAN",title:"Assign the repair",detail:"Choose a technician, bench time and any private instructions for the workshop.",label:"Plan bench work"};
  if(repair.status==="Intake")return {action:"start_repair",eyebrow:"BENCH",title:"Start the approved repair",detail:"Move this job into active diagnosis and repair work.",label:"Start repair"};
  if(repair.status==="Diagnosing")return {action:"mark_ready",eyebrow:"QUALITY CHECK",title:"Finish the bench work",detail:"Complete final checks, then mark the device ready for customer collection.",label:"Mark ready"};
  if(repair.status==="Ready"&&hasContact&&!hasDelivery)return {action:"notify_customer",eyebrow:"CUSTOMER HAND-OFF",title:"Tell the customer it is ready",detail:"Send the private tracking link by every configured contact channel.",label:"Notify customer"};
  return {action:"complete_repair",eyebrow:"CUSTOMER HAND-OFF",title:"Complete the repair record",detail:"Confirm collection or hand-off, then prepare payment and warranty records.",label:"Mark completed"};
}

export default function RepairWorkflowCard({repair,saving,onAction,onGuide,onCustomer,onInventory}:{repair:WorkflowRepair;saving:boolean;onAction:(action:RepairWorkflowAction)=>void;onGuide:()=>void;onCustomer:()=>void;onInventory:()=>void}){
  const finished=repair.status==="Completed";
  const diagnosisDone=finished||Boolean(repair.aiEstimate)||isUsefulDiagnosis(repair.diagnosis)||repair.status!=="Intake";
  const approvalDone=finished||repair.quoteStatus==="approved";
  const repairDone=finished||repair.status==="Ready";
  const steps:Step[]=[
    {label:"Received",done:true},
    {label:"Diagnose",done:diagnosisDone},
    {label:"Approve",done:approvalDone},
    {label:"Repair",done:repairDone},
    {label:"Finish",done:finished},
  ];
  const recommendation=getRecommendation(repair);
  const current=Math.min(steps.findIndex(step=>!step.done),steps.length-1);

  return <section className="repair-journey" aria-label="Repair progress and next action">
    <header>
      <span><small>GUIDED WORKFLOW</small><h3>Repair journey</h3></span>
      <em>{steps.filter(step=>step.done).length}/{steps.length} complete</em>
    </header>
    <ol>{steps.map((step,index)=><li className={step.done?"done":index===current?"current":""} key={step.label}><b>{step.done?"✓":index+1}</b><span>{step.label}</span></li>)}</ol>
    <div className="next-best-action">
      <span className="next-action-mark">{recommendation.action==="done"?"✓":"→"}</span>
      <span><small>{recommendation.eyebrow} · NEXT BEST ACTION</small><strong>{recommendation.title}</strong><p>{recommendation.detail}</p></span>
      <button disabled={saving||recommendation.action==="done"} onClick={()=>onAction(recommendation.action)}>{saving?"Updating…":recommendation.label}</button>
    </div>
    <div className="journey-shortcuts" aria-label="Repair shortcuts">
      <button onClick={onGuide}>▤ Repair guide</button>
      <button onClick={onCustomer}>⌁ Customer link</button>
      <button onClick={onInventory}>▦ Parts & stock</button>
    </div>
  </section>;
}
