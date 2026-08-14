import { deviceModels, type DeviceModel } from "./repair-catalog.ts";
import { googlePlayDevices } from "./generated/google-play-devices.ts";

export type CatalogDevice=DeviceModel&{source:"repairtrace"|"google-play"};

function normalize(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}

const curatedLabels=new Set(deviceModels.map(model=>`${normalize(model.label)}|${model.category}`));
const sourceAliases=new Map<string,string[]>();
for(const model of googlePlayDevices){
  const key=`${normalize(model.label)}|${model.category}`;
  sourceAliases.set(key,[...new Set([...(sourceAliases.get(key)??[]),...model.aliases])]);
}
const combined:CatalogDevice[]=[
  ...deviceModels.map(model=>({...model,aliases:[...new Set([...(model.aliases??[]),...(sourceAliases.get(`${normalize(model.label)}|${model.category}`)??[])])],source:"repairtrace" as const})),
  ...googlePlayDevices.filter(model=>!curatedLabels.has(`${normalize(model.label)}|${model.category}`)),
];
const indexed=combined.map((model,index)=>{
  const label=normalize(model.label);const brand=normalize(model.brand);const aliases=normalize((model.aliases??[]).join(" "));
  return {model,label,brand,index,haystack:`${label} ${brand} ${aliases} ${model.key.replaceAll("-"," ")}`};
});

export const deviceCatalogSize=combined.length;
const popularKeys=["iphone-16","iphone-15-pro","iphone-14","galaxy-s24","samsung-galaxy-s25-ultra","google-pixel-9","macbook-air-m2","playstation-5","xbox-series-x","nintendo-switch-oled"];

export function searchAllDeviceModels(query:string,limit=15):CatalogDevice[]{
  const needle=normalize(query);const safeLimit=Math.min(25,Math.max(1,limit));
  if(!needle)return popularKeys.map(key=>combined.find(model=>model.key===key)).filter(Boolean).slice(0,safeLimit) as CatalogDevice[];
  const tokens=needle.split(/\s+/).filter(Boolean);
  return indexed.map(item=>{
    if(!tokens.every(token=>item.haystack.includes(token)))return {...item,score:-1};
    const words=item.label.split(" ");let score=tokens.reduce((total,token)=>total+(words.some(word=>word.startsWith(token))?22:8),0);
    const labelWithoutBrand=item.brand&&item.label.startsWith(`${item.brand} `)?item.label.slice(item.brand.length+1):item.label;
    if(item.label===needle||labelWithoutBrand===needle)score+=240;
    else if(item.label.startsWith(needle)||labelWithoutBrand.startsWith(needle))score+=125;
    else if(item.label.includes(needle))score+=70;
    if(item.brand===needle)score+=25;if(item.model.source==="repairtrace")score+=12;
    return {...item,score};
  }).filter(item=>item.score>=0).sort((a,b)=>b.score-a.score||a.index-b.index||a.model.label.localeCompare(b.model.label)).slice(0,safeLimit).map(item=>item.model);
}
