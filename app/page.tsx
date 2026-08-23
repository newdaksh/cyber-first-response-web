'use client';

import { useRef, useState } from 'react';
import { createFreshIncident, statusOrder, type Incident, type IncidentStatus } from '../lib/incident';
import { aiProvider, calculateEvidenceCompleteness, demoDescription, governmentService, type ClassificationResult } from '../lib/services';

type IntakeMode = 'speak' | 'type' | 'upload';

const intakeOptions = [
  { id: 'speak', icon: '●', label: 'Speak', note: 'Hindi, English or Hinglish' },
  { id: 'type', icon: 'Aa', label: 'Type', note: 'Describe it in your words' },
  { id: 'upload', icon: '↑', label: 'Upload evidence', note: 'Screenshot, SMS or receipt' },
] as const;

const stageLabels: Partial<Record<IncidentStatus, string>> = {
  INTAKE: 'Understand', TRIAGE: 'Triage', ACTION_REQUIRED: 'Act', EVIDENCE_COLLECTION: 'Evidence', TIMELINE_READY: 'Timeline', CASE_READY: 'Case file', COMPLAINT_READY: 'Complaint', REVIEW: 'Review', HANDOFF: 'Handoff',
};

const typeLabels: Record<string, string> = {
  bank_otp_fraud: 'Possible bank impersonation / financial fraud', upi_payment_fraud: 'Possible UPI / payment fraud', investment_scam: 'Possible investment scam', phishing: 'Possible phishing', account_takeover: 'Possible account takeover', digital_arrest: 'Possible digital-arrest scam', other: 'Possible cyber-enabled incident',
};

const requiredEvidence = [
  ['Transaction screenshot', 'paymentStatus'], ['Amount', 'amount'], ['Transaction ID', 'transactionId'], ['Timestamp', 'time'], ['UPI ID', 'upiId'], ['Phone number', 'phoneNumber'], ['Chat history', 'chatHistory'], ['Bank account details', 'bankAccount'],
];

