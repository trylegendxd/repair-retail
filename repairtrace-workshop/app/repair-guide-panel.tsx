import PartIllustration from "./part-illustration";

export type RepairGuidePart = {
  name: string;
  reason: string;
  origin: "Recorded" | "Recommended" | "Consumable";
};

export type RepairGuideStep = {
  title: string;
  instruction: string;
  checkpoint: string;
};

export type RepairGuide = {
  id: string;
  recognizedModel: string;
  title: string;
  difficulty: "Basic" | "Intermediate" | "Advanced" | "Restricted";
  estimatedMinutes: number;
  riskLevel: "Standard" | "Elevated" | "High";
  overview: string;
  tools: string[];
  parts: RepairGuidePart[];
  precautions: string[];
  steps: RepairGuideStep[];
  sourceUrl: string;
  sourceLabel: string;
  sourceGuideId: number | null;
  sourceMatchLevel: "Exact" | "Strong" | "Possible" | "Unverified";
  sourceCheckedAt: string;
  generatedAt: string;
  updatedAt: string;
};

type Props = {
  device: string;
  issue: string;
  faultKey?: string;
  faultLabels: string[];
  guide?: RepairGuide | null;
  saving: boolean;
  onGenerate: () => void;
  onOpenReference: () => void;
};

function duration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

export default function RepairGuidePanel({ device, issue, faultKey, faultLabels, guide, saving, onGenerate, onOpenReference }: Props) {
  if (!guide) return <section className="guide-empty">
    <span className="guide-empty-mark"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M10 5h13l5 5v21H10z"/><path d="M23 5v6h5M14 16h10M14 21h10M14 26h6"/></svg></span>
    <small>AI-ASSISTED WORKSHOP GUIDE</small>
    <h2>Build a guide for {device}</h2>
    <p>RepairTrace will turn this repair’s reported issue, diagnosis, detected problems and recorded parts into a saved bench plan.</p>
    <div className="guide-empty-scope">
      <span><b>Reported need</b><small>{issue}</small></span>
      <span><b>Guide includes</b><small>Tools · parts · safety · ordered checkpoints</small></span>
    </div>
    {faultLabels.length > 0 && <div className="guide-fault-chips">{faultLabels.map((label) => <span key={label}>{label}</span>)}</div>}
    <button disabled={saving} onClick={onGenerate}>{saving ? "Building your guide…" : "✦ Generate custom repair guide"}</button>
    <footer>Exact hidden layout and manufacturer procedures are always linked for verification.</footer>
  </section>;

  return <>
    <section className={`guide-hero guide-risk-${guide.riskLevel.toLowerCase()}`}>
      <div className="guide-hero-head"><span className="guide-hero-mark">✦</span><div><small>AI-ASSISTED WORKSHOP GUIDE</small><h2>{guide.title}</h2></div><em>{guide.riskLevel} risk</em></div>
      <p>{guide.overview}</p>
      <div className="guide-stats">
        <span><small>MODEL</small><strong>{guide.recognizedModel}</strong></span>
        <span><small>DIFFICULTY</small><strong>{guide.difficulty}</strong></span>
        <span><small>BENCH TIME</small><strong>{duration(guide.estimatedMinutes)}</strong></span>
      </div>
      <button disabled={saving} onClick={onGenerate}>{saving ? "Regenerating…" : "↻ Regenerate from latest repair data"}</button>
    </section>

    <section className="guide-requirements">
      <div className="guide-section-heading"><span><small>PREPARE THE BENCH</small><h3>Tools and equipment</h3></span><em>{guide.tools.length} items</em></div>
      <div className="guide-tool-grid">{guide.tools.map((tool) => <span key={tool}><b>✓</b>{tool}</span>)}</div>
    </section>

    <section className="guide-parts">
      <div className="guide-section-heading"><span><small>PARTS & CONSUMABLES</small><h3>What this repair needs</h3></span><em>{guide.parts.length} items</em></div>
      <div>{guide.parts.map((part) => <article key={`${part.origin}-${part.name}`}><PartIllustration partName={part.name} faultKey={faultKey}/><span><strong>{part.name}</strong><small>{part.reason}</small></span><em className={`guide-origin guide-origin-${part.origin.toLowerCase()}`}>{part.origin}</em></article>)}</div>
    </section>

    <section className={`guide-safety guide-safety-${guide.riskLevel.toLowerCase()}`}>
      <div className="guide-section-heading"><span><small>BEFORE YOU START</small><h3>Safety precautions</h3></span><em>{guide.riskLevel}</em></div>
      <ul>{guide.precautions.map((precaution) => <li key={precaution}><b>!</b><span>{precaution}</span></li>)}</ul>
    </section>

    <section className="guide-procedure">
      <div className="guide-section-heading"><span><small>CUSTOM PROCEDURE</small><h3>Step-by-step repair plan</h3></span><em>{guide.steps.length} steps</em></div>
      <ol>{guide.steps.map((step, index) => <li key={`${index}-${step.title}`}><b>{index + 1}</b><article><h4>{step.title}</h4><p>{step.instruction}</p><div><span>✓</span><small>Checkpoint</small><strong>{step.checkpoint}</strong></div></article></li>)}</ol>
    </section>

    <section className="guide-reference">
      <span><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 8h9a5 5 0 0 1 5 5v14H10a5 5 0 0 0-5 2zM27 8h-5a5 5 0 0 0-3 1M19 27h3a5 5 0 0 1 5 2V8"/></svg></span>
      <div><small>COMPLETE MODEL REFERENCE</small><strong>{guide.sourceLabel}</strong><p>Open the full guide for its complete sequence, photographs, warnings and revisions.</p></div>
      <button onClick={onOpenReference}>Open in tab →</button>
    </section>
    <p className="guide-disclaimer">Generated {new Intl.DateTimeFormat("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }).format(new Date(guide.generatedAt))}. This is a technician’s planning draft, not a substitute for the exact manufacturer safety and service procedure.</p>
  </>;
}
