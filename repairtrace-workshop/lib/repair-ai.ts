export type PriceSource = {
  merchant: string;
  title: string;
  url: string;
  price: number | null;
  currency: "EUR";
  isLive: boolean;
};

export type DetectedFault = {
  key: string;
  label: string;
  recommendedPart: string;
  matchedTerms: string[];
  confidenceScore: number;
};

export type RepairResearch = {
  recognizedModel: string;
  faultKey: string;
  faultLabel: string;
  recommendedPart: string;
  faults: DetectedFault[];
  confidence: "High" | "Medium" | "Low";
  confidenceScore: number;
  partLow: number;
  partTypical: number;
  partHigh: number;
  laborHours: number;
  laborRate: number;
  laborCost: number;
  includeLabor: boolean;
  quoteLow: number;
  quoteRecommended: number;
  quoteHigh: number;
  currency: "EUR";
  rationale: string;
  guideUrl: string;
  status: "ready" | "review";
  researchedAt: string;
  sources: PriceSource[];
};

type FaultProfile = {
  key: string;
  label: string;
  part: string;
  anchors: string[];
  qualifiers?: string[];
  base: [number, number, number];
  hours: number;
};

type FaultMatch = {
  fault: FaultProfile;
  matchedTerms: string[];
  score: number;
  confidenceScore: number;
};

const faults: FaultProfile[] = [
  { key:"battery", label:"Battery degradation", part:"replacement battery", anchors:["battery","bateria","swollen battery","bateria inchada","battery health","saude da bateria","drain*","descarreg*","holds no charge","nao aguenta carga"], qualifiers:["warm","hot","aquece*","inchad*","rapidamente","quickly"], base:[24,42,65], hours:1 },
  { key:"screen", label:"Display or touch damage", part:"screen assembly", anchors:["screen","display","lcd","oled","amoled","digitizer","touchscreen","touch","ecra","tela","visor","vidro frontal","front glass","screen glass"], qualifiers:["crack*","broken","partid*","quebrad*","rachad*","estilhacad*","sem imagem","no image","linhas","lines","mancha*","toque nao funciona","touch not working"], base:[68,128,220], hours:1.35 },
  { key:"charge-port", label:"Charging-port fault", part:"charging port", anchors:["usb c","usb-c","lightning","charging port","charge port","porta de carga","conector de carga","conector usb","nao carrega","carregamento intermitente","loose connector"], qualifiers:["loose","solto","danificad*","partid*","wont charge","won't charge"], base:[9,22,42], hours:1.75 },
  { key:"back-glass", label:"Rear-glass or housing damage", part:"rear glass or housing", anchors:["back glass","rear glass","back cover","rear cover","tampa traseira","vidro traseiro","capa traseira","carcaca traseira"], qualifiers:["crack*","broken","partid*","quebrad*","rachad*","estilhacad*"], base:[24,52,92], hours:1.5 },
  { key:"camera", label:"Camera module fault", part:"camera assembly", anchors:["camera","camara","lens","lente"], qualifiers:["focus","foco","blur*","desfoc*","trem*","partid*","quebrad*","nao abre","black image"], base:[34,82,165], hours:1.1 },
  { key:"keyboard", label:"Keyboard or top-case fault", part:"keyboard or top case", anchors:["keyboard","keycap","teclado","tecla*","top case"], qualifiers:["nao funciona","not working","pres*","sticky","pegajos*","partid*","solt*"], base:[44,96,175], hours:2.2 },
  { key:"hinge", label:"Hinge or headband damage", part:"hinge or headband assembly", anchors:["hinge","headband","dobradica","arco dos auscultadores"], qualifiers:["broken","partid*","quebrad*","solt*","loose","crack*"], base:[12,28,55], hours:1.1 },
  { key:"speaker", label:"Speaker or audio fault", part:"speaker assembly", anchors:["speaker","earpiece","altifalante","auscultador","som","audio"], qualifiers:["baixo","sem som","no sound","distorcid*","chiad*","crackling"], base:[16,38,72], hours:1 },
  { key:"microphone", label:"Microphone fault", part:"microphone or flex assembly", anchors:["microphone","microfone","mic"], qualifiers:["baixo","nao funciona","not working","abafad*","muffled","ruido"], base:[14,34,68], hours:1.1 },
  { key:"cooling", label:"Cooling-system fault", part:"fan and thermal service kit", anchors:["fan","ventoinha","overheat*","sobreaquec*","temperatura alta","thermal","aquece*"], qualifiers:["hot","quente","ruido","noise","desliga","shuts down"], base:[18,45,88], hours:1.4 },
  { key:"joystick", label:"Controller drift", part:"joystick module", anchors:["drift","joystick","analog stick","analogico","manipulo"], qualifiers:["moves alone","mexe sozinho","preso","stuck"], base:[8,18,32], hours:1.15 },
  { key:"storage", label:"Storage fault", part:"storage drive", anchors:["ssd","hard drive","storage","disk","drive","disco","armazenamento"], qualifiers:["failed","avariad*","not detected","nao detetad*","lento","slow"], base:[35,74,135], hours:1 },
  { key:"liquid", label:"Liquid-damage service", part:"cleaning materials and affected component", anchors:["liquid","water","spill","corrosion","agua","liquido","molhado","humidade"], qualifiers:["oxid*","derram*","caiu","entrou"], base:[12,26,65], hours:2.5 },
  { key:"power", label:"Power or board-level fault", part:"power-management or board-level component", anchors:["nao liga","sem energia","no power","wont turn on","won't turn on","dead device","placa mae","motherboard","logic board"], qualifiers:["desliga","shuts down","reinicia","restarts","intermitente"], base:[18,68,180], hours:2 },
  { key:"buttons", label:"Button or switch fault", part:"button or flex assembly", anchors:["power button","volume button","home button","botao power","botao volume","botao home","interruptor"], qualifiers:["preso","stuck","partid*","nao funciona","not working","afundad*"], base:[8,24,54], hours:1 },
  { key:"connectivity", label:"Wireless connectivity fault", part:"antenna or wireless module", anchors:["wifi","wi fi","bluetooth","wireless","antena","rede sem fios"], qualifiers:["nao liga","nao conecta","not connecting","fraco","weak","sem sinal","no signal"], base:[10,38,95], hours:1.4 },
];

