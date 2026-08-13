"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Tracking={
  shopName:string;ticket:string;customerFirstName:string;device:string;status:string;due:string;
  currentUpdate:string;clientUpdatedAt:string;createdAt:string;warrantyDays:number;certificatePath:string|null;
  updates:Array<{id:string;status:string;message:string;createdAt:string}>;
};

const stages=[
  {status:"Intake",label:"Checked in"},
  {status:"Diagnosing",label:"Diagnosis"},
  {status:"Waiting for part",label:"Parts"},
  {status:"Ready",label:"Ready"},
  {status:"Completed",label:"Completed"},
];

function formatDate(value:string,withTime=true) {
  const date=new Date(value);
  if (Number.isNaN(date.getTime())) return value||"Not scheduled";
  return new Intl.DateTimeFormat("en-GB",withTime?{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}:{day:"numeric",month:"long",year:"numeric"}).format(date);
}

export default function TrackingView({token}:{token:string}) {
  const [tracking,setTracking]=useState<Tracking|null>(null);
  const [error,setError]=useState("");
  const [refreshing,setRefreshing]=useState(false);
  const activeRequest=useRef<AbortController|null>(null);
  const load=useCallback(async(silent=false)=>{
    activeRequest.current?.abort();const controller=new AbortController();activeRequest.current=controller;
    if(!silent)setRefreshing(true);
    try{
      const response=await fetch(`/api/tracking/${encodeURIComponent(token)}`,{cache:"no-store",signal:controller.signal});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Tracking link unavailable");
      setTracking(data.tracking);setError("");
    }catch(reason){if(!(reason instanceof DOMException&&reason.name==="AbortError"))setError(reason instanceof Error?reason.message:"Tracking link unavailable");}
    finally{if(activeRequest.current===controller){activeRequest.current=null;if(!silent)setRefreshing(false);}}
  },[token]);
  useEffect(()=>{const initial=window.setTimeout(()=>void load(),0);const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load(true);},30000);return()=>{activeRequest.current?.abort();window.clearTimeout(initial);window.clearInterval(timer);};},[load]);
  const currentIndex=useMemo(()=>Math.max(0,stages.findIndex((stage)=>stage.status===tracking?.status)),[tracking?.status]);
  if(error&&!tracking)return <main className="tracking-page"><section className="tracking-error"><span>!</span><small>PRIVATE REPAIR LINK</small><h1>This tracking link is unavailable</h1><p>{error}</p><button onClick={()=>load()} disabled={refreshing}>{refreshing?"Checking…":"Try again"}</button></section></main>;
  if(!tracking)return <main className="tracking-page"><section className="tracking-loading"><span/><strong>Loading the latest workshop update…</strong></section></main>;
  return <main className="tracking-page">
    <section className="tracking-shell">
      <header className="tracking-header"><div className="tracking-brand"><span>✓</span><div><strong>{tracking.shopName}</strong><small>Repair status powered by RepairTrace</small></div></div><em><i/> LIVE RECORD</em></header>
      <section className="tracking-welcome"><small>HELLO {tracking.customerFirstName.toUpperCase()}</small><h1>Follow your repair</h1><p>The workshop updates this page as your device moves through the repair process. Keep this private link for future checks.</p></section>
      <section className="tracking-device"><div className="tracking-device-icon">▯</div><div><small>DEVICE</small><h2>{tracking.device}</h2><p>{tracking.ticket}</p></div><span className={`tracking-status status-${tracking.status.toLowerCase().replaceAll(" ","-")}`}>{tracking.status}</span></section>
      <section className="tracking-current"><header><span><small>LATEST WORKSHOP UPDATE</small><h2>{tracking.currentUpdate}</h2></span><button onClick={()=>load()} disabled={refreshing} aria-label="Refresh repair status">{refreshing?"Refreshing…":"↻ Refresh"}</button></header><p>Updated {formatDate(tracking.clientUpdatedAt)}</p></section>
      <section className="tracking-progress"><div className="tracking-progress-line"><i style={{width:`${currentIndex/(stages.length-1)*100}%`}}/></div><ol>{stages.map((stage,index)=><li className={index<currentIndex?"done":index===currentIndex?"current":""} key={stage.status}><b>{index<currentIndex?"✓":index+1}</b><span>{stage.label}</span></li>)}</ol></section>
      <section className="tracking-facts"><div><small>CHECKED IN</small><strong>{formatDate(tracking.createdAt,false)}</strong></div><div><small>EXPECTED / DUE</small><strong>{formatDate(tracking.due,false)}</strong></div><div><small>REFERENCE</small><strong>{tracking.ticket}</strong></div></section>
      <section className="tracking-timeline"><div className="tracking-section-title"><span><small>REPAIR TIMELINE</small><h2>Updates from the workshop</h2></span><em>{tracking.updates.length}</em></div><ol>{tracking.updates.map((update,index)=><li key={update.id}><b>{index===0?"●":"✓"}</b><article><header><strong>{update.status}</strong><time>{formatDate(update.createdAt)}</time></header><p>{update.message}</p></article></li>)}</ol></section>
      {tracking.certificatePath&&<section className="tracking-certificate"><span>✓</span><div><small>WARRANTY & PROCEDURE RECORD</small><strong>Your repair certificate is ready</strong><p>Open the QR-backed record to review warranty cover, recorded procedures, parts and final checks.</p></div><a href={tracking.certificatePath}>Open certificate →</a></section>}
      <footer className="tracking-footer"><p><strong>Privacy note:</strong> anyone with this link can view this repair status. Do not forward it unless you want to share access.</p><span>repairtrace · clear workshop communication</span></footer>
    </section>
  </main>;
}
