import { normalized } from "./repair-ai";
import { database, ensureRepairDatabase } from "./server-repairs";

type Row = Record<string, unknown>;

export type ShopSettings = {
  shopName: string;
  shareRepairData: boolean;
  countryCode: string;
  currency: "EUR";
  defaultLaborRate: number;
  includeLaborByDefault: boolean;
  marketplaceEnabled: boolean;
  marketplaceCity: string;
  marketplaceRegion: string;
  marketplaceAddressLabel: string;
  marketplaceLatitude: number | null;
  marketplaceLongitude: number | null;
  marketplaceRadiusKm: number;
  sharedRepairCount: number;
};

type IntelligenceRow = {
  id: string;
  modelKey: string;
  faults: Array<{ key: string; label: string }>;
  partCost: number | null;
  laborHours: number | null;
  laborRate: number | null;
  totalPrice: number | null;
  countryCode: string;
  outcome: string;
  warrantyReturn: boolean;
};

const DEFAULT_SETTINGS = {
  shopName: "Rush Electronics",
  shareRepairData: false,
  countryCode: "PT",
  currency: "EUR" as const,
  defaultLaborRate: 38,
  includeLaborByDefault: true,
  marketplaceEnabled: false,
  marketplaceCity: "",
  marketplaceRegion: "",
  marketplaceAddressLabel: "",
  marketplaceLatitude: null,
  marketplaceLongitude: null,
  marketplaceRadiusKm: 30,
};

function finitePositive(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : null;
}