const genericFault: FaultProfile = { key:"diagnostic", label:"Problem needs diagnosis", part:"diagnostic-dependent replacement part", anchors:[], base:[15,48,110], hours:1.5 };

export function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9+]+/g, " ").replace(/\s+/g, " ").trim();
}

function euro(value: number) { return Math.round(value * 100) / 100; }

function signalMatches(text: string, tokens: string[], rawSignal: string) {
  const wildcard = rawSignal.endsWith("*");
  const signal = normalized(wildcard ? rawSignal.slice(0, -1) : rawSignal);
  if (!signal) return false;
  if (wildcard) return tokens.some((token) => token.startsWith(signal));
  return ` ${text} `.includes(` ${signal} `);
}

function matchedSignals(text: string, tokens: string[], signals: string[]) {
  return signals.filter((signal) => signalMatches(text, tokens, signal)).map((signal) => signal.replace(/\*$/, ""));
}

export function detectFaults(issue: string): FaultMatch[] {
  const text = normalized(issue);
  const tokens = text.split(" ").filter(Boolean);
  const ranked = faults.map((fault) => {
    const anchors = matchedSignals(text, tokens, fault.anchors);
    const qualifiers = matchedSignals(text, tokens, fault.qualifiers ?? []);
    const matchedTerms = [...new Set([...anchors, ...qualifiers])];
    const score = anchors.length * 3 + qualifiers.length;
    const confidenceScore = Math.min(.96, euro(.58 + Math.min(.3, anchors.length * .14 + qualifiers.length * .05)));
    return { fault, matchedTerms, score, confidenceScore };
  }).filter((match) => match.score >= 3).sort((a, b) => b.score - a.score);

  if (ranked.length) return ranked.slice(0, 4);
  return [{ fault:genericFault, matchedTerms:[], score:0, confidenceScore:.42 }];
}

