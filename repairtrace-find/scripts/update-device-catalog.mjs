import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL="https://storage.googleapis.com/play_public/supported_devices.csv";
const outputPath=resolve(dirname(fileURLToPath(import.meta.url)),"../lib/generated/google-play-devices.ts");

function parseCsv(value){
  const rows=[];let row=[];let field="";let quoted=false;
  for(let index=0;index<value.length;index+=1){
    const character=value[index];
    if(quoted){
      if(character==='"'&&value[index+1]==='"'){field+='"';index+=1;}
      else if(character==='"')quoted=false;
      else field+=character;
    }else if(character==='"')quoted=true;
    else if(character===","){row.push(field);field="";}
    else if(character==="\n"){row.push(field.replace(/\r$/,"").trim());rows.push(row);row=[];field="";}
    else field+=character;
  }
  if(field||row.length){row.push(field.replace(/\r$/,"").trim());rows.push(row);}
  return rows;
}

function normalize(value){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function slug(value){return normalize(value).replaceAll(" ","-").slice(0,58)||"device";}
function hash(value){let result=2166136261;for(const character of value){result^=character.codePointAt(0)??0;result=Math.imul(result,16777619);}return (result>>>0).toString(36);}

const knownBrands=new Map(Object.entries({
  "acer":"Acer","alcatel":"Alcatel","amazon":"Amazon","asus":"ASUS","blackberry":"BlackBerry","bq":"BQ","dji":"DJI","fairphone":"Fairphone","google":"Google","hmd global":"Nokia","honor":"Honor","htc":"HTC","huawei":"Huawei","lenovo":"Lenovo","lge":"LG","lg electronics":"LG","meizu":"Meizu","motorola":"Motorola","nothing":"Nothing","nvidia":"NVIDIA","oneplus":"OnePlus","oppo":"OPPO","realme":"Realme","samsung":"Samsung","sony":"Sony","tcl":"TCL","tct alcatel":"Alcatel","tct (alcatel)":"Alcatel","vivo":"Vivo","xiaomi":"Xiaomi","zte":"ZTE"
}));
function brandName(value){
  const trimmed=value.replace(/\s+/g," ").trim();if(!trimmed)return "";
  const key=normalize(trimmed);if(knownBrands.has(key))return knownBrands.get(key);
  if(trimmed===trimmed.toUpperCase()&&trimmed.length>4)return trimmed.toLowerCase().replace(/\b\w/g,character=>character.toUpperCase());
  return trimmed.slice(0,60);
}

function categoryFor(value){
  const text=normalize(value);
  if(/\b(watch|smartwatch|wearable|wrist|fitness band)\b/.test(text))return "Wearable";
  if(/\b(tablet|tab |pad |slate|ebook|e reader)\b/.test(`${text} `))return "Tablet";
  if(/\b(tv|television|bravia|android tv|smart tv|projector|set top|streaming box)\b/.test(text))return "Television";
  if(/\b(camera|camcorder)\b/.test(text))return "Camera";
  if(/\b(console|gaming handheld|shield|quest)\b/.test(text))return "Console";
  if(/\b(speaker|headset|headphone|earbud|audio player)\b/.test(text))return "Audio";
  return "Phone";
}

function isUsefulMarketingName(value,deviceCode,modelCode){
  const name=value.replace(/\s+/g," ").trim();if(name.length<2||name.length>100)return false;
  if(/^(unknown|n\/a|none|null|android|smartphone|mobile device|phone)$/i.test(name))return false;
  const normalizedName=normalize(name);
  const matchesRawCode=normalizedName===normalize(deviceCode)||normalizedName===normalize(modelCode);
  const codeLike=!/\s/.test(name)&&/^(?=.*\d)[a-z0-9_.+-]{5,}$/i.test(name);
  return !(matchesRawCode&&codeLike);
}

const response=await fetch(SOURCE_URL,{headers:{"user-agent":"RepairTrace-Catalog-Updater/1.0"}});
if(!response.ok)throw new Error(`Google Play catalogue download failed (${response.status})`);
const csv=Buffer.from(await response.arrayBuffer()).toString("utf16le").replace(/^\uFEFF/,"");
const rows=parseCsv(csv);const records=new Map();

for(const [rawBrand,marketingName,deviceCode,modelCode] of rows.slice(1)){
  if(!isUsefulMarketingName(marketingName,deviceCode,modelCode))continue;
  const brand=brandName(rawBrand);const rawLabel=marketingName.replace(/\s+/g," ").trim();
  const label=brand&&!normalize(rawLabel).startsWith(normalize(brand))?`${brand} ${rawLabel}`:rawLabel;
  const category=categoryFor(`${brand} ${rawLabel} ${deviceCode} ${modelCode}`);
  const signature=`${normalize(label)}|${category}`;const aliases=[deviceCode,modelCode].map(value=>value.trim()).filter(Boolean);
  const existing=records.get(signature);
  if(existing){for(const alias of aliases)existing.aliases.add(alias);continue;}
  records.set(signature,{key:`gp-${slug(label)}-${hash(signature)}`,label:label.slice(0,120),brand:brand||rawLabel.split(/\s+/)[0].slice(0,60),category,aliases:new Set(aliases)});
}

const devices=[...records.values()].sort((a,b)=>a.label.localeCompare(b.label,"en",{numeric:true,sensitivity:"base"}));
const updated=response.headers.get("last-modified")??new Date().toISOString();
const lines=[
  "// Generated from Google Play's public supported-devices catalogue.",
  `// Source: ${SOURCE_URL}`,
  `// Source last modified: ${updated}`,
  "export type GooglePlayDevice={key:string;label:string;brand:string;category:string;factor:number;aliases:string[];source:\"google-play\"};",
  "const entries:Array<[string,string,string,string,string[]]>=[",
  ...devices.map(device=>`  ${JSON.stringify([device.key,device.label,device.brand,device.category,[...device.aliases].slice(0,6)])},`),
  "];",
  "export const googlePlayDevices:GooglePlayDevice[]=entries.map(([key,label,brand,category,aliases])=>({key,label,brand,category,factor:1,aliases,source:\"google-play\"}));",
  "",
];
await mkdir(dirname(outputPath),{recursive:true});
await writeFile(outputPath,lines.join("\n"),"utf8");
console.log(`Wrote ${devices.length.toLocaleString("en-US")} searchable devices to ${outputPath}`);
