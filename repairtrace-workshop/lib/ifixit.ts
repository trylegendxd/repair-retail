import { normalized } from "./repair-ai";

export type IfixitMatchLevel = "Exact" | "Strong" | "Possible";

export type IfixitGuideCandidate = {
  guideId: number;
  title: string;
  subject: string;
  category: string;
  url: string;
  summary: string;
  difficulty: string;
  duration: string;
  matchScore: number;
  matchLevel: IfixitMatchLevel;
  selected: boolean;
  tools: string[];
  stepCount: number;
  retrievedAt: string;
};

type Row = Record<string, unknown>;

const variantMarkers = ["pro", "max", "plus", "ultra", "mini", "air", "fold", "flip", "oled", "slim"];
const ignoredFaultWords = new Set(["fault", "damage", "damaged", "replacement", "replace", "repair", "assembly", "problem", "needs", "service", "or", "and", "the", "a"]);

function cleanText(value: unknown, limit = 280) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function asRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter((item): item is Row => Boolean(item) && typeof item === "object");
  if (!value || typeof value !== "object") return [];
  const body = value as Row;
  for (const key of ["results", "guides", "data", "items"]) {
    if (Array.isArray(body[key])) return asRows(body[key]);
  }
  return [];
}

function canonicalGuideUrl(value: unknown, guideId: number) {
  const raw = String(value ?? "").trim();
  if (/^https:\/\/(?:www\.)?ifixit\.com\/Guide\//i.test(raw)) return raw;
  if (/^\/Guide\//i.test(raw)) return `https://www.ifixit.com${raw}`;
  return `https://www.ifixit.com/Guide/${guideId}`;
}

function tokens(value: string) {
  return normalized(value).split(" ").filter((token) => token.length > 1);
}

export function scoreIfixitGuideMatch(device: string, faultTerms: string, candidateText: string) {
  const deviceTokens = [...new Set(tokens(device))];
  const candidateTokens = new Set(tokens(candidateText));
  const faultTokens = [...new Set(tokens(faultTerms).filter((token) => token.length > 2 && !ignoredFaultWords.has(token)))];
  const modelMatches = deviceTokens.filter((token) => candidateTokens.has(token)).length;
  const faultMatches = faultTokens.filter((token) => candidateTokens.has(token)).length;
  const modelCoverage = deviceTokens.length ? modelMatches / deviceTokens.length : 0;
  const faultCoverage = faultTokens.length ? faultMatches / Math.min(faultTokens.length, 3) : 0;
  const deviceText = ` ${normalized(device)} `;
  const resultText = ` ${normalized(candidateText)} `;
  const variantConflict = variantMarkers.some((marker) => deviceText.includes(` ${marker} `) !== resultText.includes(` ${marker} `));
  const score = Math.max(0, Math.min(1, modelCoverage * .72 + Math.min(1, faultCoverage) * .28 - (variantConflict ? .32 : 0)));
  const matchLevel: IfixitMatchLevel = !variantConflict && modelCoverage >= .98 && (faultMatches > 0 || !faultTokens.length)
    ? "Exact"
    : !variantConflict && modelCoverage >= .68 && faultMatches > 0
      ? "Strong"
      : "Possible";
  return { matchScore:Math.round(score * 100) / 100, matchLevel };
}

async function fetchJson(url: string, timeout = 11000) {
  const response = await fetch(url, {
    headers:{ accept:"application/json", "user-agent":"RepairTrace/1.0 guide-matcher" },
    signal:AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`iFixit returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function searchIfixitGuides(input: { device: string; faultTerms: string; query?: string }) {
  const query = cleanText(input.query || `${input.device} ${input.faultTerms}`, 160);
  if (!query) return [];
  const params = new URLSearchParams({ doctypes:"guide", langid:"en" });
  const body = await fetchJson(`https://www.ifixit.com/api/2.0/suggest/${encodeURIComponent(query)}?${params}`);
  const seen = new Set<number>();
  const candidates: IfixitGuideCandidate[] = [];
  for (const row of asRows(body)) {
    const dataType = normalized(String(row.dataType ?? row.datatype ?? row.type ?? "guide"));
    const guideId = Number(row.guideid ?? row.guideId ?? row.guide_id ?? row.id);
    if (!Number.isInteger(guideId) || guideId <= 0 || (dataType && !dataType.includes("guide"))) continue;
    if (seen.has(guideId)) continue;
    const title = cleanText(row.display_title ?? row.title ?? row.name, 180);
    const subject = cleanText(row.subject ?? row.device ?? row.category, 120);
    const category = cleanText(row.category ?? row.device ?? row.subject, 120);
    if (!title) continue;
    const match = scoreIfixitGuideMatch(input.device, input.faultTerms, `${title} ${subject} ${category}`);
    candidates.push({
      guideId,
      title,
      subject:subject || input.device,
      category,
      url:canonicalGuideUrl(row.url, guideId),
      summary:cleanText(row.summary ?? row.description, 320),
      difficulty:cleanText(row.difficulty, 60),
      duration:cleanText(row.time_required ?? row.duration, 60),
      matchScore:match.matchScore,
      matchLevel:match.matchLevel,
      selected:false,
      tools:[],
      stepCount:0,
      retrievedAt:new Date().toISOString(),
    });
    seen.add(guideId);
  }
  return candidates.sort((a, b) => b.matchScore - a.matchScore || a.title.localeCompare(b.title)).slice(0, 6);
}

function guideObject(value: unknown): Row {
  if (!value || typeof value !== "object") return {};
  const row = value as Row;
  if (row.guide && typeof row.guide === "object") return row.guide as Row;
  return row;
}

function toolNames(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  const names = rows.map((item) => {
    if (typeof item === "string") return cleanText(item, 100);
    if (!item || typeof item !== "object") return "";
    const row = item as Row;
    return cleanText(row.text ?? row.name ?? row.title, 100);
  }).filter(Boolean);
  return [...new Set(names)].slice(0, 20);
}

export async function hydrateIfixitGuide(candidate: IfixitGuideCandidate) {
  try {
    const raw = await fetchJson(`https://www.ifixit.com/api/2.0/guides/${candidate.guideId}`, 15000);
    const guide = guideObject(raw);
    const steps = asRows(guide.steps);
    return {
      ...candidate,
      title:cleanText(guide.title, 180) || candidate.title,
      subject:cleanText(guide.subject, 120) || candidate.subject,
      category:cleanText(guide.category, 120) || candidate.category,
      summary:cleanText(guide.introduction ?? guide.summary ?? guide.description, 320) || candidate.summary,
      difficulty:cleanText(guide.difficulty, 60) || candidate.difficulty,
      duration:cleanText(guide.time_required ?? guide.duration, 60) || candidate.duration,
      url:canonicalGuideUrl(guide.url, candidate.guideId),
      tools:toolNames(guide.tools),
      stepCount:steps.length,
      retrievedAt:new Date().toISOString(),
    } satisfies IfixitGuideCandidate;
  } catch {
    return candidate;
  }
}