export function detectRepairFaults(issue: string): DetectedFault[] {
  return detectFaults(issue).map((match) => ({
    key: match.fault.key,
    label: match.fault.label,
    recommendedPart: match.fault.part,
    matchedTerms: match.matchedTerms,
    confidenceScore: match.confidenceScore,
  }));
}

function deviceMultiplier(device: string, category: string, faultKey: string) {
  const text = normalized(`${device} ${category}`);
  let multiplier = 1;
  if (/pro max|ultra|fold|macbook|surface|ipad pro/.test(text)) multiplier += .22;
  if (/laptop|macbook|notebook/.test(text) && faultKey === "screen") multiplier += .45;
  if (/sony wh|headphone|audio|headset/.test(text)) multiplier -= .18;
  if (/switch|playstation|xbox|console/.test(text) && faultKey !== "screen") multiplier -= .08;
  return Math.max(.7, multiplier);
}

function slug(value: string) {
  return normalized(value).replace(/\+/g,"plus").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

function productCandidates(device: string, fault: FaultProfile) {
  const deviceSlug = slug(device);
  const withoutSamsung = slug(device.replace(/^samsung\s+/i,""));
  const partSlug = slug(fault.part.replace(/^replacement\s+/,""));
  const candidates = new Set<string>([`${deviceSlug}-${partSlug}`, `${withoutSamsung}-${partSlug}`]);
  if (fault.key === "screen") { candidates.add(`${deviceSlug}-screen`); candidates.add(`${withoutSamsung}-screen`); }
  if (fault.key === "battery") candidates.add(`${deviceSlug}-battery`);
  if (fault.key === "charge-port") { candidates.add(`${deviceSlug}-usb-c-port`); candidates.add(`${deviceSlug}-console-usb-c-port`); }
  if (/nintendo switch oled/i.test(device) && fault.key === "charge-port") candidates.add("nintendo-switch-oled-console-usb-c-port");
  return [...candidates].filter(Boolean).slice(0, 4).map((item)=>`https://www.ifixit.com/en-eu/products/${item}`);
}

function findProduct(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) { for (const item of value) { const found=findProduct(item); if(found)return found; } return null; }
  if (!value || typeof value !== "object") return null;
  const row=value as Record<string,unknown>;
  if (row["@type"] === "Product" || (Array.isArray(row["@type"]) && row["@type"].includes("Product"))) return row;
  for (const child of Object.values(row)) { const found=findProduct(child); if(found)return found; }
  return null;
}

async function fetchIfixitProduct(url: string): Promise<PriceSource | null> {
  try {
    const response = await fetch(url,{headers:{accept:"text/html","user-agent":"RepairTrace/1.0 parts-research"},signal:AbortSignal.timeout(3500),redirect:"follow"});
    if (!response.ok) return null;
    const html=await response.text();
    const scripts=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const match of scripts) {
      try {
        const product=findProduct(JSON.parse(match[1].trim())); if(!product)continue;
        const offers=Array.isArray(product.offers)?product.offers[0]:product.offers as Record<string,unknown>|undefined;
        const price=Number(offers?.price ?? offers?.lowPrice); const currency=String(offers?.priceCurrency??"EUR");
        if (Number.isFinite(price) && price>0 && currency==="EUR") return {merchant:"iFixit EU",title:String(product.name??"Compatible replacement part"),url:response.url,price:euro(price),currency:"EUR",isLive:true};
      } catch { /* Ignore malformed structured-data blocks. */ }
    }
    const title=html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim();
    const priceText=html.match(/(?:€|&euro;)\s*([0-9]+(?:[.,][0-9]{2})?)/i)?.[1];
    const price=priceText?Number(priceText.replace(",",".")):NaN;
    return title&&Number.isFinite(price)?{merchant:"iFixit EU",title,url:response.url,price:euro(price),currency:"EUR",isLive:true}:null;
  } catch { return null; }
}

