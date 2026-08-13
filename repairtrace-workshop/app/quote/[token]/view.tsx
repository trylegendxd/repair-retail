"use client";

import { useState } from "react";

type Quote = {
  ticket: string; shopName: string; currency: string; customer: string; device: string; issue: string; diagnosis: string;
  total: number; quoteStatus: string; quoteSentAt: string | null; quoteRespondedAt: string | null; warrantyDays: number;
};

export default function QuoteView({ token, initialQuote }: { token: string; initialQuote: Quote }) {
  const [quote, setQuote] = useState(initialQuote);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function respond(response: "approved" | "declined") {
    setSaving(true); setError("");
    try {
      const result = await fetch(`/api/quotes/${token}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ response }) });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error);
      setQuote(data.quote);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not record your response."); }
    finally { setSaving(false); }
  }
  const answered = quote.quoteStatus === "approved" || quote.quoteStatus === "declined";
  const active = quote.quoteStatus === "sent" || answered;
  return <main className="document-shell">
    <section className="document-card">
      <header><span className="document-logo">✓</span><span><strong>{quote.shopName}</strong><small>Secure repair quote</small></span><em className={`document-status status-${quote.quoteStatus}`}>{quote.quoteStatus}</em></header>
      <div className="document-title"><small>{quote.ticket}</small><h1>Repair approval</h1><p>Hello {quote.customer}, review the proposed repair before the workshop continues.</p></div>
      <div className="document-device"><span><small>DEVICE</small><strong>{quote.device}</strong></span><span><small>WARRANTY</small><strong>{quote.warrantyDays} days</strong></span></div>
      <section className="document-scope"><small>REPORTED REPAIR</small><p>{quote.issue}</p>{quote.diagnosis && quote.diagnosis !== "Awaiting diagnosis." && <><small>WORKSHOP ASSESSMENT</small><p>{quote.diagnosis}</p></>}</section>
      <div className="document-total"><span><small>PROPOSED TOTAL</small><p>Parts and labour according to the workshop estimate</p></span><strong>{new Intl.NumberFormat("en-IE", { style: "currency", currency: quote.currency }).format(quote.total)}</strong></div>
      {!active && <div className="document-warning">This quote is still a workshop draft. Ask the shop to activate it before responding.</div>}
      {active && !answered && <div className="document-actions"><button disabled={saving} className="decline" onClick={() => respond("declined")}>Decline</button><button disabled={saving} className="approve" onClick={() => respond("approved")}>{saving ? "Recording…" : "✓ Approve repair"}</button></div>}
      {answered && <div className={`document-answer answer-${quote.quoteStatus}`}><b>{quote.quoteStatus === "approved" ? "✓" : "×"}</b><span><strong>Quote {quote.quoteStatus}</strong><small>Your response was recorded and the workshop can see it immediately.</small></span></div>}
      {error && <p className="document-error">{error}</p>}
      <footer>Approving authorizes the described work up to the displayed total. The workshop should contact you before materially exceeding it.</footer>
    </section>
  </main>;
}
