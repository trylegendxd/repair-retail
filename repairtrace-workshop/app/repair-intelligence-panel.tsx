"use client";

export type BenchmarkMetric = { count: number; median: number | null; p25: number | null; p75: number | null };
export type BenchmarkSummary = {
  sampleSize: number;
  countryCount: number;
  confidence: "High" | "Medium" | "Low" | "Emerging" | "None";
  matchType: "exact-fault" | "model-only" | "none";
  partCost: BenchmarkMetric;
  laborHours: BenchmarkMetric;
  laborRate: BenchmarkMetric;
  totalPrice: BenchmarkMetric;
  successRate: number | null;
  warrantyReturnRate: number | null;
};

export type RepairIntelligence = {
  repairId: string;
  model: string;
  faults: Array<{ key: string; label: string }>;
  currency: "EUR";
  countryCode: string;
  dataSharingEnabled: boolean;
  sharedRepairCount: number;
  globalRecordCount: number;
  ownShop: BenchmarkSummary;
  regional: BenchmarkSummary;
  network: BenchmarkSummary;
  guide: { url: string; source: string; exactMatch: boolean };
};

function euro(value: number | null) { return value === null ? "—" : `€${value.toFixed(2)}`; }
function hours(value: number | null) { return value === null ? "—" : `${value.toFixed(2)} h`; }
function range(metric: BenchmarkMetric, formatter: (value: number | null) => string) {
  return metric.p25 === null || metric.p75 === null ? `${metric.count} recorded` : `${formatter(metric.p25)}–${formatter(metric.p75)} · n=${metric.count}`;
}

function BenchmarkCard({ title, subtitle, summary }: { title: string; subtitle: string; summary: BenchmarkSummary }) {
  const matchLabel = summary.matchType === "exact-fault" ? "Exact model + problem" : summary.matchType === "model-only" ? "Exact model only" : "Waiting for matches";
  return <article className="benchmark-card">
    <header><span><small>{subtitle}</small><strong>{title}</strong></span><em className={`benchmark-confidence benchmark-${summary.confidence.toLowerCase()}`}>{summary.confidence}</em></header>
    {summary.sampleSize > 0 ? <>
      <div className="benchmark-sample"><strong>{summary.sampleSize}</strong><span>completed repair{summary.sampleSize === 1 ? "" : "s"}<small>{matchLabel}{summary.countryCount > 1 ? ` · ${summary.countryCount} countries` : ""}</small></span></div>
      <dl>
        <div><dt>Recorded parts</dt><dd><strong>{euro(summary.partCost.median)}</strong><small>{range(summary.partCost, euro)}</small></dd></div>
        <div><dt>Actual labour</dt><dd><strong>{hours(summary.laborHours.median)}</strong><small>{range(summary.laborHours, hours)}</small></dd></div>
        <div><dt>Customer price</dt><dd><strong>{euro(summary.totalPrice.median)}</strong><small>{range(summary.totalPrice, euro)}</small></dd></div>
      </dl>
      <footer><span>Success <strong>{summary.successRate === null ? "—" : `${summary.successRate}%`}</strong></span><span>Warranty return <strong>{summary.warrantyReturnRate === null ? "—" : `${summary.warrantyReturnRate}%`}</strong></span></footer>
    </> : <div className="benchmark-empty"><b>⌁</b><strong>No matching repairs yet</strong><p>This source will appear once completed repairs match this model and problem.</p></div>}
  </article>;
}

export default function RepairIntelligencePanel({ data, loading, onOpenSettings, onOpenGuides }: { data: RepairIntelligence | null; loading: boolean; onOpenSettings: () => void; onOpenGuides: () => void }) {
  if (loading) return <section className="network-loading"><span className="spinner"/><strong>Comparing verified repair history…</strong></section>;
  if (!data) return <section className="network-loading"><b>⌁</b><strong>Repair intelligence is unavailable for this record.</strong></section>;
  return <section className="network-intelligence">
    <div className="network-head"><span className="network-mark">⌁</span><div><small>REPAIRTRACE INTELLIGENCE</small><h3>{data.model}</h3><p>Observed repair outcomes stay separate from live marketplace estimates.</p></div><em>{data.globalRecordCount} shared globally</em></div>
    <div className="network-faults">{data.faults.map((fault) => <span key={fault.key}>✓ {fault.label}</span>)}</div>
    <div className="benchmark-grid">
      <BenchmarkCard title="My shop" subtitle="PRIVATE HISTORY" summary={data.ownShop}/>
      <BenchmarkCard title={data.countryCode} subtitle="REGIONAL NETWORK" summary={data.regional}/>
      <BenchmarkCard title="All regions" subtitle="GLOBAL NETWORK" summary={data.network}/>
    </div>
    <div className="guide-result"><b>▤</b><span><small>{data.guide.exactMatch ? "MATCHED PROCEDURE" : "GUIDE SEARCH"}</small><strong>{data.guide.source}</strong><p>Review the match confidence and choose the exact physical variant before starting.</p></span><button onClick={onOpenGuides}>Open in iFixit tab →</button></div>
    <div className={`network-consent ${data.dataSharingEnabled ? "sharing-on" : "sharing-off"}`}><span>{data.dataSharingEnabled ? "✓" : "○"}</span><div><strong>{data.dataSharingEnabled ? "Anonymous contribution enabled" : "Your repairs are not being shared"}</strong><small>{data.dataSharingEnabled ? `${data.sharedRepairCount} completed repair${data.sharedRepairCount === 1 ? "" : "s"} contributed. Customer data is excluded.` : "Opt in only if you want completed repair facts to improve network benchmarks."}</small></div><button onClick={onOpenSettings}>Manage privacy</button></div>
    <footer className="network-method">Medians and 25th–75th percentile ranges are shown instead of misleading simple averages. Low sample counts are labelled clearly.</footer>
  </section>;
}
