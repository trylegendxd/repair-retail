"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { countries, deviceModels, repairIssues } from "@/lib/repair-catalog";
import DeviceCombobox, { DeviceSuggestion } from "./device-combobox";
import { AccountProfile, AccountView, MarketplaceActivity, OpportunitiesView, PostRepairView, SignedInUser } from "./marketplace-client";

type View = "search" | "opportunities" | "post" | "activity" | "saved" | "about" | "account";
type Coordinates = { latitude: number; longitude: number } | null;
type Shop = { id:string; name:string; city:string; region:string; addressLabel:string; verified:boolean; distanceKm:number|null; priceLow:number; priceHigh:number; currency:string; turnaroundDays:number; sampleSize:number; serviceLabel:string };
type SearchResult = {
  model:{key:string;label:string;brand:string;category:string};
  issue:{key:string;label:string;shortLabel:string};
  location:{city:string;countryCode:string}; currency:string; symbol:string;
  estimate:{low:number;typical:number;high:number;parts:number;labor:number;confidence:string;sampleCount:number;shopRangeCount:number;basis:string;dataAsOf:string|null};
  shops:Shop[]; mapsQuery:string;
};
type RequestStatus = { token:string;status:string;modelLabel:string;issueKey:string;city:string;maskedContact:string;shopName:string;shopCity:string;shopReply:string;shopPrice:number|null;currency:string;createdAt:string;updatedAt:string };
type InstallPrompt = Event & { prompt:()=>Promise<void>; userChoice:Promise<{outcome:string}> };

const storageKeys = { saved:"repairtrace-find-saved", requests:"repairtrace-find-requests" };
const categoryOrder = ["Phone","Laptop","Tablet","Console","Audio","Wearable","Camera","Drone","Television"];
const statusLabels:Record<string,string> = { new:"Sent", viewed:"Seen by shop", quoted:"Quote received", accepted:"Accepted", declined:"Declined", closed:"Closed" };

function Icon({name,size=20}: {name:string;size?:number}) {
  const common={width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true};
  const paths:Record<string,ReactNode>={
    search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    message:<><path d="M5 18.5 3.5 21l.8-4A8 8 0 1 1 7 19.2"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></>,
    heart:<path d="M20.8 4.7a5.4 5.4 0 0 0-7.7 0L12 5.8l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.7Z"/>,
    info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
    location:<><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    shield:<path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z"/>,
    trend:<><path d="M4 16 9 11l4 4 7-8"/><path d="M15 7h5v5"/></>,
    parts:<><path d="m14.7 6.3 3-3 3 3-3 3"/><path d="m17.7 6.3-8.9 8.9"/><path d="M8.2 13.8 3.5 18.5a1.4 1.4 0 0 0 2 2l4.7-4.7"/></>,
    labour:<><circle cx="9" cy="7" r="3"/><path d="M4 21v-3a5 5 0 0 1 10 0v3M16 11l2 2 3-3"/></>,
    arrow:<path d="m9 18 6-6-6-6"/>,
    back:<path d="m15 18-6-6 6-6"/>,
    close:<><path d="m6 6 12 12M18 6 6 18"/></>,
    navigation:<><path d="m4 4 16 7-7 2-2 7-7-16Z"/></>,
    install:<><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M5 20h14"/></>,
    check:<path d="m5 12 4 4L19 6"/>,
    lock:<><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    device:<><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 19h2"/></>,
    plus:<><path d="M12 5v14M5 12h14"/></>,
    account:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    shop:<><path d="M4 10v10h16V10M3 10l2-6h14l2 6"/><path d="M8 14h3v6M14 14h3"/></>,
    list:<><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,
  };
  return <svg {...common}>{paths[name]??paths.device}</svg>;
}

function money(value:number,currency:string) {
  return new Intl.NumberFormat(undefined,{style:"currency",currency,maximumFractionDigits:0}).format(value);
}

function readStored(key:string) {
  try { const value=JSON.parse(localStorage.getItem(key)??"[]"); return Array.isArray(value)?value as string[]:[]; } catch { return []; }
}

