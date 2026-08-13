"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function localDate(daysFromToday:number){
  const value=new Date();
  value.setDate(value.getDate()+daysFromToday);
  return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
}

export default function NewRepairModal({saving,defaultLaborRate,includeLaborByDefault,onClose,onSubmit}:{saving:boolean;defaultLaborRate:number;includeLaborByDefault:boolean;onClose:()=>void;onSubmit:(event:React.FormEvent<HTMLFormElement>)=>void}){
  const [step,setStep]=useState(1);
  const formRef=useRef<HTMLFormElement>(null);
  const minimumDate=useMemo(()=>localDate(0),[]);
  const suggestedDate=useMemo(()=>localDate(2),[]);
  useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow="hidden";const close=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose();};window.addEventListener("keydown",close);return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close);};},[onClose]);

  function next(){
    const form=formRef.current;
    if(!form)return;
    const fieldNames=step===1?["customer","email"]:["device","issue"];
    for(const name of fieldNames){
      const field=form.elements.namedItem(name);
      if(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement){
        if(!field.checkValidity()){field.reportValidity();field.focus();return;}
      }
    }
    setStep(current=>Math.min(3,current+1));
  }

  return <>
    <button className="modal-overlay" onClick={onClose} aria-label="Close new repair form"/>
    <section className="modal intake-modal" role="dialog" aria-modal="true" aria-labelledby="new-repair-title">
      <div className="intake-heading">
        <span><small>NEW REPAIR · STEP {step} OF 3</small><h2 id="new-repair-title">{step===1?"Customer details":step===2?"Device and problem":"Price and schedule"}</h2></span>
        <button onClick={onClose} aria-label="Close form">×</button>
      </div>
      <nav className="intake-progress" aria-label="New repair progress">
        {["Customer","Device","Plan"].map((label,index)=><span className={index+1<step?"done":index+1===step?"active":""} key={label}><b>{index+1<step?"✓":index+1}</b>{label}</span>)}
      </nav>
      <form ref={formRef} onSubmit={onSubmit}>
        <fieldset className="intake-step" hidden={step!==1}>
          <legend>Who owns the device?</legend>
          <p>Add an email, a mobile number, or both so RepairTrace can deliver the private status link.</p>
          <label className="wide">Customer name<input required autoFocus name="customer" autoComplete="name" placeholder="Full name"/></label>
          <label>Email<input name="email" type="email" autoComplete="email" placeholder="customer@example.com"/></label>
          <label>Mobile number<input name="phone" autoComplete="tel" placeholder="+351 ..."/></label>
        </fieldset>
        <fieldset className="intake-step" hidden={step!==2}>
          <legend>What needs repairing?</legend>
          <p>Use normal language and list every symptom. For example: “tela partida e ventoinha partida”.</p>
          <label className="wide">Device<input required name="device" placeholder="e.g. iPhone 14 Pro"/></label>
          <label>Category<select name="category" defaultValue="Phone"><option>Phone</option><option>Laptop</option><option>Tablet</option><option>Console</option><option>Audio</option><option>Other</option></select></label>
          <label>Serial number<input name="serial" placeholder="IMEI or serial"/></label>
          <label className="wide">Reported issue(s)<textarea required name="issue" placeholder="Describe every problem in your own words"/></label>
        </fieldset>
        <fieldset className="intake-step" hidden={step!==3}>
          <legend>Set the commercial plan</legend>
          <p>You can leave the manual estimate empty. AI parts research and the customer tracking link start after the record is safely saved.</p>
          <label>Due date<input required name="due" type="date" min={minimumDate} defaultValue={suggestedDate}/></label>
          <label>Manual estimate (€)<input name="estimate" type="number" min="0" step="0.01" placeholder="Leave empty for AI"/></label>
          <label>Priority<select name="priority" defaultValue="Standard"><option>Standard</option><option>Priority</option></select></label>
          <label>Hourly labour rate (€)<input required name="laborRate" type="number" min="0" max="1000" step="0.01" defaultValue={defaultLaborRate}/></label>
          <label className="intake-labor-toggle wide"><input name="includeLabor" type="checkbox" defaultChecked={includeLaborByDefault}/><span><strong>Include labour in the estimate</strong><small>Turn this off for a parts-only estimate.</small></span></label>
          <div className="intake-automation wide">
            <span><b>⌁</b><span><strong>Customer tracking</strong><small>Creates the private link and attempts email/SMS delivery.</small></span></span>
            <span><b>✦</b><span><strong>AI parts research</strong><small>Detects multiple faults and prices compatible parts.</small></span></span>
          </div>
        </fieldset>
        <footer className="intake-footer">
          <span>{step>1&&<button type="button" onClick={()=>setStep(current=>current-1)}>← Back</button>}</span>
          <span><button type="button" onClick={onClose}>Cancel</button>{step<3?<button type="button" className="primary" onClick={next}>Continue →</button>:<button className="primary" disabled={saving}>{saving?"Saving safely…":"Create repair"}</button>}</span>
        </footer>
      </form>
    </section>
  </>;
}
