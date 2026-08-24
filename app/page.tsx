'use client';

import { useEffect, useRef, useState } from 'react';
import { createFreshIncident, statusOrder, type ClassificationResult, type Incident, type IncidentSnapshot, type IncidentStatus } from '../lib/incident';
import { calculateEvidenceCompleteness, demoDescription, officialReportingUrl } from '../lib/presentation';

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
  const [revision, setRevision] = useState(0);
  const [evidenceFields, setEvidenceFields] = useState({ amount: '', transactionId: '', date: '', time: '', upiId: '', recipient: '', phoneNumber: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  function updateLocal(patch: Partial<Incident>) {
    setIncident((current) => ({ ...current, ...patch }));
  }

  function applySnapshot(snapshot: IncidentSnapshot) {
    setIncident(snapshot.incident);
    setClassification(snapshot.classification);
    setMissing(snapshot.missing);
    setDetected(snapshot.detected);
    setRevision(snapshot.revision);
  }

  useEffect(() => {
    let active = true;
    fetch('/api/case', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as { snapshot: IncidentSnapshot | null; error?: string };
        if (!response.ok) throw new Error(data.error || 'Could not restore the saved case.');
        if (active && data.snapshot) applySnapshot(data.snapshot);
      })
      .catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : 'Could not restore the saved case.'));
    return () => { active = false; };
  }, []);

  async function command(action: string, values: Record<string, unknown> = {}) {
    const response = await fetch('/api/case', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, revision, ...values }),
    });
    const data = await response.json() as { snapshot?: IncidentSnapshot; error?: string };
    if (data.snapshot) applySnapshot(data.snapshot);
    if (!response.ok) throw new Error(data.error || 'The case could not be saved.');
    return data.snapshot!;
  }

  async function resetDemo() {
    setBusy('Starting a fresh case…'); setError('');
    try {
      const snapshot = await command('reset');
      applySnapshot(snapshot); setFileName(''); setEvidenceFields({ amount: '', transactionId: '', date: '', time: '', upiId: '', recipient: '', phoneNumber: '' });
      if (fileRef.current) fileRef.current.value = '';
      window.scrollTo({ top: 0, behavior: lowData ? 'auto' : 'smooth' });
    } catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(null); }
  }

  async function begin(selectedMode: IntakeMode) {
    setMode(selectedMode); setBusy('Opening your secure case…'); setError('');
    try { await command('begin'); }
    catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(null); }
  }

  async function analyze(description = incident.description) {
    if (!description.trim()) { setError('Tell us a little about what happened so we can guide you.'); return; }
    setBusy('Understanding your incident…'); setError('');
    try {
      await command('analyze', { description });
      window.scrollTo({ top: 0, behavior: lowData ? 'auto' : 'smooth' });
    } catch (cause) {
      setError(messageFrom(cause));
    } finally { setBusy(null); }
  }

  async function loadDemo() {
    setMode('speak'); setBusy('Loading the fictional demo incident…');
    try {
      await command('loadDemo');
    } catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(null); }
  }

  function simulateVoice() {
    setBusy('Listening… speak naturally in Hindi, English, or Hinglish.');
    setTimeout(() => { updateLocal({ description: demoDescription }); setBusy(null); }, 900);
  }

  async function saveClarification(formData: FormData) {
    setBusy('Saving the incident details…'); setError('');
    await nextPaint();
    try { await command('clarify', { bank: String(formData.get('bank') || ''), time: String(formData.get('time') || '') }); }
    catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(null); }
  }

  async function toggleAction(id: string) {
    try { await command('toggleAction', { actionId: id }); }
    catch (cause) { setError(messageFrom(cause)); }
  }

  async function extractEvidence() {
    setBusy('Reading the transaction details…'); setError('');
    try {
      const form = new FormData();
      form.set('revision', String(revision));
      if (fileName === 'demo-payment-receipt.png') form.set('demo', 'true');
      else if (fileRef.current?.files?.[0]) form.set('file', fileRef.current.files[0]);
      Object.entries(evidenceFields).forEach(([key, value]) => form.set(key, value));
      const response = await fetch('/api/case/evidence', { method: 'POST', body: form });
      const data = await response.json() as { snapshot?: IncidentSnapshot; error?: string };
      if (data.snapshot) applySnapshot(data.snapshot);
      if (!response.ok) throw new Error(data.error || 'The evidence could not be stored.');
    } catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(null); }
  }

  async function buildTimeline() {
    setBusy('Reconstructing what happened…');
    try { await command('timeline'); }
    catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(null); }
  }

  async function buildComplaint() {
    setBusy('Preparing a clear complaint draft…'); setError('');
    try {
      await command('complaint');
    } catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(null); }
  }

  async function completeHandoff() {
    setBusy('Preparing the official-channel handoff…'); setError('');
    try {
      await command('handoff');
    } catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(null); }
  }

  async function advance(to: 'EVIDENCE_COLLECTION' | 'CASE_READY') {
    const label = to === 'EVIDENCE_COLLECTION' ? 'Opening your evidence workspace…' : 'Opening your case file…';
    setBusy(label); setError('');
    await nextPaint();
    try { await command('advance', { to }); }
    catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(null); }
  }

  async function goBack() {
    setBusy('Returning to the previous step…'); setError('');
    await nextPaint();
    try {
      await command('back');
      window.scrollTo({ top: 0, behavior: lowData ? 'auto' : 'smooth' });
    }
    catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(null); }
  }

  async function reviewComplaint() {
    setBusy('Saving your reviewed complaint…'); setError('');
    try { await command('review', { draft: incident.complaint.draft }); }
    catch (cause) { setError(messageFrom(cause)); }
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
        {incident.status === 'INTAKE' && <Intake mode={mode} incident={incident} busy={busy} error={error} onDescription={(description) => updateLocal({ description })} onVoice={simulateVoice} onAnalyze={() => analyze()} onBack={goBack} />}
        {incident.status === 'TRIAGE' && <Triage incident={incident} classification={classification} missing={missing} onSubmit={saveClarification} onBack={goBack} busy={busy} />}
        {incident.status === 'ACTION_REQUIRED' && <ActionPlan incident={incident} onToggle={toggleAction} onContinue={() => advance('EVIDENCE_COLLECTION')} onBack={goBack} />}
        {incident.status === 'EVIDENCE_COLLECTION' && <EvidenceScreen incident={incident} detected={detected} fileName={fileName} evidenceFields={evidenceFields} busy={busy} error={error} fileRef={fileRef} onChoose={() => fileRef.current?.click()} onFile={(name) => setFileName(name)} onField={(key, value) => setEvidenceFields((current) => ({ ...current, [key]: value }))} onExtract={extractEvidence} onContinue={buildTimeline} onBack={goBack} />}
        {incident.status === 'TIMELINE_READY' && <TimelineScreen incident={incident} onContinue={() => advance('CASE_READY')} onBack={goBack} />}
        {incident.status === 'CASE_READY' && <CaseFile incident={incident} completeness={calculateEvidenceCompleteness(detected)} onContinue={buildComplaint} onBack={goBack} busy={busy} error={error} />}
        {(incident.status === 'COMPLAINT_READY' || incident.status === 'REVIEW') && <ComplaintScreen incident={incident} onChange={(draft) => updateLocal({ complaint: { ...incident.complaint, draft } })} onReview={reviewComplaint} onHandoff={completeHandoff} onBack={goBack} busy={busy} error={error} />}
        {incident.status === 'HANDOFF' && <Handoff incident={incident} onReset={resetDemo} onBack={goBack} onTransparency={() => setTransparency(true)} />}
      </div>

      {busy && <div className="busy-overlay" role="status" aria-live="polite" aria-busy="true"><div className="busy-card"><div className="loader-orbit" aria-hidden="true"><span /><i /></div><p>Cyber First Response</p><strong>{busy}</strong><small>Your progress is being saved securely.</small><div className="busy-progress" aria-hidden="true"><span /></div></div></div>}
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

function Triage({ incident, classification, missing, onSubmit, onBack, busy }: { incident: Incident; classification: ClassificationResult | null; missing: string[]; onSubmit: (data: FormData) => Promise<void>; onBack: () => void; busy: string | null }) {
  return <section className="workflow-page">
    <button className="back-link" onClick={onBack} type="button">← Back to your description</button>
    <div className="page-heading"><div><p className="section-kicker">Step 2 · Triage</p><h1 className="page-title">Here&apos;s what we understood.</h1><p className="page-lead">Please check these details. This is a possible classification, not an accusation or final determination.</p></div><div className="confidence"><span>{Math.round((incident.confidence ?? 0) * 100)}%</span><small>confidence</small></div></div>
    <div className="classification-banner"><span className="alert-symbol">!</span><div><small>LLM-assisted server assessment</small><h2>{typeLabels[incident.incidentType ?? 'other']}</h2><p>{classification?.rationale ?? 'The description appears consistent with a financial cybercrime pattern.'}</p></div><strong className={`severity ${incident.severity}`}>{incident.severity} priority</strong></div>
    <div className="understood-grid">
      <Detail label="Incident type" value="Bank / OTP fraud" state="found" />
      <Detail label="Financial loss" value={incident.amount ? `₹${incident.amount.toLocaleString('en-IN')}` : 'Not known'} state={incident.amount ? 'found' : 'missing'} />
      <Detail label="OTP involved" value={incident.otpInvolved ? 'Yes — reported' : 'Not detected'} state={incident.otpInvolved ? 'warning' : 'missing'} />
      <Detail label="Payment method" value={incident.paymentMethod ?? 'Not known'} state={incident.paymentMethod ? 'found' : 'missing'} />
      <Detail label="Bank" value={incident.bank ?? 'We need this'} state={incident.bank ? 'found' : 'missing'} />
      <Detail label="Transaction ID" value={incident.entities.transactionIds[0] ?? 'We need this'} state={incident.entities.transactionIds.length ? 'found' : 'missing'} />
    </div>
    <form className="clarify-card" action={onSubmit} aria-busy={Boolean(busy)}>
      <div className="card-heading"><span className="step-number light">?</span><div><h2>Two quick questions</h2><p>Only the details that change what you should do next.</p></div></div>
      <div className="form-grid"><label>Which bank was involved?<select name="bank" defaultValue=""><option value="" disabled>Select a fictional demo bank</option><option>Demo Bank</option><option>Sample Payments Bank</option><option>Bank not known</option></select></label><label>When did the transaction happen?<input name="time" defaultValue="10:51 AM, 23 Aug 2026" /></label></div>
      <p className="missing-note">Still okay to continue: {missing.includes('transactionId') ? 'transaction ID can be found from your screenshot.' : 'we have the essential details.'}</p>
      <button className="primary-button" type="submit" disabled={Boolean(busy)}>{busy ? 'Saving your response…' : <>Show my first-response plan <span>→</span></>}</button>
    </form>
  </section>;
}

function Detail({ label, value, state }: { label: string; value: string; state: 'found' | 'missing' | 'warning' }) {
  return <div className={`detail-item ${state}`}><span className="detail-status">{state === 'found' ? '✓' : state === 'warning' ? '!' : '·'}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function ActionPlan({ incident, onToggle, onContinue, onBack }: { incident: Incident; onToggle: (id: string) => void; onContinue: () => void; onBack: () => void }) {
  return <section className="workflow-page action-page">
    <button className="back-link" onClick={onBack} type="button">← Back to incident details</button>
    <div className="first-30-header"><div className="timer-badge"><span>30</span><small>MIN</small></div><div><p className="section-kicker red">Priority response</p><h1>FIRST 30 MINUTES</h1><p>Your next actions matter. Act quickly—immediate reporting can help financial institutions and authorities respond to suspected fraudulent transactions.</p></div></div>
    <div className="stop-banner"><span>STOP</span><div><strong>Do not make another payment.</strong><p>Do not share another OTP. Do not trust anyone asking for a recovery fee.</p></div></div>
    <div className="action-layout"><div className="action-list"><div className="list-heading"><h2>Your personalized action plan</h2><span>{incident.actionPlan.filter((item) => item.completed).length}/{incident.actionPlan.length} marked done</span></div>{incident.actionPlan.map((action, index) => <button className={`action-row ${action.completed ? 'completed' : ''}`} key={action.id} type="button" onClick={() => onToggle(action.id)}><span className="action-check">{action.completed ? '✓' : index + 1}</span><span className="action-copy"><span className={`priority-label ${action.priority}`}>{action.priority === 'now' ? 'DO THIS NOW' : action.priority === 'next' ? 'DO THIS NEXT' : 'PROTECT YOURSELF'}</span><strong>{action.title}</strong><small>{action.detail}</small></span><span className="mark-label">{action.completed ? 'Done' : 'Mark done'}</span></button>)}</div>
      <aside className="help-card"><span className="phone-icon">☎</span><p className="section-kicker">Official helpline</p><h2>Call 1930</h2><p>India&apos;s official helpline for reporting cyber financial fraud.</p><div className="help-details"><span>Have ready</span><strong>Amount · time · bank · transaction reference</strong></div><a className="call-button" href="tel:1930">Call 1930 now</a><small>Opens your phone dialler. This prototype does not place or track the call.</small></aside>
    </div>
    <div className="preserve-banner"><span>▣</span><div><strong>Preserve this conversation and every receipt.</strong><p>Do not delete messages, call logs, screenshots, or transaction alerts that may support your complaint.</p></div></div>
    <div className="page-actions"><button className="secondary-button" type="button" onClick={onBack}>← Back</button><button className="primary-button" type="button" onClick={onContinue}>Collect my evidence <span>→</span></button></div>
  </section>;
}

function EvidenceScreen({ incident, detected, fileName, evidenceFields, busy, error, fileRef, onChoose, onFile, onField, onExtract, onContinue, onBack }: { incident: Incident; detected: Record<string, string>; fileName: string; evidenceFields: Record<string, string>; busy: string | null; error: string; fileRef: React.RefObject<HTMLInputElement | null>; onChoose: () => void; onFile: (name: string) => void; onField: (key: string, value: string) => void; onExtract: () => void; onContinue: () => void; onBack: () => void }) {
  const completeness = calculateEvidenceCompleteness(detected);
  return <section className="workflow-page">
    <button className="back-link" onClick={onBack} type="button">← Back to your action plan</button>
    <div className="page-heading"><div><p className="section-kicker">Step 4 · Evidence intelligence</p><h1 className="page-title">Turn screenshots into evidence.</h1><p className="page-lead">Upload a payment screenshot or use the built-in demo receipt. Files are stored privately with your saved case and are never sent to a bank or government system.</p></div>{incident.evidence.length > 0 && <div className="completeness-ring" style={{ '--progress': `${completeness * 3.6}deg` } as React.CSSProperties}><span>{completeness}%</span><small>complete</small></div>}</div>
    <div className="evidence-layout"><div><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden onChange={(event) => onFile(event.target.files?.[0]?.name ?? '')} /><button className="upload-zone" type="button" onClick={onChoose}><span className="upload-icon">↑</span><strong>{fileName || 'Upload payment screenshot'}</strong><small>PNG, JPG, WebP, or PDF · up to 10 MB</small></button><button className="demo-receipt" type="button" onClick={() => onFile('demo-payment-receipt.png')}><span className="mini-receipt">₹<i>25,000</i></span><span><strong>Use built-in demo receipt</strong><small>Fictional · 23 Aug 2026 · 10:52 AM</small></span><b>{fileName === 'demo-payment-receipt.png' ? '✓ Selected' : 'Select →'}</b></button>
      {fileName && fileName !== 'demo-payment-receipt.png' && <div className="manual-evidence"><strong>Confirm the visible transaction details</strong><p>Automatic OCR is not used. Enter only what you can verify in the file.</p><div className="form-grid">{[['amount', 'Amount'], ['transactionId', 'Transaction ID'], ['date', 'Date'], ['time', 'Time'], ['upiId', 'UPI ID (optional)'], ['recipient', 'Recipient (optional)']].map(([key, label]) => <label key={key}>{label}<input value={evidenceFields[key] ?? ''} onChange={(event) => onField(key, event.target.value)} required={!label.includes('optional')} /></label>)}</div></div>}
      {error && <p className="error-message">! {error}</p>}<button className="primary-button full" type="button" onClick={onExtract} disabled={Boolean(busy) || !fileName}>Store evidence details <span>→</span></button></div>
      <div className="detected-panel"><div className="panel-title"><div><p className="section-kicker">Structured evidence</p><h2>Evidence recorded</h2></div><span className="simulated-badge">Server stored</span></div>{Object.keys(detected).length === 0 ? <div className="empty-detected"><span>⌁</span><strong>No evidence recorded yet</strong><p>Select the demo receipt or upload a file and confirm the visible transaction details.</p></div> : <><dl className="detected-grid">{Object.entries(detected).slice(0, 8).map(([key, value]) => <div key={key}><dt>{formatKey(key)}</dt><dd>{value}</dd></div>)}</dl><div className="case-score"><div><strong>Case evidence completeness</strong><small>Calculated from {Object.keys(detected).length} of 11 critical fields found</small></div><b>{completeness}%</b></div></>}</div></div>
    {Object.keys(detected).length > 0 && <div className="checklist-card"><h2>Evidence checklist</h2><div className="checklist-grid">{requiredEvidence.map(([label, key]) => <div key={key} className={detected[key] ? 'available' : 'missing'}><span>{detected[key] ? '✓' : '!'}</span><strong>{label}</strong><small>{detected[key] ? 'Detected' : 'Missing'}</small></div>)}</div></div>}
    <div className="page-actions"><button className="secondary-button" type="button" onClick={onBack}>← Back</button><button className="primary-button" type="button" disabled={!Object.keys(detected).length} onClick={onContinue}>Build incident timeline <span>→</span></button></div>
  </section>;
}

function TimelineScreen({ incident, onContinue, onBack }: { incident: Incident; onContinue: () => void; onBack: () => void }) {
  return <section className="workflow-page timeline-page"><button className="back-link" onClick={onBack} type="button">← Back to evidence</button><div className="center-heading"><p className="section-kicker">Step 5 · Reconstruct</p><h1 className="page-title">Here&apos;s what happened,<br /><em>step by step.</em></h1><p className="page-lead">Built on the server from your description and recorded evidence. Please verify every event.</p></div><div className="timeline"><div className="timeline-line" />{incident.timeline.map((event, index) => <article className="timeline-event" key={event.id}><div className="timeline-time">{event.timestamp}</div><div className={`timeline-dot ${event.source}`}><span>{index + 1}</span></div><div className="timeline-card"><span className={`source-tag ${event.source}`}>{event.source}</span><h2>{event.title}</h2><p>{event.detail}</p></div></article>)}</div><div className="verify-note"><span>✓</span><div><strong>You&apos;re in control.</strong><p>This timeline is automatically organized. Treat it as a draft and correct anything that does not match your memory.</p></div></div><div className="page-actions"><button className="secondary-button" type="button" onClick={onBack}>← Back</button><button className="primary-button" type="button" onClick={onContinue}>Open my case file <span>→</span></button></div></section>;
}

function CaseFile({ incident, completeness, onContinue, onBack, busy, error }: { incident: Incident; completeness: number; onContinue: () => void; onBack: () => void; busy: string | null; error: string }) {
  const incidentLabel = typeLabels[incident.incidentType ?? 'other'];
  return <section className="workflow-page"><button className="back-link" onClick={onBack} type="button">← Back to timeline</button><div className="case-cover"><div><p className="document-label">CYBER INCIDENT CASE FILE</p><h1>{incidentLabel}</h1><div className="case-meta"><span><small>Case reference</small><strong>CFR-{incident.id.slice(0, 8).toUpperCase()}</strong></span><span><small>Status</small><strong>Complaint preparation</strong></span><span><small>Evidence completeness</small><strong>{completeness}%</strong></span></div></div><div className="file-stamp"><span>SAVED</span><small>PRIVATE CASE</small></div></div><div className="case-layout"><div className="case-main"><CaseSection number="01" title="Incident"><div className="case-facts"><Detail label="Assessment" value={incidentLabel} state="warning" /><Detail label="Severity" value={`${incident.severity ?? 'medium'} priority`} state="warning" /><Detail label="Financial loss" value={formatMoney(incident.amount) || 'Not confirmed'} state={incident.amount ? 'found' : 'missing'} /><Detail label="Date & time" value={[incident.incidentDate, incident.incidentTime].filter(Boolean).join(' · ') || 'Not confirmed'} state={incident.incidentDate || incident.incidentTime ? 'found' : 'missing'} /></div><p className="case-description">{incident.description}</p></CaseSection><CaseSection number="02" title="Evidence">{incident.evidence.map((item) => <div className="evidence-file-row" key={item.id}><span>▧</span><div><strong>{item.name}</strong><small>{item.type} · Details recorded with the case</small></div><b>{item.status === 'ready' ? 'Demo verified' : 'User confirmed'}</b></div>)}</CaseSection><CaseSection number="03" title="Timeline"><div className="mini-timeline">{incident.timeline.map((event) => <div key={event.id}><strong>{event.timestamp}</strong><span /><p>{event.title}</p></div>)}</div></CaseSection></div><aside className="case-sidebar"><CaseSection number="04" title="Case ownership"><dl><dt>Profile</dt><dd>Private browser session</dd><dt>Data classification</dt><dd>User-provided case data</dd></dl></CaseSection><CaseSection number="05" title="Recorded entities"><div className="entity-chip"><small>UPI ID</small><strong>{incident.entities.upiIds[0] || 'Not recorded'}</strong></div><div className="entity-chip"><small>Transaction ID</small><strong>{incident.entities.transactionIds[0] || 'Not recorded'}</strong></div><div className="entity-chip"><small>Phone</small><strong>{incident.entities.phoneNumbers[0] || 'Not recorded'}</strong></div></CaseSection><CaseSection number="06" title="Actions taken"><ul className="actions-taken">{incident.actionPlan.filter((action) => action.completed).length ? incident.actionPlan.filter((action) => action.completed).map((action) => <li key={action.id}>✓ {action.title}</li>) : <li>Actions shown; completion not yet confirmed</li>}</ul></CaseSection></aside></div>{error && <p className="error-message" role="alert">! {error}</p>}<div className="page-actions"><button className="secondary-button" type="button" onClick={onBack}>← Back</button><button className="primary-button" type="button" onClick={onContinue} disabled={Boolean(busy)}>Prepare complaint draft <span>→</span></button></div></section>;
}

function CaseSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) { return <section className="case-section"><div className="case-section-title"><span>{number}</span><h2>{title}</h2></div>{children}</section>; }

function ComplaintScreen({ incident, onChange, onReview, onHandoff, onBack, busy, error }: { incident: Incident; onChange: (value: string) => void; onReview: () => void; onHandoff: () => void; onBack: () => void; busy: string | null; error: string }) {
  const reviewed = incident.status === 'REVIEW';
  const reviewItems = ['The amount and transaction details are correct', 'The chronology matches what I remember', 'No OTP, PIN, or password is included', 'I understand this has not been submitted'];
  const [checks, setChecks] = useState(() => reviewItems.map((_, index) => reviewed || index === 2));
  const allChecked = checks.every(Boolean);
  return <section className="workflow-page"><button className="back-link" onClick={onBack} type="button">← Back to case file</button><div className="review-header"><div><p className="section-kicker">Step 7 · Prepare</p><h1 className="page-title">Review before you proceed.</h1><p className="page-lead">The complaint is generated from your saved case and is fully editable. Nothing has been submitted anywhere.</p></div><span className="not-submitted">NOT SUBMITTED</span></div><div className="review-layout"><div className="editor-card"><div className="editor-toolbar"><span>Complaint draft</span><div><button type="button" onClick={() => navigator.clipboard?.writeText(incident.complaint.draft)}>Copy</button><button type="button" onClick={() => window.print()}>Print</button></div></div><textarea aria-label="Editable complaint draft" value={incident.complaint.draft} onChange={(event) => onChange(event.target.value)} spellCheck="true" /><div className="editor-footer"><span>Verify every name and identifier before official use.</span><strong>{incident.complaint.draft.length} characters</strong></div></div><aside className="review-checklist"><h2>Before continuing</h2>{reviewItems.map((item, index) => <label key={item}><input type="checkbox" checked={checks[index]} onChange={(event) => setChecks((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} /><span>{item}</span></label>)}<div className="review-trust"><span>✓</span><p><strong>Human review required</strong>The official portal may ask for additional details.</p></div>{error && <p className="error-message" role="alert">! {error}</p>}{!reviewed ? <button className="primary-button full" type="button" onClick={onReview} disabled={!allChecked || Boolean(busy)}>I have reviewed this <span>→</span></button> : <button className="primary-button full" type="button" onClick={onHandoff} disabled={Boolean(busy)}>Prepare official handoff <span>→</span></button>} {!allChecked && !reviewed && <p className="review-hint">Confirm each statement to continue.</p>}</aside></div><div className="page-actions"><button className="secondary-button" type="button" onClick={onBack}>← Back</button></div></section>;
}

function Handoff({ incident, onReset, onBack, onTransparency }: { incident: Incident; onReset: () => void; onBack: () => void; onTransparency: () => void }) {
  return <section className="handoff-page"><button className="back-link handoff-back" onClick={onBack} type="button">← Back to review</button><div className="ready-mark">✓</div><p className="section-kicker">Complaint ready</p><h1>Your complaint package<br /><em>is ready.</em></h1><p>We&apos;ve organized the information you provided into a structured, evidence-backed draft. Review is complete; the next step happens on the official government channel.</p><div className="handoff-summary"><div><span>✓</span><strong>Incident structured</strong><small>{typeLabels[incident.incidentType ?? 'other']}</small></div><div><span>✓</span><strong>Evidence organized</strong><small>{incident.evidence.length} file · key details recorded</small></div><div><span>✓</span><strong>Complaint reviewed</strong><small>Ready for external submission</small></div></div><div className="handoff-card"><span className="external-icon">↗</span><div><p className="section-kicker">Next step</p><h2>Continue to the official government reporting channel</h2><p>You will leave this site. No information is transferred automatically; you must review and enter it on the official portal yourself.</p></div><a className="official-button" href={officialReportingUrl} target="_blank" rel="noreferrer">Continue to official NCRP <span>↗</span></a></div><div className="recovery-warning"><span>!</span><div><h2>WATCH OUT FOR RECOVERY SCAMS</h2><ul><li>Never pay an unexpected “recovery agent.”</li><li>Never share an OTP, PIN, password, or remote access.</li><li>Verify official communication independently.</li></ul></div></div><div className="prototype-note"><strong>This is an external handoff.</strong><span>Cyber First Response is not a government service and did not submit a complaint.</span><button type="button" onClick={onTransparency}>See how the service works</button></div><div className="handoff-actions"><button className="secondary-button" type="button" onClick={onBack}>← Back to review</button><button className="secondary-button" type="button" onClick={onReset}>↻ Start a fresh case</button></div></section>;
}

function Transparency({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" tabIndex={-1} onKeyDown={(event) => event.key === 'Escape' && onClose()} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="transparency-modal" role="dialog" aria-modal="true" aria-labelledby="transparency-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Close transparency details">×</button><p className="section-kicker">Service transparency</p><h1 id="transparency-title">What works, and what stays external?</h1><p>The case workflow and storage are live. The LLM runs only on the server; government, bank, and helpline systems remain separate and receive no automatic transfer.</p><div className="transparency-grid"><div className="working"><span>● Working</span><ul><li>Persistent private cases</li><li>LLM-assisted incident classification</li><li>Missing-information checks</li><li>Private evidence file storage</li><li>Timeline and complaint generation</li><li>Version-safe progress updates</li></ul></div><div className="simulated"><span>● Demo-only</span><ul><li>Voice transcription</li><li>Built-in sample receipt</li><li>Sample suspect details</li><li>Government handoff preview</li></ul></div><div className="not-connected"><span>● Not connected</span><ul><li>Live NCRP submission</li><li>Live bank or 1930 APIs</li><li>Law-enforcement systems</li><li>Automated suspect lookup</li></ul></div></div><button className="primary-button full" type="button" onClick={onClose} autoFocus>I understand</button></section></div>;
}

function TrustFooter() { return <footer><p><strong>Cyber First Response</strong> is an independent hackathon prototype.</p><p>For financial fraud, contact <strong>1930</strong> and your bank directly.</p></footer>; }
function formatKey(key: string) { return key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase()); }
function messageFrom(cause: unknown) { return cause instanceof Error ? cause.message : 'The case service could not complete this request. Please retry.'; }
function formatMoney(amount?: number) { return amount ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount) : ''; }
function nextPaint() { return new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); }
