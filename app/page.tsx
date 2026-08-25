'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createFreshIncident, statusOrder, type ClassificationResult, type Incident, type IncidentSnapshot, type IncidentStatus } from '../lib/incident';
import { demoDescription } from '../lib/presentation';
import { getEvidenceRequirements, getIncidentGuide, incidentGuides, isFinancialIncident, officialLinks } from '../lib/services';

type IntakeMode = 'speak' | 'type' | 'upload';

const intakeOptions = [
  { id: 'speak', icon: '●', label: 'Speak', note: 'Hindi, English or Hinglish' },
  { id: 'type', icon: 'Aa', label: 'Type', note: 'Describe it in your words' },
  { id: 'upload', icon: '↑', label: 'Upload evidence', note: 'Screenshot, SMS or receipt' },
] as const;

const stageLabels: Partial<Record<IncidentStatus, string>> = {
  INTAKE: 'Understand', TRIAGE: 'Triage', ACTION_REQUIRED: 'Act', EVIDENCE_COLLECTION: 'Evidence', TIMELINE_READY: 'Timeline', CASE_READY: 'Case file', COMPLAINT_READY: 'Complaint', REVIEW: 'Review', HANDOFF: 'Handoff',
};

const minimumLoaderDurationMs = 520;

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
  const [evidenceFields, setEvidenceFields] = useState<Record<string, string>>({ date: '', time: '', platform: '', contact: '', username: '', url: '', email: '', amount: '', transactionId: '', recipient: '', accountId: '', device: '', imei: '', chatHistory: '', policeReport: '' });
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
      applySnapshot(snapshot); setFileName(''); setEvidenceFields({ date: '', time: '', platform: '', contact: '', username: '', url: '', email: '', amount: '', transactionId: '', recipient: '', accountId: '', device: '', imei: '', chatHistory: '', policeReport: '' });
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
    const submittedAt = performance.now();
    flushSync(() => {
      setBusy('Preparing your first-response plan…');
      setError('');
    });
    await nextPaint();
    await nextPaint();
    try { await command('clarify', { service: String(formData.get('service') || ''), time: String(formData.get('time') || '') }); }
    catch (cause) { setError(messageFrom(cause)); }
    finally {
      const remainingLoaderTime = minimumLoaderDurationMs - (performance.now() - submittedAt);
      if (remainingLoaderTime > 0) await wait(remainingLoaderTime);
      setBusy(null);
    }
  }

  async function toggleAction(id: string) {
    // Completion should feel immediate during an urgent response. Persist the
    // change in the background, then reconcile with the saved server snapshot.
    setIncident((current) => ({
      ...current,
      actionPlan: current.actionPlan.map((action) => action.id === id ? { ...action, completed: !action.completed } : action),
    }));
    setError('');
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
        {incident.status === 'ACTION_REQUIRED' && <ActionPlan incident={incident} onToggle={toggleAction} onContinue={() => advance('EVIDENCE_COLLECTION')} onBack={goBack} busy={busy} />}
        {incident.status === 'EVIDENCE_COLLECTION' && <EvidenceScreen incident={incident} detected={detected} fileName={fileName} evidenceFields={evidenceFields} busy={busy} error={error} fileRef={fileRef} onChoose={() => fileRef.current?.click()} onFile={(name) => setFileName(name)} onField={(key, value) => setEvidenceFields((current) => ({ ...current, [key]: value }))} onExtract={extractEvidence} onContinue={buildTimeline} onBack={goBack} />}
        {incident.status === 'TIMELINE_READY' && <TimelineScreen incident={incident} onContinue={() => advance('CASE_READY')} onBack={goBack} />}
        {incident.status === 'CASE_READY' && <CaseFile incident={incident} completeness={evidenceCompleteness(incident.incidentType, detected)} onContinue={buildComplaint} onBack={goBack} busy={busy} error={error} />}
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
    <section className="coverage-panel" aria-labelledby="coverage-title"><p className="section-kicker">India-focused cybercrime guide</p><h2 id="coverage-title">Guidance for more than banking fraud.</h2><p>Describe the incident in your own words. The first-response plan adapts for financial fraud, account compromise, abuse, device loss, technical attacks, and emerging scams.</p><div className="coverage-grid">{['upi_payment_fraud', 'phishing_or_vishing', 'account_takeover', 'social_media_abuse', 'sextortion_or_intimate_content', 'child_safety_or_grooming', 'lost_or_stolen_phone', 'ransomware_or_malware', 'hacking_or_data_breach', 'online_gambling', 'online_trafficking', 'other'].map((type) => <div key={type}><strong>{incidentGuides[type as keyof typeof incidentGuides].title}</strong><small>{incidentGuides[type as keyof typeof incidentGuides].category}</small></div>)}</div><small className="coverage-note">Includes UPI/card fraud, investment and crypto scams, digital-arrest impersonation, job/loan/marketplace and matrimonial scams, SIM swap, stalking, fake profiles, harmful content, malware, data breaches, website defacement, gambling, trafficking, and suspect reporting.</small></section>
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
  const guide = getIncidentGuide(incident.incidentType);
  const [service, setService] = useState(incident.affectedService ?? incident.bank ?? '');
  const [time, setTime] = useState('');
  const answersComplete = Boolean(time);

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(new FormData(event.currentTarget));
  }

  return <section className="workflow-page">
    <button className="back-link" onClick={onBack} type="button">← Back to your description</button>
    <div className="page-heading"><div><p className="section-kicker">Step 2 · Triage</p><h1 className="page-title">Here&apos;s what we understood.</h1><p className="page-lead">Please check these details. This is a possible classification, not an accusation or final determination.</p></div><div className="confidence"><span>{Math.round((incident.confidence ?? 0) * 100)}%</span><small>confidence</small></div></div>
    <div className="classification-banner"><span className="alert-symbol">!</span><div><small>LLM-assisted server assessment</small><h2>Possible {guide.title}</h2><p>{classification?.rationale ?? 'The description appears consistent with this cybercrime pattern.'}</p></div><strong className={`severity ${incident.severity}`}>{incident.severity} priority</strong></div>
    <div className="understood-grid">
      <Detail label="Incident type" value={guide.category} state="found" />
      <Detail label="Financial loss" value={incident.amount ? `₹${incident.amount.toLocaleString('en-IN')}` : 'Not reported'} state={incident.amount ? 'found' : 'missing'} />
      <Detail label="OTP involved" value={incident.otpInvolved ? 'Yes — reported' : 'Not detected'} state={incident.otpInvolved ? 'warning' : 'missing'} />
      <Detail label="Payment method" value={incident.paymentMethod ?? 'Not known'} state={incident.paymentMethod ? 'found' : 'missing'} />
      <Detail label="Service or platform" value={incident.affectedService ?? incident.bank ?? 'Not known'} state={incident.affectedService || incident.bank ? 'found' : 'missing'} />
      <Detail label="Key identifier" value={incident.entities.transactionIds[0] ?? incident.entities.urls[0] ?? incident.entities.phoneNumbers[0] ?? 'Not recorded'} state={incident.entities.transactionIds.length || incident.entities.urls.length || incident.entities.phoneNumbers.length ? 'found' : 'missing'} />
    </div>
    <form className="clarify-card" onSubmit={submitForm} aria-busy={Boolean(busy)}>
      <div className="card-heading"><span className="step-number light">?</span><div><h2>Two quick questions</h2><p>Only details that change the immediate safety and reporting route.</p></div></div>
      <div className="form-grid"><label>Affected service, app, website, or device (if known)<input name="service" value={service} onChange={(event) => setService(event.target.value)} placeholder="For example: WhatsApp, a bank, a laptop" maxLength={120} /></label><label>When did you first notice it?<select name="time" value={time} onChange={(event) => setTime(event.target.value)} required><option value="" disabled>Select when it happened</option><option>Within the last 15 minutes</option><option>Today</option><option>Yesterday</option><option>Earlier</option><option>I am not sure yet</option></select></label></div>
      <p className="missing-note">{missing.length ? `You can add ${missing.slice(0, 3).join(', ')} details later from safe evidence.` : 'You can add more details later.'} Never enter an OTP, PIN, password, CVV, or remote-access code.</p>
      <button className="primary-button" type="submit" disabled={Boolean(busy) || !answersComplete}>{busy ? 'Saving your response…' : <>Show my first-response plan <span>→</span></>}</button>
    </form>
  </section>;
}

