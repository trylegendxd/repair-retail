"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Certificate={shopName:string;ticket:string;device:string;serialNumber:string;diagnosis:string;warrantyDays:number;completedAt:string|null;tests:Array<{id:string;label:string;result:string}>;parts:Array<{id:string;name:string;sku:string}>;procedures:Array<{id:string;title:string;detail:string}>};

export default function CertificateView({ticket}:{ticket:string}){
  const[repair,setRepair]=useState<Certificate|null>(null);const[error,setError]=useState("");
  useEffect(()=>{fetch(`/api/certificates/${encodeURIComponent(ticket)}`).then(async(response)=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"Certificate not found");setRepair(data.repair)}).catch((reason)=>setError(reason.message))},[ticket]);
  if(error)return <main className="public-certificate-page"><section className="certificate-error"><span>!</span><h1>Certificate unavailable</h1><p>{error}</p></section></main>;
  if(!repair)return <main className="public-certificate-page"><section className="certificate-error"><span className="spinner"/><h1>Verifying repair…</h1></section></main>;
  const passed=repair.tests.filter((test)=>test.result==="passed").length;
  const currentUrl=typeof window!=="undefined"?window.location.href:`https://repairtrace.app/c/${ticket}`;
  return <main className="public-certificate-page"><section className="public-certificate">
    <header><div className="public-brand"><span>✓</span><div><strong>RepairTrace Warranty</strong><small>Warranty & recorded procedure certificate</small></div></div><em>✓ VERIFIED</em></header>
    <div className="verification-line"><span/><p>This after-service record was issued by <strong>{repair.shopName}</strong>.</p></div>
    <div className="public-device"><div><small>DEVICE</small><h1>{repair.device}</h1><p>{repair.serialNumber||"Serial number not recorded"}</p></div><QRCodeSVG value={currentUrl} size={112} bgColor="#ffffff" fgColor="#18231f"/></div>
    <div className="certificate-facts"><div><small>CERTIFICATE ID</small><strong>{repair.ticket}</strong></div><div><small>COMPLETED</small><strong>{repair.completedAt?new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"long",year:"numeric"}).format(new Date(repair.completedAt)):"Recorded"}</strong></div><div><small>WARRANTY</small><strong>{repair.warrantyDays} days</strong></div><div><small>FINAL CHECKS</small><strong>{passed}/{repair.tests.length} passed</strong></div></div>
    <section className="certificate-purpose-public"><b>AFTER-SERVICE CERTIFICATE</b><p>This QR record documents warranty coverage and the procedures completed on this device. Live repair progress is provided through the separate private tracking link.</p></section>
    <section className="public-section"><small>PROCEDURES RECORDED</small><div className="public-procedures">{repair.procedures.map((procedure,index)=><div key={procedure.id}><b>{index+1}</b><span><strong>{procedure.title}</strong><p>{procedure.detail}</p></span></div>)}</div></section>
    <section className="public-section"><small>PARTS RECORDED</small>{repair.parts.length?repair.parts.map((part)=><div className="public-part" key={part.id}><span>✓</span><p><strong>{part.name}</strong><small>{part.sku||"Workshop supplied"}</small></p></div>):<p>No replacement parts recorded.</p>}</section>
    <section className="public-section"><small>QUALITY CHECKS</small><div className="public-tests">{repair.tests.map((test)=><div key={test.id} className={test.result}><span>{test.result==="passed"?"✓":test.result==="failed"?"×":"·"}</span><strong>{test.label}</strong><em>{test.result}</em></div>)}</div></section>
    <footer><span>Keep this certificate for warranty support and a clear record of the work performed.</span><strong>repairtrace · warranty & procedure history</strong></footer>
  </section></main>
}