async function recognizeWithIfixit(device: string, fault: FaultProfile) {
  try {
    const response=await fetch(`https://www.ifixit.com/api/2.0/suggest/${encodeURIComponent(`${device} ${fault.label}`)}?doctypes=guide&langid=en`,{headers:{accept:"application/json"},signal:AbortSignal.timeout(3500)});
    if(!response.ok)return null;
    const body=await response.json() as {results?:Array<Record<string,unknown>>};
    const deviceTokens=new Set(normalized(device).split(" ").filter((token)=>token.length>1));
    const variantMarkers=["pro","max","plus","ultra","mini","air","fold","flip","oled"];
    const deviceText=` ${normalized(device)} `;
    const ranked=(body.results??[]).filter((item)=>{
      const type=normalized(String(item.dataType??item.datatype??item.type??"guide"));
      return (!type||type.includes("guide"))&&Number.isInteger(Number(item.guideid??item.guideId??item.id));
    }).map((item)=>{
      const candidate=String(item.display_title??item.title??item.subject??item.category??"");
      const candidateText=` ${normalized(`${candidate} ${String(item.subject??"")} ${String(item.category??"")}`)} `;
      const tokens=candidateText.trim().split(" ");
      const score=tokens.filter((token)=>deviceTokens.has(token)).length;
      const variantConflict=variantMarkers.some((marker)=>deviceText.includes(` ${marker} `)!==candidateText.includes(` ${marker} `));
      return {item,candidate,score:score-(variantConflict?3:0),variantConflict};
    }).sort((a,b)=>b.score-a.score);
    const winner=ranked[0]; if(!winner||winner.variantConflict||winner.score<Math.max(2,Math.ceil(deviceTokens.size*.65)))return null;
    const guideId=Number(winner.item.guideid??winner.item.guideId??winner.item.id);
    const rawUrl=String(winner.item.url??"");
    const guideUrl=/^https:\/\/(?:www\.)?ifixit\.com\/Guide\//i.test(rawUrl)?rawUrl:rawUrl.startsWith("/Guide/")?`https://www.ifixit.com${rawUrl}`:`https://www.ifixit.com/Guide/${guideId}`;
    return {model:device,guideUrl};
  } catch { return null; }
}

function firstEuroPrice(value:string){
  const match=value.match(/€\s*([0-9]{1,4}(?:[.,][0-9]{2})?)|([0-9]{1,4}(?:[.,][0-9]{2})?)\s*€/);
  const parsed=Number((match?.[1]??match?.[2]??"").replace(",","."));
  return Number.isFinite(parsed)&&parsed>=3&&parsed<=2500?euro(parsed):null;
}

function collectSearchRows(value:unknown,rows:Array<Record<string,unknown>>){
  if(Array.isArray(value)){value.forEach((item)=>collectSearchRows(item,rows));return;}
  if(!value||typeof value!=="object")return;
  const row=value as Record<string,unknown>;
  if(typeof row.url==="string"&&(typeof row.title==="string"||typeof row.content==="string"))rows.push(row);
  Object.values(row).forEach((item)=>collectSearchRows(item,rows));
}