export default function ConsumerApp({signedInUser}:{signedInUser:SignedInUser}) {
  const [view,setView]=useState<View>("search");
  const [countryCode,setCountryCode]=useState("PT");
  const [city,setCity]=useState("");
  const [modelKey,setModelKey]=useState("iphone-14");
  const [deviceText,setDeviceText]=useState("iPhone 14");
  const [category,setCategory]=useState("Phone");
  const [issueKey,setIssueKey]=useState("screen");
  const [coordinates,setCoordinates]=useState<Coordinates>(null);
  const [locationState,setLocationState]=useState<"idle"|"loading"|"ready"|"error">("idle");
  const [result,setResult]=useState<SearchResult|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState<string[]>([]);
  const [requestTokens,setRequestTokens]=useState<string[]>([]);
  const [requests,setRequests]=useState<RequestStatus[]>([]);
  const [requestsLoading,setRequestsLoading]=useState(false);
  const [requestsError,setRequestsError]=useState("");
  const [quoteShop,setQuoteShop]=useState<Shop|null>(null);
  const [quoteSent,setQuoteSent]=useState<{shopName:string;token:string}|null>(null);
  const [installPrompt,setInstallPrompt]=useState<InstallPrompt|null>(null);
  const [profile,setProfile]=useState<AccountProfile|null>(null);
  const [accountLoading,setAccountLoading]=useState(Boolean(signedInUser));
  const [accountError,setAccountError]=useState("");
  const searchAbort=useRef<AbortController|null>(null);

  useEffect(()=>{
    const storageTimer=window.setTimeout(()=>{setSaved(readStored(storageKeys.saved));setRequestTokens(readStored(storageKeys.requests));},0);
    const onInstall=(event:Event)=>{event.preventDefault();setInstallPrompt(event as InstallPrompt);};
    window.addEventListener("beforeinstallprompt",onInstall);
    return()=>{window.clearTimeout(storageTimer);window.removeEventListener("beforeinstallprompt",onInstall);searchAbort.current?.abort();};
  },[]);

  useEffect(()=>{
    if(!signedInUser)return;
    let active=true;const controller=new AbortController();
    (async()=>{setAccountLoading(true);setAccountError("");try{const response=await fetch("/api/account",{cache:"no-store",signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not load account");if(active)setProfile(data.profile??null);}catch(caught){if(active&&!(caught instanceof DOMException&&caught.name==="AbortError"))setAccountError(caught instanceof Error?caught.message:"Could not load account");}finally{if(active)setAccountLoading(false);}})();
    return()=>{active=false;controller.abort()};
  },[signedInUser]);

  useEffect(()=>{
    if(view!=="activity"||profile?.role==="provider")return;
    let active=true;const controller=new AbortController();
    const requestTimer=window.setTimeout(async()=>{setRequestsLoading(true);setRequestsError("");const tokens=readStored(storageKeys.requests);const values=await Promise.all(tokens.map(async(token)=>{try{const response=await fetch(`/api/requests/${encodeURIComponent(token)}`,{signal:controller.signal,cache:"no-store"});return response.ok?{data:await response.json(),token}: {data:null,token,remove:response.status===404};}catch{return {data:null,token,failed:true};}}));if(!active)return;const failed=values.some(item=>item.failed);const valid=values.filter(item=>item.data).map(item=>item.data) as RequestStatus[];const retained=values.filter(item=>!item.remove).map(item=>item.token);if(retained.length!==tokens.length){localStorage.setItem(storageKeys.requests,JSON.stringify(retained));setRequestTokens(retained);}setRequests(valid);if(failed)setRequestsError("Some requests could not be refreshed. Check your connection and try again.");setRequestsLoading(false);},0);
    return()=>{active=false;controller.abort();window.clearTimeout(requestTimer);};
  },[view,requestTokens.length,profile?.role]);

  const availableIssues=useMemo(()=>repairIssues.filter((issue)=>issue.categories.includes(category)||issue.key==="diagnostic"),[category]);
  const resultSavedShops=useMemo(()=>result?.shops.filter((shop)=>saved.includes(shop.id))??[],[result,saved]);

  async function search(event?:FormEvent) {
    event?.preventDefault();setError("");
    if(!city.trim()){setError("Enter your city or use your current location.");return;}
    if(modelKey==="other"&&!deviceText.trim()){setError("Tell us which device you have.");return;}
    searchAbort.current?.abort();const controller=new AbortController();searchAbort.current=controller;setLoading(true);
    try{
      const response=await fetch("/api/search",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({countryCode,city,modelKey:modelKey==="other"?"other":modelKey,modelLabel:deviceText,category,issueKey,...coordinates}),signal:controller.signal});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Search failed");setResult(data);requestAnimationFrame(()=>document.getElementById("results")?.scrollIntoView({behavior:"smooth",block:"start"}));
    }catch(caught){if(!(caught instanceof DOMException&&caught.name==="AbortError"))setError(caught instanceof Error?caught.message:"We could not run this search.");}finally{if(searchAbort.current===controller){searchAbort.current=null;setLoading(false);}}
  }

  function useLocation(){
    setLocationState("loading");setError("");
    if(!navigator.geolocation){setLocationState("error");setError("Location is not available on this device.");return;}
    navigator.geolocation.getCurrentPosition((position)=>{setCoordinates({latitude:position.coords.latitude,longitude:position.coords.longitude});setCity((current)=>current||"Current area");setLocationState("ready");},()=>{setLocationState("error");setError("Location permission was not granted. You can type your city instead.");},{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
  }

  function changeModel(nextModel:string){setModelKey(nextModel);const selected=deviceModels.find((model)=>model.key===nextModel);if(selected){setDeviceText(selected.label);setCategory(selected.category);if(!repairIssues.some((issue)=>issue.key===issueKey&&issue.categories.includes(selected.category)))setIssueKey("diagnostic");}}
  function selectDevice(selected:DeviceSuggestion){setModelKey(selected.key);setDeviceText(selected.label);setCategory(selected.category);if(!repairIssues.some(issue=>issue.key===issueKey&&issue.categories.includes(selected.category)))setIssueKey("diagnostic");}
  function changeCategory(nextCategory:string){setCategory(nextCategory);if(!repairIssues.some(issue=>issue.key===issueKey&&issue.categories.includes(nextCategory)))setIssueKey("diagnostic");}
  function selectPopular(nextModel:string,nextIssue:string){changeModel(nextModel);setIssueKey(nextIssue);document.getElementById("finder")?.scrollIntoView({behavior:"smooth"});}
  function toggleSaved(shopId:string){setSaved((current)=>{const next=current.includes(shopId)?current.filter((id)=>id!==shopId):[...current,shopId];localStorage.setItem(storageKeys.saved,JSON.stringify(next));return next;});}
  async function install(){if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;setInstallPrompt(null);}

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={()=>setView("search")} aria-label="RepairTrace Find home">
        <span className="brand-mark"><Icon name="search" size={19}/><span className="brand-pulse"/></span>
        <span><strong>RepairTrace</strong><small>FIND</small></span>
      </button>
      <div className="top-actions">
        {installPrompt&&<button className="install-button" onClick={install}><Icon name="install" size={17}/> Install</button>}
        <button className="avatar-button" onClick={()=>setView("account")} aria-label={signedInUser?"Open RepairTrace account":"Sign in or register"}>{signedInUser?signedInUser.displayName.trim().slice(0,1).toUpperCase():<Icon name="account" size={17}/>}</button>
      </div>
    </header>

    <main>
      {view==="search"&&<>
        <section className="hero">
          <div className="eyebrow"><span/>Repair prices, made clearer</div>
          <h1>Know the fair price<br/>before you repair.</h1>
          <p>Search more than 26,000 device models, compare a realistic local range, then ask nearby RepairTrace providers for help.</p>
          <div className="trust-row"><span><Icon name="shield" size={16}/>No surprise fees</span><span><Icon name="lock" size={15}/>Private by design</span></div>
        </section>

        <section className="finder-card" id="finder">
          <div className="step-heading"><span>01</span><div><h2>What needs fixing?</h2><p>It takes less than a minute.</p></div></div>
          <form onSubmit={search}>
            <div className="field-grid location-grid">
              <label><span>Country</span><select value={countryCode} onChange={(event)=>setCountryCode(event.target.value)}>{countries.map((country)=><option key={country.code} value={country.code}>{country.label}</option>)}</select></label>
              <label><span>City or town</span><div className="input-icon"><Icon name="location" size={18}/><input value={city} onChange={(event)=>{setCity(event.target.value);if(coordinates)setCoordinates(null);}} placeholder="e.g. Braga"/></div></label>
            </div>
            <button type="button" className={`location-button ${locationState==="ready"?"ready":""}`} onClick={useLocation} disabled={locationState==="loading"}>
              <Icon name={locationState==="ready"?"check":"navigation"} size={17}/>{locationState==="loading"?"Finding your location…":locationState==="ready"?"Current location added":"Use my current location"}
            </button>

            <div className="field-grid device-grid">
              <label className="wide"><span>Device — search 26,000+ phones, tablets and electronics</span><DeviceCombobox value={deviceText} onChange={(value)=>{setDeviceText(value);setModelKey("other");}} onSelect={selectDevice} required/></label>
              {modelKey==="other"&&<label><span>Device type</span><select value={category} onChange={(event)=>changeCategory(event.target.value)}>{[...categoryOrder,"Other"].map((item)=><option key={item}>{item}</option>)}</select></label>}
              <label className={modelKey==="other"?"wide":""}><span>Problem</span><select value={issueKey} onChange={(event)=>setIssueKey(event.target.value)}>{availableIssues.map((issue)=><option value={issue.key} key={issue.key}>{issue.label}</option>)}</select></label>
            </div>
            {error&&<div className="form-error" role="alert"><Icon name="info" size={17}/>{error}</div>}
            <button className="primary-button" disabled={loading}>{loading?<span className="spinner"/>:<Icon name="search" size={19}/>}<span>{loading?"Checking local prices…":"Check the fair price"}</span><Icon name="arrow" size={18}/></button>
            <p className="fine-print"><Icon name="shield" size={14}/> No account needed for a price estimate.</p>
          </form>
        </section>

        {!result&&<section className="popular-section"><div className="section-title"><div><span>QUICK START</span><h2>Popular repairs</h2></div><p>Tap one to fill the search</p></div><div className="popular-grid">
          <button onClick={()=>selectPopular("iphone-14","screen")}><span className="repair-visual phone-visual"><i/></span><span><strong>iPhone 14 screen</strong><small>Cracked glass or touch</small></span><Icon name="arrow" size={17}/></button>
          <button onClick={()=>selectPopular("iphone-13","battery")}><span className="repair-visual battery-visual"><i/><b/></span><span><strong>iPhone battery</strong><small>Drains or shuts down</small></span><Icon name="arrow" size={17}/></button>
          <button onClick={()=>selectPopular("playstation-5","charging")}><span className="repair-visual console-visual"><i/><b/></span><span><strong>Console repair</strong><small>Power or port fault</small></span><Icon name="arrow" size={17}/></button>
        </div></section>}

        {result&&<Results result={result} saved={saved} onSave={toggleSaved} onMessage={setQuoteShop}/>} 

        <section className="how-section"><div className="section-title"><div><span>HOW IT WORKS</span><h2>A smarter starting point</h2></div></div><div className="how-grid">
          <article><span>1</span><Icon name="trend" size={25}/><h3>Match the exact device</h3><p>A source-backed catalogue recognizes official model names and codes while still accepting custom devices.</p></article>
          <article><span>2</span><Icon name="location" size={25}/><h3>Compare local shops</h3><p>Only RepairTrace partners that opt in and publish this service appear.</p></article>
          <article><span>3</span><Icon name="message" size={25}/><h3>Ask for an exact quote</h3><p>Send the same repair details privately and follow the reply in one place.</p></article>
        </div></section>
      </>}

      {view==="opportunities"&&(accountLoading?<AccountLoading/>:<OpportunitiesView signedInUser={signedInUser} profile={profile} onOpenAccount={()=>setView("account")}/>)}
      {view==="post"&&(accountLoading?<AccountLoading/>:<PostRepairView signedInUser={signedInUser} profile={profile} onPublished={()=>setView("activity")} onOpenAccount={()=>setView("account")}/>)}
      {view==="activity"&&(accountLoading?<AccountLoading/>:<><MarketplaceActivity signedInUser={signedInUser} profile={profile} onOpenAccount={()=>setView("account")}/>{profile?.role!=="provider"&&<RequestsView requests={requests} loading={requestsLoading} error={requestsError} compact/>}</>)}
      {view==="saved"&&<SavedView shops={resultSavedShops} hasSaved={saved.length>0} onBack={()=>setView("search")} onSave={toggleSaved} onMessage={setQuoteShop}/>} 
      {view==="about"&&<AboutView installPrompt={Boolean(installPrompt)} onInstall={install}/>} 
      {view==="account"&&(accountLoading?<AccountLoading/>:<>{accountError&&<div className="account-error form-error" role="alert"><Icon name="info" size={17}/>{accountError}</div>}<AccountView signedInUser={signedInUser} profile={profile} onProfile={setProfile} onOpenSaved={()=>setView("saved")} onOpenAbout={()=>setView("about")} savedCount={saved.length}/></>)}
    </main>

    <nav className="bottom-nav" aria-label="Main navigation">
      {profile?.role==="provider"?<><NavButton active={view==="opportunities"} icon="shop" label="Opportunities" onClick={()=>setView("opportunities")}/><NavButton active={view==="activity"} icon="list" label="My offers" onClick={()=>setView("activity")}/><NavButton active={view==="search"} icon="search" label="Price search" onClick={()=>setView("search")}/></>:<><NavButton active={view==="search"} icon="search" label="Search" onClick={()=>setView("search")}/><NavButton active={view==="post"} icon="plus" label="Post repair" onClick={()=>setView("post")}/><NavButton active={view==="activity"} icon="list" label="Activity" badge={(profile?0:requestTokens.length)} onClick={()=>setView("activity")}/></>}
      <NavButton active={view==="account"||view==="saved"||view==="about"} icon="account" label="Account" onClick={()=>setView("account")}/>
    </nav>

    {quoteShop&&<QuoteModal shop={quoteShop} result={result!} city={city} onClose={()=>setQuoteShop(null)} onSent={(token)=>{const next=[token,...readStored(storageKeys.requests).filter((item)=>item!==token)];localStorage.setItem(storageKeys.requests,JSON.stringify(next));setRequestTokens(next);setQuoteSent({shopName:quoteShop.name,token});setQuoteShop(null);}}/>}
    {quoteSent&&<div className="modal-layer"><div className="success-modal" role="dialog" aria-modal="true" aria-labelledby="quote-success-title"><span className="success-icon"><Icon name="check" size={31}/></span><p className="modal-kicker">MESSAGE SENT</p><h2 id="quote-success-title">{quoteSent.shopName} has your request.</h2><p>The shop can now review the repair and reply with a specific estimate. You can follow it under Activity.</p><button className="primary-button" onClick={()=>{setQuoteSent(null);setView("activity");}}>Track my request <Icon name="arrow" size={18}/></button><button className="text-button" onClick={()=>setQuoteSent(null)}>Done</button></div></div>}
  </div>;
}

function Results({result,saved,onSave,onMessage}:{result:SearchResult;saved:string[];onSave:(id:string)=>void;onMessage:(shop:Shop)=>void}){
  const mapsUrl=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.mapsQuery)}`;
  return <section className="results-section" id="results">
    <div className="result-heading"><span className="result-check"><Icon name="check" size={18}/></span><div><p>LOCAL PRICE CHECK</p><h2>{result.model.label} · {result.issue.shortLabel}</h2><span><Icon name="location" size={14}/>{result.location.city}</span></div></div>
    <article className="estimate-card">
      <div className="estimate-top"><div><span>EXPECTED LOCAL RANGE</span><strong>{money(result.estimate.low,result.currency)}–{money(result.estimate.high,result.currency)}</strong><p>Most repairs land near <b>{money(result.estimate.typical,result.currency)}</b></p></div><div className="confidence"><span>{result.estimate.confidence}</span><small>confidence</small></div></div>
      <div className="range-track"><i style={{left:`${Math.max(8,Math.min(88,(result.estimate.typical-result.estimate.low)/Math.max(1,result.estimate.high-result.estimate.low)*100))}%`}}/><span>Lower</span><span>Typical</span><span>Higher</span></div>
      <div className="cost-breakdown"><div><span className="cost-icon"><Icon name="parts" size={19}/></span><p>Parts estimate<strong>{money(result.estimate.parts,result.currency)}</strong></p></div><div><span className="cost-icon"><Icon name="labour" size={19}/></span><p>Labour estimate<strong>{money(result.estimate.labor,result.currency)}</strong></p></div></div>
      <div className="estimate-note"><Icon name="info" size={17}/><p>This is a comparison range, not a binding quote. Final price can change after diagnosis, part quality and warranty choice.</p></div>
      <footer><span><Icon name="trend" size={15}/>{result.estimate.basis}</span><span>{result.estimate.sampleCount?`${result.estimate.sampleCount} completed repair${result.estimate.sampleCount===1?"":"s"}`:"Baseline starting range"}{result.estimate.shopRangeCount?` · ${result.estimate.shopRangeCount} shop range${result.estimate.shopRangeCount===1?"":"s"}`:""}</span></footer>
    </article>

    <div className="shops-heading"><div><p>REPAIRTRACE NETWORK</p><h2>Shops for this repair</h2></div><span>{result.shops.length} found</span></div>
    {result.shops.length>0?<div className="shop-list">{result.shops.map((shop)=><ShopCard key={shop.id} shop={shop} saved={saved.includes(shop.id)} onSave={()=>onSave(shop.id)} onMessage={()=>onMessage(shop)}/>)}</div>:<article className="empty-shops"><span className="map-illustration"><i/><b/><em/></span><h3>No RepairTrace partner has published this repair nearby yet.</h3><p>Your price range is still available. You can also see other repair businesses on Maps while the network grows.</p><a href={mapsUrl} target="_blank" rel="noreferrer"><Icon name="location" size={18}/>Search nearby repair shops<Icon name="arrow" size={17}/></a><small>External shops are not verified by RepairTrace.</small></article>}
  </section>;
}

function ShopCard({shop,saved,onSave,onMessage}:{shop:Shop;saved:boolean;onSave:()=>void;onMessage:()=>void}){
  return <article className="shop-card"><div className="shop-top"><span className="shop-avatar">{shop.name.slice(0,1).toUpperCase()}</span><div className="shop-name"><div><h3>{shop.name}</h3>{shop.verified&&<span className="verified"><Icon name="check" size={11}/>Verified</span>}</div><p><Icon name="location" size={14}/>{shop.distanceKm!==null?`${shop.distanceKm.toFixed(1)} km away · `:""}{shop.city}</p></div><button className={`save-button ${saved?"saved":""}`} onClick={onSave} aria-label={saved?"Remove saved shop":"Save shop"}><Icon name="heart" size={19}/></button></div>
    <div className="shop-offer"><div><span>PUBLISHED RANGE</span><strong>{money(shop.priceLow,shop.currency)}–{money(shop.priceHigh,shop.currency)}</strong></div><div><Icon name="clock" size={17}/><span>Usually<br/><strong>{shop.turnaroundDays}–{shop.turnaroundDays+1} days</strong></span></div></div>
    <button className="message-button" onClick={onMessage}><Icon name="message" size={18}/>Ask this shop for a quote<Icon name="arrow" size={17}/></button>
    <p className="shop-fine"><Icon name="shield" size={13}/>Your contact is shared only after you confirm.</p>
  </article>;
}

function QuoteModal({shop,result,city,onClose,onSent}:{shop:Shop;result:SearchResult;city:string;onClose:()=>void;onSent:(token:string)=>void}){
  const [name,setName]=useState("");const [contactType,setContactType]=useState<"email"|"phone">("email");const [contact,setContact]=useState("");const [detail,setDetail]=useState("");const [message,setMessage]=useState("");const [consent,setConsent]=useState(false);const [sending,setSending]=useState(false);const [error,setError]=useState("");
  const nameInput=useRef<HTMLInputElement|null>(null);
  useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow="hidden";nameInput.current?.focus();const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose();};window.addEventListener("keydown",onKey);return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",onKey);};},[onClose]);
  async function submit(event:FormEvent){event.preventDefault();setError("");setSending(true);try{const response=await fetch("/api/requests",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({shopId:shop.id,customerName:name,contactType,contactValue:contact,modelKey:result.model.key,modelLabel:result.model.label,category:result.model.category,issueKey:result.issue.key,issueDetail:detail,city,currency:result.currency,message,consent,website:""})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not send message");onSent(data.token);}catch(caught){setError(caught instanceof Error?caught.message:"Could not send message");setSending(false);}}
  return <div className="modal-layer" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><div className="quote-modal" role="dialog" aria-modal="true" aria-labelledby="quote-dialog-title"><button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={20}/></button><p className="modal-kicker">PRIVATE QUOTE REQUEST</p><h2 id="quote-dialog-title">Message {shop.name}</h2><p className="modal-sub">We’ll include <strong>{result.model.label} · {result.issue.shortLabel}</strong> and your area.</p><form onSubmit={submit}>
    <label><span>Your name</span><input ref={nameInput} value={name} onChange={(e)=>setName(e.target.value)} placeholder="First and last name" autoComplete="name" maxLength={80} required/></label>
    <div className="contact-toggle"><button type="button" className={contactType==="email"?"active":""} onClick={()=>setContactType("email")}>Email</button><button type="button" className={contactType==="phone"?"active":""} onClick={()=>setContactType("phone")}>Phone / SMS</button></div>
    <label><span>{contactType==="email"?"Email address":"Phone number"}</span><input type={contactType==="email"?"email":"tel"} value={contact} onChange={(e)=>setContact(e.target.value)} placeholder={contactType==="email"?"you@example.com":"+351 900 000 000"} autoComplete={contactType==="email"?"email":"tel"} required/></label>
    <label><span>What exactly happened?</span><textarea value={detail} onChange={(e)=>setDetail(e.target.value)} placeholder="For example: glass is cracked, touch still works, no frame damage…" rows={3} maxLength={600}/></label>
    <label><span>Question for the shop <small>Optional</small></span><textarea value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="Ask about part quality, warranty, earliest appointment…" rows={3} maxLength={900}/></label>
    <label className="consent-row"><input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)}/><span><b>I agree to share these details with {shop.name}.</b> RepairTrace will not show them to other shops.</span></label>
    {error&&<div className="form-error" role="alert"><Icon name="info" size={17}/>{error}</div>}
    <button className="primary-button" disabled={sending||!consent}>{sending?<span className="spinner"/>:<Icon name="message" size={18}/>}Send private request<Icon name="arrow" size={17}/></button>
  </form></div></div>;
}

function RequestsView({requests,loading,error,compact=false}:{requests:RequestStatus[];loading:boolean;error:string;compact?:boolean}){
  return <section className={`standalone-view ${compact?"direct-requests-view":""}`}><div className="view-hero"><p>DIRECT SHOP REQUESTS</p><h1>Private quotes</h1><span>Messages sent directly to a specific RepairTrace partner.</span></div>{error&&<div className="form-error" role="alert"><Icon name="info" size={17}/>{error}</div>}{loading?<div className="loading-card"><span className="spinner dark"/>Loading your requests…</div>:requests.length?<div className="request-list">{requests.map((item)=><article key={item.token} className="request-card"><div className="request-card-top"><span className={`status-dot ${item.status}`}/><div><span>{statusLabels[item.status]??item.status}</span><small>{new Date(item.updatedAt).toLocaleDateString()}</small></div></div><h2>{item.modelLabel}</h2><p>{item.shopName} · {item.shopCity}</p>{item.shopReply?<div className="shop-reply"><span>SHOP REPLY</span><p>{item.shopReply}</p>{item.shopPrice!==null&&<strong>{money(item.shopPrice,item.currency)}</strong>}</div>:<div className="waiting-reply"><Icon name="clock" size={18}/><span>The shop has your request. We’ll show its reply here.</span></div>}<div className="request-meta"><span>Contact: {item.maskedContact}</span><a href={`/request/${item.token}`}>Private tracking link <Icon name="arrow" size={14}/></a></div></article>)}</div>:compact?null:<EmptyView icon="message" title="No quote requests yet" text="When you message a partner shop, the request and its reply will appear here."/>}</section>;
}

function SavedView({shops,hasSaved,onBack,onSave,onMessage}:{shops:Shop[];hasSaved:boolean;onBack:()=>void;onSave:(id:string)=>void;onMessage:(shop:Shop)=>void}){
  return <section className="standalone-view"><div className="view-hero"><p>SAVED SHOPS</p><h1>Your shortlist</h1><span>Keep the repair options you want to compare.</span></div>{shops.length?<div className="shop-list">{shops.map((shop)=><ShopCard key={shop.id} shop={shop} saved onSave={()=>onSave(shop.id)} onMessage={()=>onMessage(shop)}/>)}</div>:<EmptyView icon="heart" title={hasSaved?"Run that search again":"Nothing saved yet"} text={hasSaved?"Saved shops are private to this device. Repeat the matching search to load their latest prices.":"Tap the heart on a partner shop to keep it here."} action="Search for a repair" onAction={onBack}/>}</section>;
}

function AboutView({installPrompt,onInstall}:{installPrompt:boolean;onInstall:()=>void}){
  return <section className="standalone-view about-view"><div className="view-hero"><p>ABOUT THE NETWORK</p><h1>Repair with more confidence.</h1><span>RepairTrace Find is the customer side of the RepairTrace workshop platform.</span></div><div className="principle-grid"><article><Icon name="device" size={23}/><h2>Broad device matching</h2><p>More than 26,000 searchable models combine RepairTrace repair data with Google Play&apos;s public supported-device catalogue.</p></article><article><Icon name="trend" size={23}/><h2>Useful estimates</h2><p>Ranges adapt to the device, problem and region. As consenting shops contribute anonymized completed repairs, they become more precise.</p></article><article><Icon name="lock" size={23}/><h2>You control contact</h2><p>Price searches need no account. Marketplace contact stays private until an offer is accepted.</p></article></div>{installPrompt&&<button className="primary-button install-wide" onClick={onInstall}><Icon name="install" size={19}/>Install RepairTrace Find<Icon name="arrow" size={18}/></button>}<div className="privacy-note"><Icon name="info" size={18}/><p><strong>Early network notice</strong>Coverage depends on local partner shops. External Maps results are not verified or endorsed by RepairTrace.</p></div></section>;
}

function EmptyView({icon,title,text,action,onAction}:{icon:string;title:string;text:string;action?:string;onAction?:()=>void}){return <div className="empty-view"><span><Icon name={icon} size={27}/></span><h2>{title}</h2><p>{text}</p>{action&&<button onClick={onAction}>{action}<Icon name="arrow" size={16}/></button>}</div>;}
function NavButton({active,icon,label,badge,onClick}:{active:boolean;icon:string;label:string;badge?:number;onClick:()=>void}){return <button className={active?"active":""} onClick={onClick} aria-current={active?"page":undefined}><span><Icon name={icon} size={21}/>{Boolean(badge)&&<i>{badge!>9?"9+":badge}</i>}</span><small>{label}</small></button>;}
function AccountLoading(){return <section className="standalone-view"><div className="loading-card"><span className="spinner dark"/>Loading your RepairTrace account…</div></section>}
