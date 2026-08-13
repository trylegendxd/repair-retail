import { generateRepairGuide } from "./repair-guide";
import { getSelectedIfixitGuide } from "./server-ifixit";
import { database, ensureRepairDatabase, getRepair } from "./server-repairs";

export async function generateAndSaveRepairGuide(repairId: string, ownerId: string) {
  await ensureRepairDatabase();
  const repair = await getRepair(repairId, false, ownerId);
  if (!repair) throw new Error("Repair not found");
  const sourceGuide = await getSelectedIfixitGuide(ownerId, repairId);

  const faults = (repair.aiEstimate?.faults ?? []).map((fault) => ({
    key:String(fault.key ?? "diagnostic"),
    label:String(fault.label ?? "Problem needs diagnosis"),
    recommendedPart:String(fault.recommendedPart ?? "diagnostic-dependent replacement part"),
    matchedTerms:Array.isArray(fault.matchedTerms) ? fault.matchedTerms.map(String) : [],
    confidenceScore:Number(fault.confidenceScore ?? .42),
  }));
  const guide = generateRepairGuide({
    device:repair.device,
    category:repair.category,
    issue:repair.issue,
    diagnosis:repair.diagnosis,
    recognizedModel:repair.aiEstimate?.recognizedModel,
    guideUrl:repair.aiEstimate?.guideUrl,
    laborHours:repair.aiEstimate?.laborHours,
    faults,
    recordedParts:repair.parts.map((part) => ({ name:part.name, sku:part.sku, quantity:part.quantity })),
    sourceGuide,
  });
  const id = crypto.randomUUID();
  const db = database();
  await db.batch([
    db.prepare(`INSERT INTO repair_guides
      (id,repair_id,recognized_model,title,difficulty,estimated_minutes,risk_level,overview,tools_json,parts_json,precautions_json,steps_json,source_url,source_label,source_guide_id,source_match_level,source_checked_at,verified_detail_count,generated_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(repair_id) DO UPDATE SET
        id=excluded.id,recognized_model=excluded.recognized_model,title=excluded.title,difficulty=excluded.difficulty,
        estimated_minutes=excluded.estimated_minutes,risk_level=excluded.risk_level,overview=excluded.overview,
        tools_json=excluded.tools_json,parts_json=excluded.parts_json,precautions_json=excluded.precautions_json,
        steps_json=excluded.steps_json,source_url=excluded.source_url,source_label=excluded.source_label,
        source_guide_id=excluded.source_guide_id,source_match_level=excluded.source_match_level,
        source_checked_at=excluded.source_checked_at,verified_detail_count=excluded.verified_detail_count,
        generated_at=excluded.generated_at,updated_at=excluded.updated_at`).bind(
      id,repairId,guide.recognizedModel,guide.title,guide.difficulty,guide.estimatedMinutes,guide.riskLevel,guide.overview,
      JSON.stringify(guide.tools),JSON.stringify(guide.parts),JSON.stringify(guide.precautions),JSON.stringify(guide.steps),
      guide.sourceUrl,guide.sourceLabel,guide.sourceGuideId,guide.sourceMatchLevel,guide.sourceCheckedAt,0,guide.generatedAt,guide.generatedAt,
    ),
    db.prepare("INSERT INTO repair_events (id,repair_id,title,detail) VALUES (?,?,?,?)").bind(
      crypto.randomUUID(),repairId,"Custom repair guide generated",`${guide.title} · ${guide.steps.length} workshop checkpoints`,
    ),
  ]);
  return getRepair(repairId, false, ownerId);
}
