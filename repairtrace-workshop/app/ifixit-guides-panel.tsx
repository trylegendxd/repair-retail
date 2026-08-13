"use client";

import type { IfixitGuideCandidate } from "../lib/ifixit";

export type IfixitGuideWorkspace = {
  repairId: string;
  model: string;
  query: string;
  candidates: IfixitGuideCandidate[];
  searchUrl: string;
};

type Props = {
  data: IfixitGuideWorkspace | null;
  loading: boolean;
  saving: boolean;
  onSearch: (query: string) => void;
  onSelect: (guideId: number) => void;
  onImport: (url: string) => void;
};

export default function IfixitGuidesPanel({ data, loading, saving, onSearch, onSelect, onImport }: Props) {
  if (loading) return <section className="ifixit-loading"><span className="spinner"/><strong>Matching the exact device and repair on iFixit…</strong></section>;
  if (!data) return <section className="ifixit-empty"><b>▤</b><h2>iFixit Guides unavailable</h2><p>RepairTrace could not load the guide workspace for this repair.</p></section>;
  const selected = data.candidates.find((candidate) => candidate.selected) ?? data.candidates[0];
  return <>
    <section className="ifixit-hero">
      <div><span>iF</span><div><small>MODEL-SPECIFIC REFERENCE WORKSPACE</small><h2>iFixit Guides</h2><p>Match the correct device variant, then open the complete guide directly on iFixit.</p></div></div>
      <form onSubmit={(event) => { event.preventDefault(); const query = String(new FormData(event.currentTarget).get("query") ?? "").trim(); if (query) onSearch(query); }}>
        <label><small>DEVICE + REPAIR SEARCH</small><input name="query" defaultValue={data.query} placeholder="e.g. iPhone 14 Pro screen replacement"/></label>
        <button disabled={saving}>⌕ {saving ? "Checking…" : "Find exact guides"}</button>
      </form>
    </section>

    <section className="ifixit-import">
      <span><small>ALREADY HAVE THE EXACT GUIDE?</small><strong>Paste its iFixit URL</strong><p>This gives the technician a reliable manual fallback when automatic matching is unavailable or the device has an unusual regional variant.</p></span>
      <form onSubmit={(event) => { event.preventDefault(); const url = String(new FormData(event.currentTarget).get("url") ?? "").trim(); if (url) onImport(url); }}><input name="url" type="url" placeholder="https://www.ifixit.com/Guide/…/123456"/><button disabled={saving}>Import & use</button></form>
    </section>

    {!selected && <section className="ifixit-empty"><b>⌕</b><h2>No guide candidate was confirmed</h2><p>Try the full manufacturer, model, regional variant and repair name. You can still search iFixit directly.</p><a href={data.searchUrl} target="_blank" rel="noreferrer">Search on iFixit ↗</a></section>}

    {selected && <>
      <section className={`ifixit-match ifixit-match-${selected.matchLevel.toLowerCase()}`}>
        <header><span><small>TECHNICIAN-SELECTED SOURCE</small><h3>{selected.title}</h3><p>{selected.subject}{selected.category && selected.category !== selected.subject ? ` · ${selected.category}` : ""}</p></span><em>{selected.matchLevel} match · {Math.round(selected.matchScore * 100)}%</em></header>
        {selected.summary && <p className="ifixit-summary">{selected.summary}</p>}
        <div className="ifixit-metrics">
          <span><small>FULL SOURCE STEPS</small><strong>{selected.stepCount || "—"}</strong></span>
          <span><small>MATCH CONFIDENCE</small><strong>{Math.round(selected.matchScore * 100)}%</strong></span>
          <span><small>TOOLS LISTED</small><strong>{selected.tools.length || "—"}</strong></span>
        </div>
        <div className="ifixit-source-actions"><a href={selected.url} target="_blank" rel="noreferrer">Open full guide on iFixit ↗</a><small>{selected.difficulty || "Difficulty not listed"}{selected.duration ? ` · ${selected.duration}` : ""}</small></div>
      </section>

      {selected.tools.length > 0 && <section className="ifixit-tools"><div className="guide-section-heading"><span><small>SOURCE TOOL LIST</small><h3>Tools named by this guide</h3></span><em>{selected.tools.length}</em></div><div>{selected.tools.map((tool) => <span key={tool}>✓ {tool}</span>)}</div></section>}
    </>}

    {data.candidates.length > 0 && <section className="ifixit-candidates">
      <div className="guide-section-heading"><span><small>VERIFY THE VARIANT</small><h3>Candidate guides</h3></span><em>{data.candidates.length} checked</em></div>
      <div>{data.candidates.map((candidate) => <article className={candidate.selected ? "selected" : ""} key={candidate.guideId}><span><small>{candidate.matchLevel} · {Math.round(candidate.matchScore * 100)}%</small><strong>{candidate.title}</strong><p>{candidate.subject || candidate.category}</p></span><button disabled={saving || candidate.selected} onClick={() => onSelect(candidate.guideId)}>{candidate.selected ? "✓ Selected" : "Use this reference"}</button></article>)}</div>
    </section>}

    <p className="ifixit-attribution">Guide content remains on iFixit. RepairTrace stores only reference metadata and links; use the complete iFixit page for its sequence, photographs, comments and revisions.</p>
  </>;
}