async function searchWebListings(query:string):Promise<PriceSource[]>{
  try{
    const searchUrl=`https://s.jina.ai/${encodeURIComponent(`${query} price EUR`)}?site=ifixit.com&site=ebay.pt&site=amazon.es&site=aliexpress.com`;
    const response=await fetch(searchUrl,{headers:{accept:"application/json","x-retain-images":"none","x-max-tokens":"4500"},signal:AbortSignal.timeout(5000)});
    if(!response.ok)return[];
    const body=await response.json() as unknown;const rows:Array<Record<string,unknown>>=[];collectSearchRows(body,rows);
    const requiredTokens=normalized(query).split(" ").filter((token)=>token.length>2&&!/[a-z]*replacement|part/.test(token));
    const seen=new Set<string>();const listings:PriceSource[]=[];
    for(const row of rows){
      const url=String(row.url??"");if(seen.has(url))continue;
      let host="";try{host=new URL(url).hostname.replace(/^www\./,"");}catch{continue;}
      if(!["ifixit.com","ebay.pt","amazon.es","aliexpress.com"].some((domain)=>host===domain||host.endsWith(`.${domain}`)))continue;
      const title=String(row.title??"Compatible replacement part");const content=`${title} ${String(row.description??"")} ${String(row.content??"")}`;
      const matchCount=requiredTokens.filter((token)=>normalized(content).includes(token)).length;
      const price=firstEuroPrice(content);if(price===null||matchCount<Math.min(2,requiredTokens.length))continue;
      const merchant=host.includes("ifixit")?"iFixit EU":host.includes("ebay")?"eBay":host.includes("amazon")?"Amazon":"AliExpress";
      // Search snippets are useful comparison leads, but are not a verified live price.
      listings.push({merchant,title,url,price,currency:"EUR",isLive:false});seen.add(url);if(listings.length>=4)break;
    }
    return listings;
  }catch{return[];}
}

function comparisonSources(query: string, part: string): PriceSource[] {
  const q=encodeURIComponent(query);
  return [
    {merchant:"iFixit EU",title:`Search ${part}`,url:`https://www.ifixit.com/Search?query=${q}`,price:null,currency:"EUR",isLive:false},
    {merchant:"eBay",title:`Compare ${part} from EU sellers`,url:`https://www.ebay.pt/sch/i.html?_nkw=${q}&LH_BIN=1`,price:null,currency:"EUR",isLive:false},
    {merchant:"Amazon",title:`Search ${part} on Amazon Spain`,url:`https://www.amazon.es/s?k=${q}`,price:null,currency:"EUR",isLive:false},
    {merchant:"AliExpress",title:`Compare aftermarket ${part}`,url:`https://www.aliexpress.com/wholesale?SearchText=${q}`,price:null,currency:"EUR",isLive:false},
    {merchant:"Google Shopping",title:`Compare ${part} prices`,url:`https://www.google.com/search?tbm=shop&q=${q}`,price:null,currency:"EUR",isLive:false},
  ];
}

async function researchFaultPricing(device:string,category:string,match:FaultMatch){
  const fault=match.fault; const query=`${device} ${fault.part}`;
  const [recognition,listingResults,webListings]=await Promise.all([
    recognizeWithIfixit(device,fault),
    Promise.all(productCandidates(device,fault).map(fetchIfixitProduct)),
    searchWebListings(query),
  ]);
  const liveListing=listingResults.find((item):item is PriceSource=>Boolean(item));
  const multiplier=deviceMultiplier(device,category,fault.key);
  let [partLow,partTypical,partHigh]=fault.base.map((value)=>euro(value*multiplier)) as [number,number,number];
  const verifiedListings=(liveListing?[liveListing]:[]).filter((item)=>item.price!==null);
  const comparisonListings=webListings.filter((item)=>item.price!==null);
  if(verifiedListings.length){
    const prices=verifiedListings.map((item)=>item.price as number).sort((a,b)=>a-b);const marketPrice=prices[Math.floor(prices.length/2)];
    partTypical=marketPrice;partLow=euro(Math.min(...prices,marketPrice*.78));partHigh=euro(Math.max(...prices,marketPrice*1.18));
  }
  const sources=comparisonSources(query,fault.part);
  for(const listing of [...verifiedListings,...comparisonListings]){const index=sources.findIndex((source)=>source.merchant===listing.merchant);if(index>=0)sources[index]=listing;else sources.unshift(listing);}
  return {match,recognition,partLow,partTypical,partHigh,verifiedListings,sources};
}

