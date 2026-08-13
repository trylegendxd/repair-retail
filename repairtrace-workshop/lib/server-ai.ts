import { database, ensureRepairDatabase, getRepair } from "./server-repairs";
import { researchRepair } from "./repair-ai";

type GenerateOptions={ownerId:string;applyEstimate?:boolean;laborRate?:number;includeLabor?:boolean};

export async function generateAndSaveAiEstimate(repairId:string,options:GenerateOptions){
  await ensureRepairDatabase();
  const repair=await getRepair(repairId,false,options.ownerId);
  if(!repair)throw new Error("Repair not found");
  const requestedRate=Number(options.laborRate);
  const laborRate=Number.isFinite(requestedRate)&&requestedRate>=0&&requestedRate<=1000?requestedRate:repair.laborRate;
  const includeLabor=options.includeLabor??repair.includeLabor;
  const research=await researchRepair({device:repair.device,issue:repair.issue,category:repair.category,laborRate,includeLabor});
  const db=database();
  const estimateId=crypto.randomUUID();
  const statements=[
    db.prepare("DELETE FROM repair_ai_sources WHERE estimate_id IN (SELECT id FROM repair_ai_estimates WHERE repair_id=?)").bind(repairId),
    db.prepare("DELETE FROM repair_ai_estimates WHERE repair_id=?").bind(repairId),
    db.prepare(`INSERT INTO repair_ai_estimates
    (id,repair_id,recognized_model,fault_key,fault_label,recommended_part,faults_json,confidence,confidence_score,part_low,part_typical,part_high,labor_hours,labor_rate,labor_cost,include_labor,quote_low,quote_recommended,quote_high,currency,rationale,guide_url,status,researched_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      estimateId,repairId,research.recognizedModel,research.faultKey,research.faultLabel,research.recommendedPart,JSON.stringify(research.faults),research.confidence,research.confidenceScore,research.partLow,research.partTypical,research.partHigh,research.laborHours,research.laborRate,research.laborCost,research.includeLabor?1:0,research.quoteLow,research.quoteRecommended,research.quoteHigh,research.currency,research.rationale,research.guideUrl,research.status,research.researchedAt,
    ),
    ...research.sources.map((source)=>db.prepare(`INSERT INTO repair_ai_sources
    (id,estimate_id,merchant,title,url,price,currency,is_live,retrieved_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),estimateId,source.merchant,source.title,source.url,source.price,source.currency,source.isLive?1:0,research.researchedAt)),
  ];
  statements.push(db.prepare("INSERT INTO repair_events (id,repair_id,title,detail) VALUES (?,?,?,?)").bind(crypto.randomUUID(),repairId,"AI parts research completed",`${research.faultLabel} · suggested quote €${research.quoteRecommended.toFixed(2)}`));
  statements.push(db.prepare("UPDATE repairs SET labor_rate=?,include_labor=?,estimate=CASE WHEN ?=1 THEN ? ELSE estimate END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?").bind(laborRate,includeLabor?1:0,options.applyEstimate?1:0,research.quoteRecommended,repairId,options.ownerId));
  await db.batch(statements);
  return getRepair(repairId,false,options.ownerId);
}
