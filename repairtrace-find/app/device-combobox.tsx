"use client";

import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export type DeviceSuggestion={key:string;label:string;brand:string;category:string;source?:"repairtrace"|"google-play"};

export default function DeviceCombobox({value,onChange,onSelect,placeholder="Start typing a brand or model…",required=false,autoFocus=false}:{value:string;onChange:(value:string)=>void;onSelect:(device:DeviceSuggestion)=>void;placeholder?:string;required?:boolean;autoFocus?:boolean}){
  const [suggestions,setSuggestions]=useState<DeviceSuggestion[]>([]);
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(-1);
  const [status,setStatus]=useState<"idle"|"loading"|"ready"|"error">("idle");
  const [catalogSize,setCatalogSize]=useState(0);
  const listId=useId();
  const requestId=useRef(0);

  useEffect(()=>{
    if(!open)return;
    const current=++requestId.current;const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      try{
        if(current===requestId.current)setStatus("loading");
        const response=await fetch(`/api/devices?q=${encodeURIComponent(value)}`,{signal:controller.signal});
        const data=await response.json() as {devices?:DeviceSuggestion[];catalogSize?:number;error?:string};
        if(!response.ok)throw new Error(data.error||"Device search failed");
        if(current===requestId.current){setSuggestions(data.devices??[]);setCatalogSize(Number(data.catalogSize)||0);setActive(-1);setStatus("ready");}
      }catch(error){
        if(current===requestId.current&&!(error instanceof DOMException&&error.name==="AbortError")){setSuggestions([]);setStatus("error");}
      }
    },120);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[value,open]);

  function choose(device:DeviceSuggestion){onSelect(device);setOpen(false);setActive(-1);}
  function onKeyDown(event:KeyboardEvent<HTMLInputElement>){
    if(!open&&(event.key==="ArrowDown"||event.key==="ArrowUp")){setOpen(true);return;}
    if(event.key==="ArrowDown"){event.preventDefault();setActive(current=>Math.min(suggestions.length-1,current+1));}
    else if(event.key==="ArrowUp"){event.preventDefault();setActive(current=>Math.max(0,current-1));}
    else if(event.key==="Enter"&&active>=0){event.preventDefault();choose(suggestions[active]);}
    else if(event.key==="Escape"){setOpen(false);setActive(-1);}
  }

  return <div className="device-combobox">
    <input value={value} onChange={event=>{onChange(event.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} onBlur={()=>window.setTimeout(()=>setOpen(false),120)} onKeyDown={onKeyDown} placeholder={placeholder} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={active>=0?`${listId}-${active}`:undefined} autoComplete="off" required={required} autoFocus={autoFocus}/>
    {open&&<div className="device-suggestions" id={listId} role={suggestions.length?"listbox":undefined}>
      {status==="loading"&&<div className="suggestion-state"><span className="spinner dark"/>Searching the device catalogue…</div>}
      {status==="error"&&<div className="suggestion-state error">Catalogue search is temporarily unavailable. You can still type the model manually.</div>}
      {status==="ready"&&suggestions.length===0&&<div className="suggestion-state">No exact match. Keep your typed model and choose its device type.</div>}
      {status==="ready"&&suggestions.map((device,index)=><button type="button" role="option" aria-selected={active===index} id={`${listId}-${index}`} className={active===index?"active":""} key={device.key} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(device)}><span><strong>{device.label}</strong><small>{device.brand} · {device.category} · {device.source==="google-play"?"Google Play catalogue":"RepairTrace verified"}</small></span><i>Choose</i></button>)}
      {status==="ready"&&<div className="catalog-note">{catalogSize?`${new Intl.NumberFormat().format(catalogSize)} searchable models · `:""}Custom models are always accepted.</div>}
    </div>}
  </div>;
}
