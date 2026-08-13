import { hydrateIfixitGuide, scoreIfixitGuideMatch, searchIfixitGuides, type IfixitGuideCandidate } from "./ifixit";
import { detectRepairFaults } from "./repair-ai";
import { database, ensureRepairDatabase, getRepair } from "./server-repairs";

type Row = Record<string, unknown>;

function storedArray(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fromRow(row: Row): IfixitGuideCandidate {
  return {
    guideId:Number(row.guide_id),
    title:String(row.title),
    subject:String(row.subject ?? ""),
    category:String(row.category ?? ""),
    url:String(row.url),
    summary:String(row.summary ?? ""),
    difficulty:String(row.difficulty ?? ""),
    duration:String(row.duration ?? ""),
    matchScore:Number(row.match_score ?? 0),
    matchLevel:String(row.match_level ?? "Possible") as IfixitGuideCandidate["matchLevel"],
    selected:Boolean(row.selected),
    tools:storedArray(row.tools_json).map(String),
    stepCount:Number(row.step_count ?? 0),
    retrievedAt:String(row.retrieved_at),
  };
}

function faultTerms(repair: Awaited<ReturnType<typeof getRepair>>) {
  if (!repair) return "repair";
  const faults = repair.aiEstimate?.faults?.length ? repair.aiEstimate.faults : detectRepairFaults(`${repair.issue} ${repair.diagnosis ?? ""}`);
  const values = faults.flatMap((fault) => [String(fault.label ?? ""), String(fault.recommendedPart ?? "")]).filter(Boolean);
  return values.join(" ") || repair.issue;
}

function primaryRepairTerm(repair: Awaited<ReturnType<typeof getRepair>>) {
  if (!repair) return "repair";
  const faults = repair.aiEstimate?.faults?.length ? repair.aiEstimate.faults : detectRepairFaults(`${repair.issue} ${repair.diagnosis ?? ""}`);
  const terms: Record<string, string> = {
    battery:"battery", screen:"screen", "charge-port":"charging port", "back-glass":"back glass", camera:"camera",
    keyboard:"keyboard", hinge:"hinge", speaker:"speaker", microphone:"microphone", cooling:"fan", joystick:"joystick",
    storage:"storage", liquid:"liquid damage", power:"no power", buttons:"button", connectivity:"antenna",
  };
  return faults.map((fault) => terms[String(fault.key)]).filter(Boolean).slice(0, 2).join(" ") || "repair";
}

async function assertRepair(ownerId: string, repairId: string) {
  const repair = await getRepair(repairId, false, ownerId);
  if (!repair) throw new Error("Repair not found");
  return repair;
}

export async function getIfixitGuideWorkspace(ownerId: string, repairId: string) {
  await ensureRepairDatabase();
  const repair = await assertRepair(ownerId, repairId);
  const result = await database().prepare("SELECT * FROM repair_ifixit_guides WHERE repair_id=? ORDER BY selected DESC, match_score DESC, title").bind(repairId).all<Row>();
  return {
    repairId,
    model:repair.aiEstimate?.recognizedModel || repair.device,
    query:String(result.results[0]?.search_query ?? `${repair.device} ${primaryRepairTerm(repair)}`).slice(0, 180),
    candidates:result.results.map(fromRow),
    searchUrl:`https://www.ifixit.com/Search?query=${encodeURIComponent(`${repair.device} ${primaryRepairTerm(repair)}`)}`,
  };
}

export async function searchAndSaveIfixitGuides(ownerId: string, repairId: string, customQuery?: string) {
  await ensureRepairDatabase();
  const repair = await assertRepair(ownerId, repairId);
  const terms = faultTerms(repair);
  const query = String(customQuery ?? "").trim().slice(0, 180) || `${repair.device} ${primaryRepairTerm(repair)}`;
  let candidates = await searchIfixitGuides({ device:repair.device, faultTerms:terms, query });
  if (!candidates.length) return getIfixitGuideWorkspace(ownerId, repairId);

  const existing = await database().prepare("SELECT guide_id FROM repair_ifixit_guides WHERE repair_id=? AND selected=1").bind(repairId).first<Row>();
  const preservedId = Number(existing?.guide_id ?? 0);
  const selectedIndex = Math.max(0, candidates.findIndex((candidate) => candidate.guideId === preservedId));
  candidates = candidates.map((candidate, index) => ({ ...candidate, selected:index === selectedIndex }));
  candidates[selectedIndex] = await hydrateIfixitGuide(candidates[selectedIndex]);

  const db = database();
  const statements = [db.prepare("DELETE FROM repair_ifixit_guides WHERE repair_id=?").bind(repairId)];
  for (const candidate of candidates) {
    statements.push(db.prepare(`INSERT INTO repair_ifixit_guides
      (id,repair_id,guide_id,title,subject,category,url,summary,difficulty,duration,match_score,match_level,selected,tools_json,specifics_json,step_count,search_query,retrieved_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      crypto.randomUUID(),repairId,candidate.guideId,candidate.title,candidate.subject,candidate.category,candidate.url,candidate.summary,
      candidate.difficulty,candidate.duration,candidate.matchScore,candidate.matchLevel,candidate.selected?1:0,JSON.stringify(candidate.tools),
      "[]",candidate.stepCount,query,candidate.retrievedAt,
    ));
  }
  statements.push(db.prepare("INSERT INTO repair_events (id,repair_id,title,detail) VALUES (?,?,?,?)").bind(
    crypto.randomUUID(),repairId,"iFixit guide matches refreshed",`${candidates.length} guide candidate${candidates.length === 1 ? "" : "s"} checked · ${candidates[selectedIndex].matchLevel.toLowerCase()} primary match`,
  ));
  await db.batch(statements);
  return getIfixitGuideWorkspace(ownerId, repairId);
}

export async function selectIfixitGuide(ownerId: string, repairId: string, guideId: number) {
  await ensureRepairDatabase();
  await assertRepair(ownerId, repairId);
  const db = database();
  const row = await db.prepare("SELECT * FROM repair_ifixit_guides WHERE repair_id=? AND guide_id=?").bind(repairId, guideId).first<Row>();
  if (!row) throw new Error("Guide candidate not found");
  const hydrated = await hydrateIfixitGuide(fromRow(row));
  await db.batch([
    db.prepare("UPDATE repair_ifixit_guides SET selected=0 WHERE repair_id=?").bind(repairId),
    db.prepare(`UPDATE repair_ifixit_guides SET selected=1,title=?,subject=?,category=?,url=?,summary=?,difficulty=?,duration=?,
      tools_json=?,specifics_json=?,step_count=?,retrieved_at=? WHERE repair_id=? AND guide_id=?`).bind(
      hydrated.title,hydrated.subject,hydrated.category,hydrated.url,hydrated.summary,hydrated.difficulty,hydrated.duration,
      JSON.stringify(hydrated.tools),"[]",hydrated.stepCount,hydrated.retrievedAt,repairId,guideId,
    ),
    db.prepare("INSERT INTO repair_events (id,repair_id,title,detail) VALUES (?,?,?,?)").bind(
      crypto.randomUUID(),repairId,"Exact repair reference selected",`${hydrated.title} · complete procedure opens on iFixit`,
    ),
  ]);
  return getIfixitGuideWorkspace(ownerId, repairId);
}

export async function importIfixitGuide(ownerId: string, repairId: string, rawUrl: string) {
  await ensureRepairDatabase();
  const repair = await assertRepair(ownerId, repairId);
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("Enter a valid iFixit guide URL"); }
  if (!(url.hostname === "ifixit.com" || url.hostname.endsWith(".ifixit.com")) || !url.pathname.startsWith("/Guide/")) throw new Error("Enter a valid iFixit guide URL");
  const path = url.pathname.split("/").filter(Boolean);
  const guideId = Number(path.at(-1));
  if (!Number.isInteger(guideId) || guideId <= 0) throw new Error("The iFixit guide URL is missing its numeric guide ID");
  let title = `iFixit guide ${guideId}`;
  try { title = decodeURIComponent(String(path.at(-2) ?? title).replaceAll("+", " ")); } catch { /* Keep the safe fallback title. */ }
  const match = scoreIfixitGuideMatch(repair.device, faultTerms(repair), title);
  const candidate = await hydrateIfixitGuide({
    guideId,title,subject:repair.device,category:repair.device,url:`https://www.ifixit.com/Guide/${path.slice(1).join("/")}`,
    summary:"Technician-supplied exact source URL.",difficulty:"",duration:"",matchScore:match.matchScore,matchLevel:match.matchLevel,
    selected:true,tools:[],stepCount:0,retrievedAt:new Date().toISOString(),
  });
  const db = database();
  await db.batch([
    db.prepare("UPDATE repair_ifixit_guides SET selected=0 WHERE repair_id=?").bind(repairId),
    db.prepare(`INSERT INTO repair_ifixit_guides
      (id,repair_id,guide_id,title,subject,category,url,summary,difficulty,duration,match_score,match_level,selected,tools_json,specifics_json,step_count,search_query,retrieved_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(repair_id,guide_id) DO UPDATE SET title=excluded.title,subject=excluded.subject,category=excluded.category,
      url=excluded.url,summary=excluded.summary,difficulty=excluded.difficulty,duration=excluded.duration,match_score=excluded.match_score,
      match_level=excluded.match_level,selected=1,tools_json=excluded.tools_json,specifics_json=excluded.specifics_json,
      step_count=excluded.step_count,retrieved_at=excluded.retrieved_at`).bind(
      crypto.randomUUID(),repairId,candidate.guideId,candidate.title,candidate.subject,candidate.category,candidate.url,candidate.summary,
      candidate.difficulty,candidate.duration,candidate.matchScore,candidate.matchLevel,1,JSON.stringify(candidate.tools),"[]",
      candidate.stepCount,`${repair.device} ${primaryRepairTerm(repair)}`,candidate.retrievedAt,
    ),
    db.prepare("INSERT INTO repair_events (id,repair_id,title,detail) VALUES (?,?,?,?)").bind(
      crypto.randomUUID(),repairId,"iFixit source URL imported",`${candidate.title} · technician confirmation required`,
    ),
  ]);
  return getIfixitGuideWorkspace(ownerId, repairId);
}

export async function getSelectedIfixitGuide(ownerId: string, repairId: string) {
  await ensureRepairDatabase();
  const row = await database().prepare(`SELECT g.* FROM repair_ifixit_guides g
    JOIN repairs r ON r.id=g.repair_id WHERE g.repair_id=? AND g.selected=1 AND r.owner_id=?`).bind(repairId, ownerId).first<Row>();
  return row ? fromRow(row) : null;
}