function safeModelLabel(value: string) {
  const cleaned = value
    .replace(/\b(?:imei|serial|s\/?n)\s*[:#-]?\s*[a-z0-9-]{5,}\b/gi, "")
    .replace(/\b[a-f0-9]{12,}\b/gi, "")
    .replace(/\b\d{10,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return cleaned || "Unrecognized model";
}

function sanitizedFaults(row: Row) {
  const output: Array<{ key: string; label: string }> = [];
  try {
    const parsed = JSON.parse(String(row.faults_json ?? "[]"));
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const key = normalized(String(record.key ?? "")).slice(0, 40);
        const label = String(record.label ?? "Detected fault").replace(/[\r\n]+/g, " ").trim().slice(0, 80);
        if (key) output.push({ key, label });
      }
    }
  } catch {
    // Legacy rows use the single fault columns below.
  }
  if (!output.length) {
    const keys = String(row.fault_key ?? "diagnostic").split("|").map((key) => normalized(key)).filter(Boolean);
    const labels = String(row.fault_label ?? "Problem needs diagnosis").split("·").map((label) => label.trim());
    keys.forEach((key, index) => output.push({ key, label: labels[index] || labels[0] || "Detected fault" }));
  }
  return output.slice(0, 8);
}

export async function getShopSettings(ownerId: string): Promise<ShopSettings> {
  await ensureRepairDatabase();
  const db = database();
  let row=await db.prepare("SELECT * FROM shop_settings WHERE owner_id=?").bind(ownerId).first<Row>();
  if(!row){
    await db.prepare(`INSERT OR IGNORE INTO shop_settings
      (owner_id,shop_name,share_repair_data,country_code,currency,default_labor_rate,include_labor_by_default,marketplace_enabled,marketplace_city,marketplace_region,marketplace_address_label,marketplace_radius_km)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(ownerId, "Rush Electronics", 0, "PT", "EUR", 38, 1, 0, "", "", "", 30).run();
    row=await db.prepare("SELECT * FROM shop_settings WHERE owner_id=?").bind(ownerId).first<Row>();
  }
  const count=await db.prepare("SELECT COUNT(*) AS count FROM repair_contribution_links WHERE owner_id=?").bind(ownerId).first<Row>();
  return {
    shopName: String(row?.shop_name ?? DEFAULT_SETTINGS.shopName),
    shareRepairData: Boolean(row?.share_repair_data ?? DEFAULT_SETTINGS.shareRepairData),
    countryCode: String(row?.country_code ?? DEFAULT_SETTINGS.countryCode),
    currency: "EUR",
    defaultLaborRate: Number(row?.default_labor_rate ?? DEFAULT_SETTINGS.defaultLaborRate),
    includeLaborByDefault: Boolean(row?.include_labor_by_default ?? DEFAULT_SETTINGS.includeLaborByDefault),
    marketplaceEnabled: Boolean(row?.marketplace_enabled ?? DEFAULT_SETTINGS.marketplaceEnabled),
    marketplaceCity: String(row?.marketplace_city ?? DEFAULT_SETTINGS.marketplaceCity),
    marketplaceRegion: String(row?.marketplace_region ?? DEFAULT_SETTINGS.marketplaceRegion),
    marketplaceAddressLabel: String(row?.marketplace_address_label ?? DEFAULT_SETTINGS.marketplaceAddressLabel),
    marketplaceLatitude: row?.marketplace_latitude === null || row?.marketplace_latitude === undefined ? null : Number(row.marketplace_latitude),
    marketplaceLongitude: row?.marketplace_longitude === null || row?.marketplace_longitude === undefined ? null : Number(row.marketplace_longitude),
    marketplaceRadiusKm: Number(row?.marketplace_radius_km ?? DEFAULT_SETTINGS.marketplaceRadiusKm),
    sharedRepairCount: Number(count?.count ?? 0),
  };
}

export async function removeAllContributions(ownerId: string) {
  await ensureRepairDatabase();
  const db = database();
  await db.batch([
    db.prepare("DELETE FROM repair_intelligence_records WHERE id IN (SELECT contribution_id FROM repair_contribution_links WHERE owner_id=?)").bind(ownerId),
    db.prepare("DELETE FROM repair_contribution_links WHERE owner_id=?").bind(ownerId),
  ]);
}

export async function removeRepairContribution(ownerId: string, repairId: string) {
  await ensureRepairDatabase();
  const db = database();
  await db.batch([
    db.prepare("DELETE FROM repair_intelligence_records WHERE id IN (SELECT contribution_id FROM repair_contribution_links WHERE owner_id=? AND repair_id=?)").bind(ownerId, repairId),
    db.prepare("DELETE FROM repair_contribution_links WHERE owner_id=? AND repair_id=?").bind(ownerId, repairId),
  ]);
}

export async function syncRepairContribution(ownerId: string, repairId: string) {
  await ensureRepairDatabase();
  const db = database();
  const settings = await getShopSettings(ownerId);
  if (!settings.shareRepairData) {
    await removeRepairContribution(ownerId, repairId);
    return false;
  }

  const row = await db.prepare(`SELECT r.*,e.recognized_model,e.fault_key,e.fault_label,e.faults_json,
    COALESCE((SELECT SUM(p.cost * p.quantity) FROM repair_parts p WHERE p.repair_id=r.id),0) AS recorded_part_cost
    FROM repairs r LEFT JOIN repair_ai_estimates e ON e.repair_id=r.id
    WHERE r.id=? AND r.owner_id=?`).bind(repairId, ownerId).first<Row>();
  if (!row || String(row.status) !== "Completed") {
    await removeRepairContribution(ownerId, repairId);
    return false;
  }

  const link = await db.prepare("SELECT contribution_id FROM repair_contribution_links WHERE owner_id=? AND repair_id=?").bind(ownerId, repairId).first<Row>();
  const contributionId = String(link?.contribution_id ?? crypto.randomUUID());
  const displayModel = safeModelLabel(String(row.recognized_model ?? row.device ?? "Unrecognized model"));
  const modelKey = normalized(displayModel).slice(0, 120);
  const faults = sanitizedFaults(row);
  const partCost = finitePositive(row.recorded_part_cost);
  const laborHours = finitePositive(row.actual_labor_hours);
  const laborRate = Boolean(row.include_labor) && laborHours !== null ? finitePositive(row.labor_rate) : null;
  const totalPrice = finitePositive(row.final_cost);
  const repairDate = String(row.completed_at ?? row.updated_at ?? new Date().toISOString());

  await db.batch([
    db.prepare(`INSERT OR REPLACE INTO repair_intelligence_records
      (id,model_key,display_model,category,faults_json,part_cost,labor_hours,labor_rate,total_price,currency,country_code,part_quality,outcome,warranty_return,repair_date,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,COALESCE((SELECT created_at FROM repair_intelligence_records WHERE id=?),CURRENT_TIMESTAMP),CURRENT_TIMESTAMP)`)
      .bind(contributionId, modelKey, displayModel, String(row.category ?? "Other"), JSON.stringify(faults), partCost, laborHours, laborRate, totalPrice, settings.currency, settings.countryCode, String(row.part_quality ?? "Unspecified"), String(row.repair_outcome ?? "Successful"), Boolean(row.warranty_return) ? 1 : 0, repairDate, contributionId),
    db.prepare(`INSERT INTO repair_contribution_links (repair_id,owner_id,contribution_id)
      VALUES (?,?,?) ON CONFLICT(repair_id) DO UPDATE SET owner_id=excluded.owner_id,contribution_id=excluded.contribution_id`)
      .bind(repairId, ownerId, contributionId),
  ]);
  return true;
}

export async function syncAllContributions(ownerId: string) {
  await ensureRepairDatabase();
  const result = await database().prepare("SELECT id FROM repairs WHERE owner_id=? AND status='Completed'").bind(ownerId).all<Row>();
  let synced = 0;
  for (const row of result.results) if (await syncRepairContribution(ownerId, String(row.id))) synced += 1;
  return synced;
}

export async function updateShopSettings(ownerId: string, input: Omit<ShopSettings, "sharedRepairCount">) {
  await ensureRepairDatabase();
  const db = database();
  await db.prepare(`INSERT INTO shop_settings
    (owner_id,shop_name,share_repair_data,country_code,currency,default_labor_rate,include_labor_by_default,marketplace_enabled,marketplace_city,marketplace_region,marketplace_address_label,marketplace_latitude,marketplace_longitude,marketplace_radius_km,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(owner_id) DO UPDATE SET
      shop_name=excluded.shop_name,share_repair_data=excluded.share_repair_data,country_code=excluded.country_code,
      currency=excluded.currency,default_labor_rate=excluded.default_labor_rate,
      include_labor_by_default=excluded.include_labor_by_default,marketplace_enabled=excluded.marketplace_enabled,
      marketplace_city=excluded.marketplace_city,marketplace_region=excluded.marketplace_region,
      marketplace_address_label=excluded.marketplace_address_label,marketplace_latitude=excluded.marketplace_latitude,
      marketplace_longitude=excluded.marketplace_longitude,marketplace_radius_km=excluded.marketplace_radius_km,updated_at=CURRENT_TIMESTAMP`)
    .bind(ownerId, input.shopName, input.shareRepairData ? 1 : 0, input.countryCode, "EUR", input.defaultLaborRate, input.includeLaborByDefault ? 1 : 0, input.marketplaceEnabled ? 1 : 0, input.marketplaceCity, input.marketplaceRegion, input.marketplaceAddressLabel, input.marketplaceLatitude, input.marketplaceLongitude, input.marketplaceRadiusKm).run();
  if (input.shareRepairData) await syncAllContributions(ownerId);
  else await removeAllContributions(ownerId);
  return getShopSettings(ownerId);
}

function rowToIntelligence(row: Row): IntelligenceRow {
  return {
    id: String(row.id),
    modelKey: String(row.model_key ?? ""),
    faults: sanitizedFaults(row),
    partCost: finitePositive(row.part_cost),
    laborHours: finitePositive(row.labor_hours),
    laborRate: finitePositive(row.labor_rate),
    totalPrice: finitePositive(row.total_price),
    countryCode: String(row.country_code ?? ""),
    outcome: String(row.outcome ?? "Pending"),
    warrantyReturn: Boolean(row.warranty_return),
  };
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const value = sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  return Math.round(value * 100) / 100;
}

function metric(rows: IntelligenceRow[], field: "partCost" | "laborHours" | "laborRate" | "totalPrice") {
  const values = rows.map((row) => row[field]).filter((value): value is number => value !== null);
  return { count: values.length, median: percentile(values, .5), p25: percentile(values, .25), p75: percentile(values, .75) };
}

function summarize(rows: IntelligenceRow[], matchType: "exact-fault" | "model-only" | "none") {
  const outcomes = rows.filter((row) => row.outcome !== "Pending");
  const successes = outcomes.filter((row) => row.outcome === "Successful").length;
  return {
    sampleSize: rows.length,
    countryCount: new Set(rows.map((row) => row.countryCode).filter(Boolean)).size,
    confidence: rows.length >= 50 ? "High" : rows.length >= 15 ? "Medium" : rows.length >= 5 ? "Low" : rows.length ? "Emerging" : "None",
    matchType,
    partCost: metric(rows, "partCost"),
    laborHours: metric(rows, "laborHours"),
    laborRate: metric(rows, "laborRate"),
    totalPrice: metric(rows, "totalPrice"),
    successRate: outcomes.length ? Math.round((successes / outcomes.length) * 100) : null,
    warrantyReturnRate: rows.length ? Math.round((rows.filter((row) => row.warrantyReturn).length / rows.length) * 100) : null,
  };
}

function matchingRows(rows: IntelligenceRow[], targetFaults: string[]) {
  const meaningfulFaults = targetFaults.filter((key) => key && key !== "diagnostic");
  if (meaningfulFaults.length) {
    const exact = rows.filter((row) => row.faults.some((fault) => meaningfulFaults.includes(fault.key)));
    if (exact.length) return { rows: exact, matchType: "exact-fault" as const };
  }
  if (rows.length) return { rows, matchType: "model-only" as const };
  return { rows: [], matchType: "none" as const };
}

export async function getRepairIntelligence(ownerId: string, repairId: string) {
  await ensureRepairDatabase();
  const db = database();
  const repair = await db.prepare(`SELECT r.*,e.recognized_model,e.fault_key,e.fault_label,e.faults_json,e.guide_url
    FROM repairs r LEFT JOIN repair_ai_estimates e ON e.repair_id=r.id
    WHERE r.id=? AND r.owner_id=?`).bind(repairId, ownerId).first<Row>();
  if (!repair) return null;

  const displayModel = safeModelLabel(String(repair.recognized_model ?? repair.device));
  const modelKey = normalized(displayModel).slice(0, 120);
  const targetFaults = sanitizedFaults(repair).map((fault) => fault.key);
  const settings = await getShopSettings(ownerId);
  const [networkResult, ownResult, ownLinks, globalCount, selectedGuide] = await Promise.all([
    db.prepare("SELECT * FROM repair_intelligence_records WHERE model_key=? AND currency=? ORDER BY datetime(repair_date) DESC LIMIT 1000").bind(modelKey, settings.currency).all<Row>(),
    db.prepare(`SELECT r.id,r.device AS display_model,r.category,r.actual_labor_hours AS labor_hours,
      CASE WHEN r.include_labor=1 THEN r.labor_rate ELSE NULL END AS labor_rate,
      CASE WHEN r.final_cost>0 THEN r.final_cost ELSE NULL END AS total_price,
      r.repair_outcome AS outcome,r.warranty_return,r.completed_at AS repair_date,
      e.recognized_model,e.fault_key,e.fault_label,e.faults_json,
      CASE WHEN COALESCE((SELECT SUM(p.cost*p.quantity) FROM repair_parts p WHERE p.repair_id=r.id),0)>0
        THEN (SELECT SUM(p.cost*p.quantity) FROM repair_parts p WHERE p.repair_id=r.id) ELSE NULL END AS part_cost,
      ? AS country_code
      FROM repairs r LEFT JOIN repair_ai_estimates e ON e.repair_id=r.id
      WHERE r.owner_id=? AND r.status='Completed' ORDER BY datetime(r.completed_at) DESC LIMIT 1000`).bind(settings.countryCode, ownerId).all<Row>(),
    db.prepare("SELECT contribution_id FROM repair_contribution_links WHERE owner_id=?").bind(ownerId).all<Row>(),
    db.prepare("SELECT COUNT(*) AS count FROM repair_intelligence_records").first<Row>(),
    db.prepare("SELECT title,url,match_level FROM repair_ifixit_guides WHERE repair_id=? AND selected=1").bind(repairId).first<Row>(),
  ]);

  const ownContributionIds = new Set(ownLinks.results.map((row) => String(row.contribution_id)));
  const externalRows = networkResult.results.map(rowToIntelligence).filter((row) => !ownContributionIds.has(row.id));
  const ownRows = ownResult.results.map((row) => rowToIntelligence({
    ...row,
    id: row.id,
    model_key: normalized(safeModelLabel(String(row.recognized_model ?? row.display_model ?? ""))),
    country_code: settings.countryCode,
  })).filter((row) => row.modelKey === modelKey);
  const regionalRows = externalRows.filter((row) => row.countryCode === settings.countryCode);
  const ownMatch = matchingRows(ownRows, targetFaults);
  const regionalMatch = matchingRows(regionalRows, targetFaults);
  const networkMatch = matchingRows(externalRows, targetFaults);
  const guideUrl = String(selectedGuide?.url ?? repair.guide_url ?? "");

  return {
    repairId,
    model: displayModel,
    faults: sanitizedFaults(repair),
    currency: settings.currency,
    countryCode: settings.countryCode,
    dataSharingEnabled: settings.shareRepairData,
    sharedRepairCount: settings.sharedRepairCount,
    globalRecordCount: Number(globalCount?.count ?? 0),
    ownShop: summarize(ownMatch.rows, ownMatch.matchType),
    regional: summarize(regionalMatch.rows, regionalMatch.matchType),
    network: summarize(networkMatch.rows, networkMatch.matchType),
    guide: {
      url: guideUrl || `https://www.ifixit.com/Search?query=${encodeURIComponent(`${displayModel} ${targetFaults.join(" ")}`)}`,
      source:selectedGuide ? String(selectedGuide.title) : guideUrl ? "Unconfirmed iFixit suggestion" : "iFixit guide search",
      exactMatch:String(selectedGuide?.match_level ?? "") === "Exact",
    },
  };
}