export default function Home() {
  const [incident, setIncident] = useState<Incident>(() => createFreshIncident());
  const [mode, setMode] = useState<IntakeMode>('type');
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [detected, setDetected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [lowData, setLowData] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [transparency, setTransparency] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function update(patch: Partial<Incident>) {
    setIncident((current) => ({ ...current, ...patch }));
  }

  function resetDemo() {
    setIncident(createFreshIncident());
    setClassification(null); setMissing([]); setDetected({}); setFileName(''); setError(''); setBusy(null);
    window.scrollTo({ top: 0, behavior: lowData ? 'auto' : 'smooth' });
  }

  function begin(selectedMode: IntakeMode) {
    setMode(selectedMode); update({ status: 'INTAKE' }); setError('');
  }

  async function analyze(description = incident.description) {
    if (!description.trim()) { setError('Tell us a little about what happened so we can guide you.'); return; }
    setBusy('Understanding your incident…'); setError('');
    try {
      const [classified, extracted, actions] = await Promise.all([
        aiProvider.classifyIncident(description), aiProvider.extractIncident(description), aiProvider.generateActionPlan(incident),
      ]);
      const next: Incident = { ...incident, ...extracted, description, incidentType: classified.incidentType, confidence: classified.confidence, severity: classified.severity, actionPlan: actions, status: 'TRIAGE' };
      setIncident(next); setClassification(classified); setMissing(await aiProvider.detectMissingFields(next));
      window.scrollTo({ top: 0, behavior: lowData ? 'auto' : 'smooth' });
    } catch {
      setError('We could not analyze this automatically. Your description is safe here—you can retry or continue with demo results.');
    } finally { setBusy(null); }
  }

  async function loadDemo() {
    const fresh = createFreshIncident();
    setIncident({ ...fresh, description: demoDescription, status: 'INTAKE' });
    setMode('speak'); setBusy('Loading the fictional demo incident…');
    try {
      const classified = await aiProvider.classifyIncident(demoDescription);
      const extracted = await aiProvider.extractIncident(demoDescription);
      const actions = await aiProvider.generateActionPlan(fresh);
      const next: Incident = { ...fresh, ...extracted, description: demoDescription, incidentType: classified.incidentType, confidence: classified.confidence, severity: classified.severity, actionPlan: actions, status: 'TRIAGE' };
      setIncident(next); setClassification(classified); setMissing(await aiProvider.detectMissingFields(next));
    } finally { setBusy(null); }
  }

  function simulateVoice() {
    setBusy('Listening… speak naturally in Hindi, English, or Hinglish.');
    setTimeout(() => { update({ description: demoDescription }); setBusy(null); }, 900);
  }

  function saveClarification(formData: FormData) {
    update({ bank: String(formData.get('bank') || 'Demo Bank'), incidentDate: '23 Aug 2026', incidentTime: String(formData.get('time') || '10:51 AM'), status: 'ACTION_REQUIRED' });
  }

  function toggleAction(id: string) {
    update({ actionPlan: incident.actionPlan.map((action) => action.id === id ? { ...action, completed: !action.completed } : action) });
  }

  async function extractEvidence() {
    setBusy('Reading the transaction details…'); setError('');
    try {
      const result = await aiProvider.extractEvidence(fileName || 'demo-payment-receipt.png');
      setDetected(result.detected);
      update({ evidence: [result.evidence], entities: { ...incident.entities, upiIds: [result.detected.upiId], transactionIds: [result.detected.transactionId], phoneNumbers: [result.detected.phoneNumber] } });
    } catch { setError('We could not read this automatically. You can retry or enter the details manually.'); }
    finally { setBusy(null); }
  }

  async function buildTimeline() {
    setBusy('Reconstructing what happened…');
    try { update({ timeline: await aiProvider.generateTimeline(incident), status: 'TIMELINE_READY' }); }
    catch { setError('Timeline generation paused. Retry to use the reliable demo fallback.'); }
    finally { setBusy(null); }
  }

  async function buildComplaint() {
    setBusy('Preparing a clear complaint draft…'); setError('');
    try {
      const draft = await aiProvider.generateComplaint(incident);
      update({ complaint: { ...incident.complaint, draft, handoffStatus: 'ready' }, status: 'COMPLAINT_READY' });
    } catch { setError('The draft could not be prepared automatically. Retry to use the structured demo fallback.'); }
    finally { setBusy(null); }
  }

  async function completeHandoff() {
    setBusy('Preparing the official-channel handoff…'); setError('');
    try {
      const result = await governmentService.simulateHandoff();
      update({ status: 'HANDOFF', complaint: { ...incident.complaint, reviewed: true, handoffStatus: result.status } });
    } catch { setError('The handoff preview could not be prepared. Nothing was submitted. Please retry.'); }
    finally { setBusy(null); }
  }

  const shellClass = ['site-shell', lowData && 'low-data', largeText && 'large-text'].filter(Boolean).join(' ');
  const showWorkflow = incident.status !== 'NEW';

  return (
    <main className={shellClass}>
      <a className="skip-link" href="#main-content">Skip to incident workflow</a>
      <AppHeader lowData={lowData} setLowData={setLowData} largeText={largeText} setLargeText={setLargeText} onTransparency={() => setTransparency(true)} onReset={resetDemo} showReset={showWorkflow} />
      {showWorkflow && <Progress status={incident.status} />}

      <div id="main-content" tabIndex={-1}>
        {incident.status === 'NEW' && <Landing onBegin={begin} onDemo={loadDemo} busy={busy} />}
        {incident.status === 'INTAKE' && <Intake mode={mode} incident={incident} busy={busy} error={error} onDescription={(description) => update({ description })} onVoice={simulateVoice} onAnalyze={() => analyze()} onBack={resetDemo} />}
        {incident.status === 'TRIAGE' && <Triage incident={incident} classification={classification} missing={missing} onSubmit={saveClarification} />}
        {incident.status === 'ACTION_REQUIRED' && <ActionPlan incident={incident} onToggle={toggleAction} onContinue={() => update({ status: 'EVIDENCE_COLLECTION' })} />}
        {incident.status === 'EVIDENCE_COLLECTION' && <EvidenceScreen incident={incident} detected={detected} fileName={fileName} busy={busy} error={error} fileRef={fileRef} onChoose={() => fileRef.current?.click()} onFile={(name) => setFileName(name)} onExtract={extractEvidence} onContinue={buildTimeline} />}
        {incident.status === 'TIMELINE_READY' && <TimelineScreen incident={incident} onContinue={() => update({ status: 'CASE_READY' })} />}
        {incident.status === 'CASE_READY' && <CaseFile incident={incident} completeness={calculateEvidenceCompleteness(detected)} onContinue={buildComplaint} busy={busy} error={error} />}
        {(incident.status === 'COMPLAINT_READY' || incident.status === 'REVIEW') && <ComplaintScreen incident={incident} onChange={(draft) => update({ complaint: { ...incident.complaint, draft } })} onReview={() => update({ status: 'REVIEW', complaint: { ...incident.complaint, reviewed: true } })} onHandoff={completeHandoff} busy={busy} error={error} />}
        {incident.status === 'HANDOFF' && <Handoff incident={incident} onReset={resetDemo} onTransparency={() => setTransparency(true)} />}
      </div>

      {busy && <div className="busy-overlay" role="status" aria-live="polite"><span className="spinner" /><strong>{busy}</strong><small>Using secure fictional demo data</small></div>}
      {transparency && <Transparency onClose={() => setTransparency(false)} />}
      {!showWorkflow && <TrustFooter />}
    </main>
  );
}

function AppHeader({ lowData, setLowData, largeText, setLargeText, onTransparency, onReset, showReset }: { lowData: boolean; setLowData: (value: boolean) => void; largeText: boolean; setLargeText: (value: boolean) => void; onTransparency: () => void; onReset: () => void; showReset: boolean }) {
  return <header className="topbar">
    <button className="brand brand-button" type="button" onClick={onReset} aria-label="Cyber First Response home">
      <span className="brand-mark" aria-hidden="true">C</span><span><strong>Cyber First Response</strong><small>The first 30 minutes after a cybercrime.</small></span>
    </button>
    <div className="topbar-actions">
      <label className="data-toggle"><input type="checkbox" checked={lowData} onChange={(event) => setLowData(event.target.checked)} /><span aria-hidden="true" />Low-data</label>
      <button className={largeText ? 'utility-button active' : 'utility-button'} type="button" onClick={() => setLargeText(!largeText)} aria-pressed={largeText}>A<span>A</span></button>
      <button className="text-button" type="button" onClick={onTransparency}>What is simulated?</button>
      {showReset && <button className="reset-button" type="button" onClick={onReset}>↻ Reset demo</button>}
    </div>
  </header>;
}

function Progress({ status }: { status: IncidentStatus }) {
  const stages = Object.entries(stageLabels) as [IncidentStatus, string][];
  const current = statusOrder.indexOf(status);
  return <nav className="progress-wrap" aria-label="Incident progress"><ol>{stages.map(([key, label], index) => <li key={key} className={statusOrder.indexOf(key) < current ? 'done' : key === status ? 'current' : ''}><span>{statusOrder.indexOf(key) < current ? '✓' : index + 1}</span><small>{label}</small></li>)}</ol></nav>;
}

function Landing({ onBegin, onDemo, busy }: { onBegin: (mode: IntakeMode) => void; onDemo: () => void; busy: string | null }) {
  return <section className="hero" id="top">
    <div className="trust-pill always"><span /> Prototype · Not a government service</div>
    <p className="eyebrow"><span aria-hidden="true">●</span> Immediate cybercrime guidance</p>
    <h1>Got scammed?<br /><em>Don&apos;t panic.</em></h1>
    <p className="hero-copy">Tell us what happened. We&apos;ll help you take the right first steps, preserve evidence, and prepare for official reporting.</p>
    <div className="reassurance"><span aria-hidden="true">✓</span><p><strong>You&apos;re not alone.</strong><br />Let&apos;s handle this step by step.</p></div>
    <div className="intake-card" aria-labelledby="intake-heading">
      <div className="card-heading"><span className="step-number">1</span><div><h2 id="intake-heading">Tell us what happened</h2><p>Choose the easiest way to begin.</p></div></div>
      <div className="intake-options">{intakeOptions.map((option) => <button key={option.id} className="intake-option" type="button" onClick={() => onBegin(option.id)}><span className="option-icon" aria-hidden="true">{option.icon}</span><span><strong>{option.label}</strong><small>{option.note}</small></span><span className="arrow" aria-hidden="true">→</span></button>)}</div>
      <div className="or-divider"><span>or try the judge-ready path</span></div>
      <button className="demo-button" type="button" onClick={onDemo} disabled={Boolean(busy)}><span aria-hidden="true">▶</span> Load ₹25,000 demo incident</button>
    </div>
    <div className="safety-strip"><div className="shield" aria-hidden="true">✓</div><p><strong>Your safety comes first</strong><span>We will never ask for your OTP, PIN, password, or payment.</span></p></div>
  </section>;
}

function Intake({ mode, incident, busy, error, onDescription, onVoice, onAnalyze, onBack }: { mode: IntakeMode; incident: Incident; busy: string | null; error: string; onDescription: (value: string) => void; onVoice: () => void; onAnalyze: () => void; onBack: () => void }) {
  return <section className="workflow-page narrow-page">
    <button className="back-link" onClick={onBack} type="button">← Start again</button>
    <p className="section-kicker">Step 1 · Understand</p><h1 className="page-title">Tell us what happened.</h1><p className="page-lead">Use your own words. Hindi, English, and Hinglish are welcome. You don&apos;t need to remember everything yet.</p>
    <div className="calm-note"><span>♥</span><p><strong>Take a breath.</strong> Share only what you are comfortable sharing. Never enter an OTP, PIN, or password.</p></div>
    {mode === 'speak' && <div className="voice-panel"><button className={busy?.startsWith('Listening') ? 'mic-button listening' : 'mic-button'} type="button" onClick={onVoice} disabled={Boolean(busy)}><span>●</span></button><div><strong>{busy?.startsWith('Listening') ? 'Listening…' : 'Tap to speak'}</strong><small>Voice understanding is simulated for this prototype</small></div></div>}
    {mode === 'upload' && <div className="quick-upload"><span>▧</span><div><strong>Evidence can help tell the story</strong><p>For the safest demo, we&apos;ll first use your short description and collect the fictional screenshot after the action plan.</p></div></div>}
    <label className="field-label" htmlFor="description">What happened?</label>
    <textarea id="description" className="incident-input" value={incident.description} onChange={(event) => onDescription(event.target.value)} placeholder="Example: Mujhe bank se call aaya tha KYC ke liye... OTP liya aur 25 hazaar kat gaya." rows={6} />
    <div className="input-meta"><span>Speak or type naturally—no legal language needed.</span><button type="button" onClick={() => onDescription(demoDescription)}>Use demo words</button></div>
    {error && <p className="error-message" role="alert">! {error}</p>}
    <button className="primary-button full" type="button" onClick={onAnalyze} disabled={Boolean(busy)}>Understand my incident <span>→</span></button>
  </section>;
}

function Triage({ incident, classification, missing, onSubmit }: { incident: Incident; classification: ClassificationResult | null; missing: string[]; onSubmit: (data: FormData) => void }) {
  return <section className="workflow-page">
    <div className="page-heading"><div><p className="section-kicker">Step 2 · Triage</p><h1 className="page-title">Here&apos;s what we understood.</h1><p className="page-lead">Please check these details. This is a possible classification, not an accusation or final determination.</p></div><div className="confidence"><span>{Math.round((incident.confidence ?? 0) * 100)}%</span><small>confidence</small></div></div>
    <div className="classification-banner"><span className="alert-symbol">!</span><div><small>AI-assisted assessment</small><h2>{typeLabels[incident.incidentType ?? 'other']}</h2><p>{classification?.rationale ?? 'The description appears consistent with a financial cybercrime pattern.'}</p></div><strong className={`severity ${incident.severity}`}>{incident.severity} priority</strong></div>
    <div className="understood-grid">
      <Detail label="Incident type" value="Bank / OTP fraud" state="found" />
      <Detail label="Financial loss" value={incident.amount ? `₹${incident.amount.toLocaleString('en-IN')}` : 'Not known'} state={incident.amount ? 'found' : 'missing'} />
      <Detail label="OTP involved" value={incident.otpInvolved ? 'Yes — reported' : 'Not detected'} state={incident.otpInvolved ? 'warning' : 'missing'} />
      <Detail label="Payment method" value={incident.paymentMethod ?? 'Not known'} state={incident.paymentMethod ? 'found' : 'missing'} />
      <Detail label="Bank" value={incident.bank ?? 'We need this'} state={incident.bank ? 'found' : 'missing'} />
      <Detail label="Transaction ID" value={incident.entities.transactionIds[0] ?? 'We need this'} state={incident.entities.transactionIds.length ? 'found' : 'missing'} />
    </div>
    <form className="clarify-card" action={onSubmit}>
      <div className="card-heading"><span className="step-number light">?</span><div><h2>Two quick questions</h2><p>Only the details that change what you should do next.</p></div></div>
      <div className="form-grid"><label>Which bank was involved?<select name="bank" defaultValue=""><option value="" disabled>Select a fictional demo bank</option><option>Demo Bank</option><option>Sample Payments Bank</option><option>Bank not known</option></select></label><label>When did the transaction happen?<input name="time" defaultValue="10:51 AM, 23 Aug 2026" /></label></div>
      <p className="missing-note">Still okay to continue: {missing.includes('transactionId') ? 'transaction ID can be found from your screenshot.' : 'we have the essential details.'}</p>
      <button className="primary-button" type="submit">Show my first-response plan <span>→</span></button>
    </form>
  </section>;
}

function Detail({ label, value, state }: { label: string; value: string; state: 'found' | 'missing' | 'warning' }) {
  return <div className={`detail-item ${state}`}><span className="detail-status">{state === 'found' ? '✓' : state === 'warning' ? '!' : '·'}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function ActionPlan({ incident, onToggle, onContinue }: { incident: Incident; onToggle: (id: string) => void; onContinue: () => void }) {
  return <section className="workflow-page action-page">
    <div className="first-30-header"><div className="timer-badge"><span>30</span><small>MIN</small></div><div><p className="section-kicker red">Priority response</p><h1>FIRST 30 MINUTES</h1><p>Your next actions matter. Act quickly—immediate reporting can help financial institutions and authorities respond to suspected fraudulent transactions.</p></div></div>
    <div className="stop-banner"><span>STOP</span><div><strong>Do not make another payment.</strong><p>Do not share another OTP. Do not trust anyone asking for a recovery fee.</p></div></div>
    <div className="action-layout"><div className="action-list"><div className="list-heading"><h2>Your personalized action plan</h2><span>{incident.actionPlan.filter((item) => item.completed).length}/{incident.actionPlan.length} marked done</span></div>{incident.actionPlan.map((action, index) => <button className={`action-row ${action.completed ? 'completed' : ''}`} key={action.id} type="button" onClick={() => onToggle(action.id)}><span className="action-check">{action.completed ? '✓' : index + 1}</span><span className="action-copy"><span className={`priority-label ${action.priority}`}>{action.priority === 'now' ? 'DO THIS NOW' : action.priority === 'next' ? 'DO THIS NEXT' : 'PROTECT YOURSELF'}</span><strong>{action.title}</strong><small>{action.detail}</small></span><span className="mark-label">{action.completed ? 'Done' : 'Mark done'}</span></button>)}</div>
      <aside className="help-card"><span className="phone-icon">☎</span><p className="section-kicker">Official helpline</p><h2>Call 1930</h2><p>India&apos;s official helpline for reporting cyber financial fraud.</p><div className="help-details"><span>Have ready</span><strong>Amount · time · bank · transaction reference</strong></div><a className="call-button" href="tel:1930">Call 1930 now</a><small>Opens your phone dialler. This prototype does not place or track the call.</small></aside>
    </div>
    <div className="preserve-banner"><span>▣</span><div><strong>Preserve this conversation and every receipt.</strong><p>Do not delete messages, call logs, screenshots, or transaction alerts that may support your complaint.</p></div></div>
    <div className="page-actions"><span>You can continue while completing these actions in parallel.</span><button className="primary-button" type="button" onClick={onContinue}>Collect my evidence <span>→</span></button></div>
  </section>;
}

function EvidenceScreen({ incident, detected, fileName, busy, error, fileRef, onChoose, onFile, onExtract, onContinue }: { incident: Incident; detected: Record<string, string>; fileName: string; busy: string | null; error: string; fileRef: React.RefObject<HTMLInputElement | null>; onChoose: () => void; onFile: (name: string) => void; onExtract: () => void; onContinue: () => void }) {
  const completeness = calculateEvidenceCompleteness(detected);
  return <section className="workflow-page">
    <div className="page-heading"><div><p className="section-kicker">Step 4 · Evidence intelligence</p><h1 className="page-title">Turn screenshots into evidence.</h1><p className="page-lead">Upload a fictional payment screenshot or use the built-in demo receipt. Nothing is sent to a bank or government system.</p></div>{incident.evidence.length > 0 && <div className="completeness-ring" style={{ '--progress': `${completeness * 3.6}deg` } as React.CSSProperties}><span>{completeness}%</span><small>complete</small></div>}</div>
    <div className="evidence-layout"><div><input ref={fileRef} type="file" accept="image/*,.pdf" hidden onChange={(event) => onFile(event.target.files?.[0]?.name ?? '')} /><button className="upload-zone" type="button" onClick={onChoose}><span className="upload-icon">↑</span><strong>{fileName || 'Upload payment screenshot'}</strong><small>PNG, JPG, or PDF · Use fictional/demo files only</small></button><button className="demo-receipt" type="button" onClick={() => onFile('demo-payment-receipt.png')}><span className="mini-receipt">₹<i>25,000</i></span><span><strong>Use built-in demo receipt</strong><small>Fictional · 23 Aug 2026 · 10:52 AM</small></span><b>{fileName === 'demo-payment-receipt.png' ? '✓ Selected' : 'Select →'}</b></button>{error && <p className="error-message">! {error}</p>}<button className="primary-button full" type="button" onClick={onExtract} disabled={Boolean(busy)}>Read transaction details <span>→</span></button></div>
      <div className="detected-panel"><div className="panel-title"><div><p className="section-kicker">Structured extraction</p><h2>Evidence detected</h2></div><span className="simulated-badge">Simulated AI</span></div>{Object.keys(detected).length === 0 ? <div className="empty-detected"><span>⌁</span><strong>No evidence analyzed yet</strong><p>Select the demo receipt to see amount, timestamp, transaction ID, UPI ID, and recipient extracted here.</p></div> : <><dl className="detected-grid">{Object.entries(detected).slice(0, 8).map(([key, value]) => <div key={key}><dt>{formatKey(key)}</dt><dd>{value}</dd></div>)}</dl><div className="case-score"><div><strong>Case evidence completeness</strong><small>Calculated from {Object.keys(detected).length} of 11 critical fields found</small></div><b>{completeness}%</b></div></>}</div></div>
    {Object.keys(detected).length > 0 && <div className="checklist-card"><h2>Evidence checklist</h2><div className="checklist-grid">{requiredEvidence.map(([label, key]) => <div key={key} className={detected[key] ? 'available' : 'missing'}><span>{detected[key] ? '✓' : '!'}</span><strong>{label}</strong><small>{detected[key] ? 'Detected' : 'Missing'}</small></div>)}</div></div>}
    <div className="page-actions"><span>{Object.keys(detected).length ? 'The extracted details will follow your case.' : 'Analyze one evidence item to continue.'}</span><button className="primary-button" type="button" disabled={!Object.keys(detected).length} onClick={onContinue}>Build incident timeline <span>→</span></button></div>
  </section>;
}

function TimelineScreen({ incident, onContinue }: { incident: Incident; onContinue: () => void }) {
  return <section className="workflow-page timeline-page"><div className="center-heading"><p className="section-kicker">Step 5 · Reconstruct</p><h1 className="page-title">Here&apos;s what happened,<br /><em>step by step.</em></h1><p className="page-lead">Built from your description and the fictional transaction evidence. Please verify every event.</p></div><div className="timeline"><div className="timeline-line" />{incident.timeline.map((event, index) => <article className="timeline-event" key={event.id}><div className="timeline-time">{event.timestamp}</div><div className={`timeline-dot ${event.source}`}><span>{index + 1}</span></div><div className="timeline-card"><span className={`source-tag ${event.source}`}>{event.source}</span><h2>{event.title}</h2><p>{event.detail}</p></div></article>)}</div><div className="verify-note"><span>✓</span><div><strong>You&apos;re in control.</strong><p>This timeline is AI-assisted. Treat it as a draft and correct anything that does not match your memory.</p></div><button type="button">Edit timeline</button></div><div className="page-actions"><span>{incident.timeline.length} chronological events organized</span><button className="primary-button" type="button" onClick={onContinue}>Open my case file <span>→</span></button></div></section>;
}

function CaseFile({ incident, completeness, onContinue, busy, error }: { incident: Incident; completeness: number; onContinue: () => void; busy: string | null; error: string }) {
  return <section className="workflow-page"><div className="case-cover"><div><p className="document-label">CYBER INCIDENT CASE FILE</p><h1>Suspected bank impersonation<br />and OTP financial fraud</h1><div className="case-meta"><span><small>Case reference</small><strong>CFR-DEMO-250823</strong></span><span><small>Status</small><strong>Complaint preparation</strong></span><span><small>Evidence completeness</small><strong>{completeness}%</strong></span></div></div><div className="file-stamp"><span>DEMO</span><small>FICTIONAL DATA</small></div></div><div className="case-layout"><div className="case-main"><CaseSection number="01" title="Incident"><div className="case-facts"><Detail label="Assessment" value={typeLabels[incident.incidentType ?? 'other']} state="warning" /><Detail label="Severity" value="High priority" state="warning" /><Detail label="Financial loss" value="₹25,000" state="found" /><Detail label="Date & time" value="23 Aug 2026 · 10:51 AM" state="found" /></div><p className="case-description">{incident.description}</p></CaseSection><CaseSection number="02" title="Evidence"><div className="evidence-file-row"><span>▧</span><div><strong>{incident.evidence[0]?.name}</strong><small>Transaction screenshot · Structured details extracted</small></div><b>Verified in demo</b></div></CaseSection><CaseSection number="03" title="Timeline"><div className="mini-timeline">{incident.timeline.map((event) => <div key={event.id}><strong>{event.timestamp}</strong><span /><p>{event.title}</p></div>)}</div></CaseSection></div><aside className="case-sidebar"><CaseSection number="04" title="Victim information"><dl><dt>Name</dt><dd>Demo User</dd><dt>Data classification</dt><dd>Fictional prototype data</dd></dl></CaseSection><CaseSection number="05" title="Detected entities"><div className="entity-chip"><small>UPI ID</small><strong>{incident.entities.upiIds[0]}</strong></div><div className="entity-chip"><small>Transaction ID</small><strong>{incident.entities.transactionIds[0]}</strong></div><div className="entity-chip"><small>Phone</small><strong>{incident.entities.phoneNumbers[0]}</strong></div></CaseSection><CaseSection number="06" title="Actions taken"><ul className="actions-taken">{incident.actionPlan.filter((action) => action.completed).length ? incident.actionPlan.filter((action) => action.completed).map((action) => <li key={action.id}>✓ {action.title}</li>) : <li>Actions shown; completion not yet confirmed</li>}</ul></CaseSection></aside></div>{error && <p className="error-message" role="alert">! {error}</p>}<div className="page-actions"><span>Professional structure · editable complaint comes next</span><button className="primary-button" type="button" onClick={onContinue} disabled={Boolean(busy)}>Prepare complaint draft <span>→</span></button></div></section>;
}

function CaseSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) { return <section className="case-section"><div className="case-section-title"><span>{number}</span><h2>{title}</h2></div>{children}</section>; }

function ComplaintScreen({ incident, onChange, onReview, onHandoff, busy, error }: { incident: Incident; onChange: (value: string) => void; onReview: () => void; onHandoff: () => void; busy: string | null; error: string }) {
  const reviewed = incident.status === 'REVIEW';
  const reviewItems = ['The amount and transaction details are correct', 'The chronology matches what I remember', 'No OTP, PIN, or password is included', 'I understand this has not been submitted'];
  const [checks, setChecks] = useState(() => reviewItems.map((_, index) => reviewed || index === 2));
  const allChecked = checks.every(Boolean);
  return <section className="workflow-page"><div className="review-header"><div><p className="section-kicker">Step 7 · Prepare</p><h1 className="page-title">Review before you proceed.</h1><p className="page-lead">The complaint is AI-assisted and fully editable. Nothing has been submitted anywhere.</p></div><span className="not-submitted">NOT SUBMITTED</span></div><div className="review-layout"><div className="editor-card"><div className="editor-toolbar"><span>Complaint draft</span><div><button type="button" onClick={() => navigator.clipboard?.writeText(incident.complaint.draft)}>Copy</button><button type="button" onClick={() => window.print()}>Print</button></div></div><textarea aria-label="Editable complaint draft" value={incident.complaint.draft} onChange={(event) => onChange(event.target.value)} spellCheck="true" /><div className="editor-footer"><span>All names and identifiers shown are fictional demo data.</span><strong>{incident.complaint.draft.length} characters</strong></div></div><aside className="review-checklist"><h2>Before continuing</h2>{reviewItems.map((item, index) => <label key={item}><input type="checkbox" checked={checks[index]} onChange={(event) => setChecks((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} /><span>{item}</span></label>)}<div className="review-trust"><span>✓</span><p><strong>Human review required</strong>The official portal may ask for additional details.</p></div>{error && <p className="error-message" role="alert">! {error}</p>}{!reviewed ? <button className="primary-button full" type="button" onClick={onReview} disabled={!allChecked}>I have reviewed this <span>→</span></button> : <button className="primary-button full" type="button" onClick={onHandoff} disabled={Boolean(busy)}>Prepare official handoff <span>→</span></button>} {!allChecked && !reviewed && <p className="review-hint">Confirm each statement to continue.</p>}</aside></div></section>;
}

function Handoff({ incident, onReset, onTransparency }: { incident: Incident; onReset: () => void; onTransparency: () => void }) {
  return <section className="handoff-page"><div className="ready-mark">✓</div><p className="section-kicker">Complaint ready</p><h1>Your complaint package<br /><em>is ready.</em></h1><p>We&apos;ve organized the information you provided into a structured, evidence-backed draft. Review is complete; the next step happens on the official government channel.</p><div className="handoff-summary"><div><span>✓</span><strong>Incident structured</strong><small>{typeLabels[incident.incidentType ?? 'other']}</small></div><div><span>✓</span><strong>Evidence organized</strong><small>{incident.evidence.length} file · key entities extracted</small></div><div><span>✓</span><strong>Complaint reviewed</strong><small>Ready for external submission</small></div></div><div className="handoff-card"><span className="external-icon">↗</span><div><p className="section-kicker">Next step</p><h2>Continue to the official government reporting channel</h2><p>You will leave this prototype. No information is transferred automatically; you must review and enter it on the official portal yourself.</p></div><a className="official-button" href={governmentService.getOfficialReportingUrl()} target="_blank" rel="noreferrer">Continue to official NCRP <span>↗</span></a></div><div className="recovery-warning"><span>!</span><div><h2>WATCH OUT FOR RECOVERY SCAMS</h2><ul><li>Never pay an unexpected “recovery agent.”</li><li>Never share an OTP, PIN, password, or remote access.</li><li>Verify official communication independently.</li></ul></div></div><div className="prototype-note"><strong>This was a simulated handoff.</strong><span>Cyber First Response is not a government service and did not submit a complaint.</span><button type="button" onClick={onTransparency}>See what is simulated</button></div><button className="secondary-button" type="button" onClick={onReset}>↻ Start a fresh demo</button></section>;
}

function Transparency({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" tabIndex={-1} onKeyDown={(event) => event.key === 'Escape' && onClose()} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="transparency-modal" role="dialog" aria-modal="true" aria-labelledby="transparency-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Close transparency details">×</button><p className="section-kicker">Prototype transparency</p><h1 id="transparency-title">What is simulated?</h1><p>This demo is deliberately honest about its boundaries. It helps prepare information; it does not perform government or financial transactions.</p><div className="transparency-grid"><div className="working"><span>● Working in prototype</span><ul><li>Voice/text understanding</li><li>Incident classification</li><li>Missing-information questions</li><li>Evidence extraction</li><li>Timeline and complaint generation</li><li>Case-file creation</li></ul></div><div className="simulated"><span>● Simulated</span><ul><li>Suspect lookup</li><li>Case-status updates</li><li>Family sharing</li><li>Government handoff</li></ul></div><div className="not-connected"><span>● Not connected</span><ul><li>Live NCRP submission</li><li>Live bank or 1930 APIs</li><li>Law-enforcement backend</li><li>Real victim database</li></ul></div></div><button className="primary-button full" type="button" onClick={onClose} autoFocus>I understand</button></section></div>;
}

function TrustFooter() { return <footer><p><strong>Cyber First Response</strong> is an independent hackathon prototype.</p><p>For financial fraud, contact <strong>1930</strong> and your bank directly.</p></footer>; }
function formatKey(key: string) { return key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase()); }
