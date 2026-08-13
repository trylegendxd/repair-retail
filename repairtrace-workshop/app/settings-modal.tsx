"use client";

import { useEffect, useState } from "react";

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

export default function SettingsModal({ settings, saving, onClose, onSave }: {
  settings: ShopSettings;
  saving: boolean;
  onClose: () => void;
  onSave: (settings: Omit<ShopSettings, "sharedRepairCount" | "currency">) => Promise<void>;
}) {
  const [marketplaceEnabled,setMarketplaceEnabled]=useState(settings.marketplaceEnabled);
  const [coordinates,setCoordinates]=useState<{latitude:number;longitude:number}|null>(settings.marketplaceLatitude!==null&&settings.marketplaceLongitude!==null?{latitude:settings.marketplaceLatitude,longitude:settings.marketplaceLongitude}:null);
  const [locating,setLocating]=useState(false);
  const [locationError,setLocationError]=useState("");
  useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow="hidden";const close=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose();};window.addEventListener("keydown",close);return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close);};},[onClose]);
  function useWorkshopLocation(){setLocating(true);setLocationError("");if(!navigator.geolocation){setLocationError("Location is not available in this browser.");setLocating(false);return;}navigator.geolocation.getCurrentPosition((position)=>{setCoordinates({latitude:position.coords.latitude,longitude:position.coords.longitude});setLocating(false);},()=>{setLocationError("Location permission was not granted. The city-only listing will still work.");setLocating(false);},{enableHighAccuracy:false,timeout:8000,maximumAge:300000});}
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onSave({
      shopName: String(form.get("shopName") || "Rush Electronics").trim(),
      shareRepairData: form.get("shareRepairData") === "on",
      countryCode: String(form.get("countryCode") || "PT"),
      defaultLaborRate: Number(form.get("defaultLaborRate")),
      includeLaborByDefault: form.get("includeLaborByDefault") === "on",
      marketplaceEnabled: form.get("marketplaceEnabled") === "on",
      marketplaceCity: String(form.get("marketplaceCity") || "").trim(),
      marketplaceRegion: String(form.get("marketplaceRegion") || "").trim(),
      marketplaceAddressLabel: String(form.get("marketplaceAddressLabel") || "").trim(),
      marketplaceLatitude: coordinates?.latitude??null,
      marketplaceLongitude: coordinates?.longitude??null,
      marketplaceRadiusKm: Number(form.get("marketplaceRadiusKm") || 30),
    });
  }

  return <>
    <button className="modal-overlay" onClick={onClose} aria-label="Close settings"/>
    <section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div><span><small>WORKSHOP SETTINGS</small><h2 id="settings-title">Clients, marketplace & estimation</h2></span><button onClick={onClose} aria-label="Close settings">×</button></div>
      <form key={`${settings.shopName}-${settings.shareRepairData}-${settings.countryCode}-${settings.defaultLaborRate}-${settings.includeLaborByDefault}-${settings.marketplaceCity}`} onSubmit={submit}>
        <label className="wide">Workshop name shown to clients<input required name="shopName" minLength={2} maxLength={80} defaultValue={settings.shopName}/></label>
        <section className="sharing-control wide">
          <label className="sharing-toggle"><input name="shareRepairData" type="checkbox" defaultChecked={settings.shareRepairData}/><span/><div><strong>Contribute anonymous repair data</strong><small>Off by default. You can disable this later and RepairTrace will remove your contributed records from the shared pool.</small></div></label>
          <p>{settings.sharedRepairCount} completed repair{settings.sharedRepairCount === 1 ? "" : "s"} currently contributed.</p>
        </section>
        <div className="privacy-columns wide">
          <section className="privacy-shared"><small>SHARED WHEN ENABLED</small><ul><li>Device model and repair category</li><li>Detected problem and repair outcome</li><li>Recorded parts cost and quality</li><li>Actual labour time, rate and final price</li><li>Country-level region and warranty return</li></ul></section>
          <section className="privacy-private"><small>NEVER IN THE ANONYMOUS POOL</small><ul><li>Customer name, email or phone</li><li>Serial number, IMEI or ticket number</li><li>Tracking links, certificates, photos or private notes</li><li>Your public shop listing is controlled separately below</li></ul></section>
        </div>
        <section className={`marketplace-control wide ${marketplaceEnabled?"enabled":""}`}>
          <label className="sharing-toggle"><input name="marketplaceEnabled" type="checkbox" checked={marketplaceEnabled} onChange={(event)=>setMarketplaceEnabled(event.target.checked)}/><span/><div><strong>Appear in RepairTrace Find</strong><small>Off by default. Customers nearby can compare your published ranges and send a private quote request.</small></div></label>
          <div className="marketplace-fields" aria-hidden={!marketplaceEnabled}>
            <label>Public city or town<input required={marketplaceEnabled} disabled={!marketplaceEnabled} name="marketplaceCity" defaultValue={settings.marketplaceCity} placeholder="e.g. Braga"/></label>
            <label>Region <small>Optional</small><input disabled={!marketplaceEnabled} name="marketplaceRegion" defaultValue={settings.marketplaceRegion} placeholder="e.g. Braga"/></label>
            <label className="wide">Public address label <small>Optional</small><input disabled={!marketplaceEnabled} name="marketplaceAddressLabel" defaultValue={settings.marketplaceAddressLabel} placeholder="e.g. Braga centre · do not enter a private home address"/></label>
            <label>Customer service radius<input disabled={!marketplaceEnabled} name="marketplaceRadiusKm" type="number" min="1" max="250" defaultValue={settings.marketplaceRadiusKm}/><em>km</em></label>
            <div className="marketplace-location"><button type="button" disabled={!marketplaceEnabled||locating} onClick={useWorkshopLocation}>{locating?"Finding location…":coordinates?"✓ Workshop location set":"⌁ Add workshop location"}</button>{coordinates&&<button type="button" className="clear-location" onClick={()=>setCoordinates(null)}>Clear</button>}<small>{coordinates?"Used only for distance matching; exact coordinates are not shown to customers.":"Optional. City matching works without precise location."}</small>{locationError&&<em>{locationError}</em>}</div>
          </div>
          <p><b>What becomes public:</b> shop name, city, optional address label, service radius, aggregated repair ranges and typical turnaround. Customer records, notes, serial numbers and individual jobs stay private.</p>
        </section>
        <label>Workshop country<select name="countryCode" defaultValue={settings.countryCode}><option value="PT">Portugal</option><option value="ES">Spain</option><option value="FR">France</option><option value="DE">Germany</option><option value="IT">Italy</option><option value="NL">Netherlands</option><option value="GB">United Kingdom</option><option value="US">United States</option><option value="BR">Brazil</option></select></label>
        <label>Default hourly labour (€)<input required name="defaultLaborRate" type="number" min="0" max="1000" step="0.01" defaultValue={settings.defaultLaborRate}/></label>
        <label className="default-labor-toggle wide"><input name="includeLaborByDefault" type="checkbox" defaultChecked={settings.includeLaborByDefault}/><span><strong>Include labour in new estimates by default</strong><small>Each repair can still override this or ignore labour completely.</small></span></label>
        <footer><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving privacy choice…" : "Save settings"}</button></footer>
      </form>
    </section>
  </>;
}