export async function researchRepair(input:{device:string;issue:string;category?:string;laborRate?:number;includeLabor?:boolean}):Promise<RepairResearch>{
  const matches=detectFaults(input.issue); const category=input.category||"Other";
  const results=await Promise.all(matches.map((match)=>researchFaultPricing(input.device,category,match)));
  const partLow=euro(results.reduce((sum,item)=>sum+item.partLow,0));
  const partTypical=euro(results.reduce((sum,item)=>sum+item.partTypical,0));
  const partHigh=euro(results.reduce((sum,item)=>sum+item.partHigh,0));
  const rawHours=matches.reduce((sum,match,index)=>sum+match.fault.hours*(index===0?1:.72),0);
  const laborHours=euro(rawHours*(input.device.toLowerCase().includes("fold")?1.25:1));
  const requestedRate=Number(input.laborRate); const laborRate=Number.isFinite(requestedRate)&&requestedRate>=0&&requestedRate<=1000?euro(requestedRate):38;
  const includeLabor=input.includeLabor!==false; const laborCost=includeLabor?euro(laborRate*laborHours):0;
  const shopMargin=.12; const quoteLow=euro(partLow+laborCost); const quoteRecommended=euro(Math.max(quoteLow,partTypical*(1+shopMargin)+laborCost)); const quoteHigh=euro(Math.max(quoteRecommended,partHigh*1.08+laborCost));
  const pricedListingCount=results.reduce((sum,item)=>sum+item.verifiedListings.length,0);
  const recognitionCount=results.filter((item)=>item.recognition).length;
  const baseConfidence=matches.reduce((sum,match)=>sum+match.confidenceScore,0)/matches.length;
  let confidenceScore=Math.min(.96,euro(baseConfidence+(recognitionCount?0.06:0)+(pricedListingCount?0.05:0)));
  if(!pricedListingCount)confidenceScore=Math.min(confidenceScore,.69);
  if(matches.some((match)=>match.fault.key==="diagnostic"))confidenceScore=Math.min(confidenceScore,.55);
  const confidence=confidenceScore>=.78?"High":confidenceScore>=.58?"Medium":"Low";
  const sourceMap=new Map<string,PriceSource>();
  results.flatMap((item)=>item.sources).forEach((source)=>{const current=sourceMap.get(source.url);if(!current||(!current.isLive&&source.isLive))sourceMap.set(source.url,source);});
  const recognizedModel=results.find((item)=>item.recognition)?.recognition?.model||input.device;
  const detectedFaults=matches.map((match)=>({key:match.fault.key,label:match.fault.label,recommendedPart:match.fault.part,matchedTerms:match.matchedTerms,confidenceScore:match.confidenceScore}));
  const exactMatches=matches.filter((match)=>match.fault.key!=="diagnostic");
  const issueSummary=exactMatches.length>1?`${exactMatches.length} distinct problems were detected`:(exactMatches.length===1?`${exactMatches[0].fault.label.toLowerCase()} was detected`:"no exact fault pattern was detected, so a diagnostic estimate was prepared");
  const priceSummary=pricedListingCount?`${pricedListingCount} verified live part price${pricedListingCount===1?" was":"s were"} found`:"comparison links were prepared, but no verified live part price was found";
  const laborSummary=includeLabor?`labour is calculated at €${laborRate.toFixed(2)}/h`:`labour hours are estimated but excluded from the quote`;
  return {
    recognizedModel,
    faultKey:matches.map((match)=>match.fault.key).join("|"),
    faultLabel:matches.map((match)=>match.fault.label).join(" · "),
    recommendedPart:matches.map((match)=>match.fault.part).join(" + "),
    faults:detectedFaults,
    confidence,confidenceScore,partLow,partTypical,partHigh,laborHours,laborRate,laborCost,includeLabor,quoteLow,quoteRecommended,quoteHigh,currency:"EUR",
    rationale:`RepairTrace analysed the full issue description for ${recognizedModel}: ${issueSummary}; ${priceSummary}; ${laborSummary}. The suggested quote includes a modest parts-handling margin.`,
    guideUrl:results.find((item)=>item.recognition?.guideUrl)?.recognition?.guideUrl||"",
    status:confidence==="Low"?"review":"ready",researchedAt:new Date().toISOString(),sources:[...sourceMap.values()].slice(0,24),
  };
}