function Detail({ label, value, state }: { label: string; value: string; state: 'found' | 'missing' | 'warning' }) {
  return <div className={`detail-item ${state}`}><span className="detail-status">{state === 'found' ? '✓' : state === 'warning' ? '!' : '·'}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function ActionPlan({ incident, onToggle, onContinue, onBack, busy }: { incident: Incident; onToggle: (id: string) => void; onContinue: () => void; onBack: () => void; busy?: string | null }) {
  const guide = getIncidentGuide(incident.incidentType);
  const financial = isFinancialIncident(incident.incidentType);
  const route = guide.reportingRoute;
  const allDone = incident.actionPlan.length > 0 && incident.actionPlan.every((item) => item.completed);
  return <section className="workflow-page action-page">
    <button className="back-link" onClick={onBack} type="button">← Back to incident details</button>
    <div className="first-30-header"><div className="timer-badge"><span>30</span><small>MIN</small></div><div><p className="section-kicker red">Priority response</p><h1>YOUR FIRST RESPONSE</h1><p>{guide.summary} Follow the steps below in order; the guidance is tailored to this possible incident type.</p></div></div>
    <div className="stop-banner"><span>STOP</span><div><strong>{financial ? 'Do not make another payment.' : 'Do not engage with the suspected attacker.'}</strong><p>Never share an OTP, PIN, password, CVV, or remote-access code. Do not pay anyone promising recovery.</p></div></div>
    <div className="action-layout"><div className="action-list"><div className="list-heading"><h2>Your personalized action plan</h2><span>{incident.actionPlan.filter((item) => item.completed).length}/{incident.actionPlan.length} marked done</span></div>{incident.actionPlan.map((action, index) => <button className={`action-row ${action.completed ? 'completed' : ''}`} key={action.id} type="button" onClick={() => onToggle(action.id)}><span className="action-check">{action.completed ? '✓' : index + 1}</span><span className="action-copy"><span className={`priority-label ${action.priority}`}>{action.priority === 'now' ? 'DO THIS NOW' : action.priority === 'next' ? 'DO THIS NEXT' : 'PROTECT YOURSELF'}</span><strong>{action.title}</strong><small>{action.detail}</small></span><span className="mark-label">{action.completed ? 'Done' : 'Mark done'}</span></button>)}</div>
      <aside className="help-card"><span className="phone-icon">{financial ? '☎' : route === 'ceir' ? '▣' : '↗'}</span><p className="section-kicker">Official route</p><h2>{guide.officialAction}</h2><p>{guide.officialDetail}</p><div className="help-details"><span>Have ready</span><strong>{financial ? 'Amount · time · transaction reference' : 'Dates · identifiers · screenshots'}</strong></div>{financial ? <a className="call-button" href="tel:1930">Call 1930 now</a> : <a className="call-button" href={route === 'ceir' ? officialLinks.ceir : route === 'suspect' ? officialLinks.suspect : route === 'technical' ? officialLinks.certIn : officialLinks.ncrp} target="_blank" rel="noreferrer">Open official guidance</a>}<small>{financial ? 'Opens your phone dialler. This prototype does not place or track the call.' : 'Opens the official website in a new tab. Nothing is sent automatically.'}</small></aside>
    </div>
    <div className="preserve-banner"><span>▣</span><div><strong>Preserve this conversation and every receipt.</strong><p>Do not delete messages, call logs, screenshots, or transaction alerts that may support your complaint.</p></div></div>
    <div className="page-actions"><button className="secondary-button" type="button" onClick={onBack}>← Back</button><button className="primary-button" type="button" onClick={onContinue} disabled={Boolean(busy) || !allDone}>Collect my evidence <span>→</span></button></div>
  </section>;
}

function EvidenceScreen({ incident, detected, fileName, evidenceFields, busy, error, fileRef, onChoose, onFile, onField, onExtract, onContinue, onBack }: { incident: Incident; detected: Record<string, string>; fileName: string; evidenceFields: Record<string, string>; busy: string | null; error: string; fileRef: React.RefObject<HTMLInputElement | null>; onChoose: () => void; onFile: (name: string) => void; onField: (key: string, value: string) => void; onExtract: () => void; onContinue: () => void; onBack: () => void }) {
  const requirements = getEvidenceRequirements(incident.incidentType);
  const completeness = evidenceCompleteness(incident.incidentType, detected);
  return <section className="workflow-page">
    <button className="back-link" onClick={onBack} type="button">← Back to your action plan</button>
    <div className="page-heading"><div><p className="section-kicker">Step 4 · Evidence intelligence</p><h1 className="page-title">Turn what you saw into evidence.</h1><p className="page-lead">Upload a safe screenshot or document, then record only the details you can verify. Files are stored privately with your saved case and are never sent to a government or service provider.</p></div>{incident.evidence.length > 0 && <div className="completeness-ring" style={{ '--progress': `${completeness * 3.6}deg` } as React.CSSProperties}><span>{completeness}%</span><small>complete</small></div>}</div>
    <div className="evidence-layout"><div><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden onChange={(event) => onFile(event.target.files?.[0]?.name ?? '')} /><button className="upload-zone" type="button" onClick={onChoose}><span className="upload-icon">↑</span><strong>{fileName || 'Upload safe evidence'}</strong><small>PNG, JPG, WebP, or PDF · up to 10 MB</small></button>{isFinancialIncident(incident.incidentType) && <button className="demo-receipt" type="button" onClick={() => onFile('demo-payment-receipt.png')}><span className="mini-receipt">₹<i>25,000</i></span><span><strong>Use built-in demo receipt</strong><small>Fictional · 23 Aug 2026 · 10:52 AM</small></span><b>{fileName === 'demo-payment-receipt.png' ? '✓ Selected' : 'Select →'}</b></button>}
      {fileName && fileName !== 'demo-payment-receipt.png' && <div className="manual-evidence"><strong>Record the relevant visible details</strong><p>Automatic OCR is not used. Do not upload or forward illegal sexual content, and never enter a password, OTP, PIN, CVV, or recovery code.</p><div className="form-grid">{requirements.filter((field) => field.key !== 'screenshot').map((field) => <label key={field.key}>{field.label}{field.critical && <small>Required if known</small>}<input value={evidenceFields[field.key] ?? ''} onChange={(event) => onField(field.key, event.target.value)} placeholder={field.help} maxLength={200} /></label>)}</div></div>}
      {error && <p className="error-message">! {error}</p>}<button className="primary-button full" type="button" onClick={onExtract} disabled={Boolean(busy) || !fileName}>Store evidence details <span>→</span></button></div>
      <div className="detected-panel"><div className="panel-title"><div><p className="section-kicker">Structured evidence</p><h2>Evidence recorded</h2></div><span className="simulated-badge">Server stored</span></div>{Object.keys(detected).length === 0 ? <div className="empty-detected"><span>⌁</span><strong>No evidence recorded yet</strong><p>Upload a safe file, then record the details you can verify.</p></div> : <><dl className="detected-grid">{Object.entries(detected).slice(0, 8).map(([key, value]) => <div key={key}><dt>{formatKey(key)}</dt><dd>{value}</dd></div>)}</dl><div className="case-score"><div><strong>Case evidence completeness</strong><small>Calculated against this incident’s reporting needs</small></div><b>{completeness}%</b></div></>}</div></div>
    {Object.keys(detected).length > 0 && <div className="checklist-card"><h2>Evidence checklist</h2><div className="checklist-grid">{requirements.map((field) => <div key={field.key} className={detected[field.key] ? 'available' : 'missing'}><span>{detected[field.key] ? '✓' : '!'}</span><strong>{field.label}</strong><small>{detected[field.key] ? 'Recorded' : field.critical ? 'Important if available' : 'Optional'}</small></div>)}</div></div>}
    <div className="page-actions"><button className="secondary-button" type="button" onClick={onBack}>← Back</button><button className="primary-button" type="button" disabled={!Object.keys(detected).length} onClick={onContinue}>Build incident timeline <span>→</span></button></div>
  </section>;
}

function TimelineScreen({ incident, onContinue, onBack }: { incident: Incident; onContinue: () => void; onBack: () => void }) {
  return <section className="workflow-page timeline-page"><button className="back-link" onClick={onBack} type="button">← Back to evidence</button><div className="center-heading"><p className="section-kicker">Step 5 · Reconstruct</p><h1 className="page-title">Here&apos;s what happened,<br /><em>step by step.</em></h1><p className="page-lead">Built on the server from your description and recorded evidence. Please verify every event.</p></div><div className="timeline"><div className="timeline-line" />{incident.timeline.map((event, index) => <article className="timeline-event" key={event.id}><div className="timeline-time">{event.timestamp}</div><div className={`timeline-dot ${event.source}`}><span>{index + 1}</span></div><div className="timeline-card"><span className={`source-tag ${event.source}`}>{event.source}</span><h2>{event.title}</h2><p>{event.detail}</p></div></article>)}</div><div className="verify-note"><span>✓</span><div><strong>You&apos;re in control.</strong><p>This timeline is automatically organized. Treat it as a draft and correct anything that does not match your memory.</p></div></div><div className="page-actions"><button className="secondary-button" type="button" onClick={onBack}>← Back</button><button className="primary-button" type="button" onClick={onContinue}>Open my case file <span>→</span></button></div></section>;
}

function CaseFile({ incident, completeness, onContinue, onBack, busy, error }: { incident: Incident; completeness: number; onContinue: () => void; onBack: () => void; busy: string | null; error: string }) {
  const guide = getIncidentGuide(incident.incidentType);
  const incidentLabel = guide.title;
  return <section className="workflow-page"><button className="back-link" onClick={onBack} type="button">← Back to timeline</button><div className="case-cover"><div><p className="document-label">CYBER INCIDENT CASE FILE</p><h1>{incidentLabel}</h1><div className="case-meta"><span><small>Case reference</small><strong>CFR-{incident.id.slice(0, 8).toUpperCase()}</strong></span><span><small>Status</small><strong>Complaint preparation</strong></span><span><small>Evidence completeness</small><strong>{completeness}%</strong></span></div></div><div className="file-stamp"><span>SAVED</span><small>PRIVATE CASE</small></div></div><div className="case-layout"><div className="case-main"><CaseSection number="01" title="Incident"><div className="case-facts"><Detail label="Assessment" value={incidentLabel} state="warning" /><Detail label="Severity" value={`${incident.severity ?? 'medium'} priority`} state="warning" /><Detail label="Response route" value={guide.category} state="found" /><Detail label="Date & time" value={[incident.incidentDate, incident.incidentTime].filter(Boolean).join(' · ') || 'Not confirmed'} state={incident.incidentDate || incident.incidentTime ? 'found' : 'missing'} /></div><p className="case-description">{incident.description}</p></CaseSection><CaseSection number="02" title="Evidence">{incident.evidence.map((item) => <div className="evidence-file-row" key={item.id}><span>▧</span><div><strong>{item.name}</strong><small>{item.type} · Details recorded with the case</small></div><b>{item.status === 'ready' ? 'Demo verified' : 'User confirmed'}</b></div>)}</CaseSection><CaseSection number="03" title="Timeline"><div className="mini-timeline">{incident.timeline.map((event) => <div key={event.id}><strong>{event.timestamp}</strong><span /><p>{event.title}</p></div>)}</div></CaseSection></div><aside className="case-sidebar"><CaseSection number="04" title="Case ownership"><dl><dt>Profile</dt><dd>Private browser session</dd><dt>Data classification</dt><dd>User-provided case data</dd></dl></CaseSection><CaseSection number="05" title="Recorded entities"><div className="entity-chip"><small>Transaction / UPI ID</small><strong>{incident.entities.transactionIds[0] || incident.entities.upiIds[0] || 'Not recorded'}</strong></div><div className="entity-chip"><small>Phone or email</small><strong>{incident.entities.phoneNumbers[0] || incident.entities.emails[0] || 'Not recorded'}</strong></div><div className="entity-chip"><small>Website or profile</small><strong>{incident.entities.urls[0] || incident.affectedService || 'Not recorded'}</strong></div></CaseSection><CaseSection number="06" title="Actions taken"><ul className="actions-taken">{incident.actionPlan.filter((action) => action.completed).length ? incident.actionPlan.filter((action) => action.completed).map((action) => <li key={action.id}>✓ {action.title}</li>) : <li>Actions shown; completion not yet confirmed</li>}</ul></CaseSection></aside></div>{error && <p className="error-message" role="alert">! {error}</p>}<div className="page-actions"><button className="secondary-button" type="button" onClick={onBack}>← Back</button><button className="primary-button" type="button" onClick={onContinue} disabled={Boolean(busy)}>Prepare complaint draft <span>→</span></button></div></section>;
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
  const guide = getIncidentGuide(incident.incidentType);
  const officialUrl = guide.reportingRoute === 'ceir' ? officialLinks.ceir : guide.reportingRoute === 'suspect' ? officialLinks.suspect : guide.reportingRoute === 'technical' ? officialLinks.certIn : officialLinks.ncrp;
  const officialLabel = guide.reportingRoute === 'ceir' ? 'Open CEIR / Sanchar Saathi' : guide.reportingRoute === 'suspect' ? 'Open NCRP Report Suspect' : guide.reportingRoute === 'technical' ? 'Open CERT-In guidance' : 'Continue to official NCRP';
  return <section className="handoff-page"><button className="back-link handoff-back" onClick={onBack} type="button">← Back to review</button><div className="ready-mark">✓</div><p className="section-kicker">Complaint ready</p><h1>Your complaint package<br /><em>is ready.</em></h1><p>We&apos;ve organized the information you provided into a structured, evidence-backed draft. Review is complete; the next step happens through the official route matched to this incident.</p><div className="handoff-summary"><div><span>✓</span><strong>Incident structured</strong><small>{guide.title}</small></div><div><span>✓</span><strong>Evidence organized</strong><small>{incident.evidence.length} file · key details recorded</small></div><div><span>✓</span><strong>Official route selected</strong><small>{guide.category}</small></div></div><div className="handoff-card"><span className="external-icon">↗</span><div><p className="section-kicker">Next step</p><h2>{guide.officialAction}</h2><p>{guide.officialDetail} You will leave this site; no information is transferred automatically.</p></div><a className="official-button" href={officialUrl} target="_blank" rel="noreferrer">{officialLabel} <span>↗</span></a></div>{isFinancialIncident(incident.incidentType) && <div className="urgent-callout"><strong>Financial loss or unauthorised transfer?</strong><a href="tel:1930">Call 1930 immediately</a></div>}<div className="recovery-warning"><span>!</span><div><h2>WATCH OUT FOR RECOVERY SCAMS</h2><ul><li>Never pay an unexpected “recovery agent.”</li><li>Never share an OTP, PIN, password, or remote access.</li><li>Verify official communication independently.</li></ul></div></div><div className="prototype-note"><strong>This is an external handoff.</strong><span>Cyber First Response is not a government service and did not submit a complaint.</span><button type="button" onClick={onTransparency}>See how the service works</button></div><div className="handoff-actions"><button className="secondary-button" type="button" onClick={onBack}>← Back to review</button><button className="secondary-button" type="button" onClick={onReset}>↻ Start a fresh case</button></div></section>;
}

function Transparency({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" tabIndex={-1} onKeyDown={(event) => event.key === 'Escape' && onClose()} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="transparency-modal" role="dialog" aria-modal="true" aria-labelledby="transparency-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Close transparency details">×</button><p className="section-kicker">Service transparency</p><h1 id="transparency-title">What works, and what stays external?</h1><p>The case workflow and storage are live. The LLM runs only on the server; government, bank, and helpline systems remain separate and receive no automatic transfer.</p><div className="transparency-grid"><div className="working"><span>● Working</span><ul><li>Persistent private cases</li><li>LLM-assisted incident classification</li><li>Missing-information checks</li><li>Private evidence file storage</li><li>Timeline and complaint generation</li><li>Version-safe progress updates</li></ul></div><div className="simulated"><span>● Demo-only</span><ul><li>Voice transcription</li><li>Built-in sample receipt</li><li>Sample suspect details</li><li>Government handoff preview</li></ul></div><div className="not-connected"><span>● Not connected</span><ul><li>Live NCRP submission</li><li>Live bank or 1930 APIs</li><li>Law-enforcement systems</li><li>Automated suspect lookup</li></ul></div></div><button className="primary-button full" type="button" onClick={onClose} autoFocus>I understand</button></section></div>;
}

function TrustFooter() { return <footer><p><strong>Cyber First Response</strong> is an independent hackathon prototype.</p><p>For financial fraud, contact <strong>1930</strong> immediately. For immediate danger, call <strong>112</strong>.</p></footer>; }
function formatKey(key: string) { return key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase()); }
function messageFrom(cause: unknown) { return cause instanceof Error ? cause.message : 'The case service could not complete this request. Please retry.'; }
function formatMoney(amount?: number) { return amount ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount) : ''; }
function evidenceCompleteness(type: Incident['incidentType'], detected: Record<string, string>) { const requirements = getEvidenceRequirements(type); return requirements.length ? Math.round((requirements.filter((field) => field.key === 'screenshot' ? Boolean(detected.screenshot) : Boolean(detected[field.key])).length / requirements.length) * 100) : 0; }
function nextPaint() { return new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); }
function wait(duration: number) { return new Promise<void>((resolve) => window.setTimeout(resolve, duration)); }
