import type { ActionItem, IncidentType } from './incident.ts';

export type ReportingRoute =
  'financial' | 'women_child' | 'suspect' | 'ceir' | 'technical' | 'general';
export type EvidenceFieldKey =
  | 'date'
  | 'time'
  | 'platform'
  | 'contact'
  | 'username'
  | 'url'
  | 'email'
  | 'amount'
  | 'financialInstitution'
  | 'walletProvider'
  | 'transactionId'
  | 'bankReference'
  | 'recipient'
  | 'suspectInstitution'
  | 'ifsc'
  | 'accountId'
  | 'device'
  | 'imei'
  | 'screenshot'
  | 'chatHistory'
  | 'policeReport';

export interface EvidenceField {
  key: EvidenceFieldKey;
  label: string;
  help: string;
  critical?: boolean;
}

export interface IncidentGuide {
  type: IncidentType;
  title: string;
  category: string;
  summary: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reportingRoute: ReportingRoute;
  officialAction: string;
  officialDetail: string;
  actions: Omit<ActionItem, 'completed'>[];
  evidence: EvidenceField[];
}

const standardEvidence: EvidenceField[] = [
  { key: 'date', label: 'Date of incident', help: 'When you first noticed it.', critical: true },
  {
    key: 'time',
    label: 'Time of incident',
    help: 'An approximate time is still useful.',
    critical: true,
  },
  {
    key: 'screenshot',
    label: 'Screenshots or screen recording',
    help: 'Keep originals unchanged.',
    critical: true,
  },
  {
    key: 'contact',
    label: 'Phone number or handle',
    help: 'Record the suspicious caller, sender, or account.',
  },
  {
    key: 'url',
    label: 'Link or website',
    help: 'Copy it only if it is safe; do not open it again.',
  },
];

const financialEvidence: EvidenceField[] = [
  {
    key: 'financialInstitution',
    label: 'Victim bank / wallet / payment provider / merchant',
    help: 'Start typing the provider name shown on the account or receipt.',
    critical: true,
  },
  {
    key: 'walletProvider',
    label: 'Wallet / PG / PA service (if applicable)',
    help: 'For example, PhonePe, Paytm, Google Pay, PayU, or Razorpay.',
  },
  {
    key: 'accountId',
    label: 'Account / wallet / merchant / UPI identifier',
    help: 'For bank or card accounts, record only the last four digits in this prototype.',
  },
  {
    key: 'amount',
    label: 'Amount (₹)',
    help: 'Enter only the fraud amount you can verify.',
    critical: true,
  },
  {
    key: 'transactionId',
    label: 'Transaction ID / UTR number',
    help: 'Enter the 12-digit UTR when one is shown on the receipt.',
    critical: true,
  },
  {
    key: 'recipient',
    label: 'Suspect / beneficiary account or UPI ID',
    help: 'Record it exactly as shown on the transaction receipt.',
    critical: true,
  },
  {
    key: 'suspectInstitution',
    label: 'Suspect bank / wallet (if known)',
    help: 'The destination bank or wallet shown in the transaction.',
  },
  {
    key: 'ifsc',
    label: 'Suspect IFSC code (if known)',
    help: 'Enter the 11-character IFSC only when visible on a trusted record.',
  },
  {
    key: 'bankReference',
    label: 'Bank reference number (optional)',
    help: 'Any separate alphanumeric reference shown by the bank.',
  },
  ...standardEvidence,
];

const socialEvidence: EvidenceField[] = [
  {
    key: 'platform',
    label: 'App or platform',
    help: 'For example, WhatsApp, Instagram, Telegram, or email.',
    critical: true,
  },
  {
    key: 'username',
    label: 'Profile, channel, or username',
    help: 'Record the identifier exactly as visible.',
    critical: true,
  },
  {
    key: 'chatHistory',
    label: 'Chats, posts, and messages',
    help: 'Preserve the full context, dates, and profile page.',
    critical: true,
  },
  ...standardEvidence,
];

function action(
  id: string,
  title: string,
  detail: string,
  priority: ActionItem['priority'],
): Omit<ActionItem, 'completed'> {
  return { id, title, detail, priority };
}

const generalActions = [
  action(
    'stop-contact',
    'Stop engaging with the suspected attacker',
    'Do not send money, share codes, install apps, or follow a link sent by them.',
    'now',
  ),
  action(
    'secure-account',
    'Secure the affected account or device',
    'Use an official app or known website from a trusted device; change passwords and remove unknown sessions.',
    'now',
  ),
  action(
    'preserve-evidence',
    'Preserve evidence before it disappears',
    'Save screenshots, full chats, call logs, emails, profile links, receipts, and dates without editing them.',
    'next',
  ),
  action(
    'report-ncrp',
    'Report through the National Cyber Crime Reporting Portal',
    'Choose the closest category and sub-category on the official portal. Keep the acknowledgement number.',
    'next',
  ),
  action(
    'avoid-recovery',
    'Avoid recovery scams',
    'No genuine authority will ask for an OTP, PIN, password, remote access, or an upfront recovery fee.',
    'protect',
  ),
];

export const incidentGuides: Record<IncidentType, IncidentGuide> = {
  upi_payment_fraud: {
    type: 'upi_payment_fraud',
    title: 'UPI, wallet, or payment fraud',
    category: 'Online financial fraud',
    summary:
      'Unexpected UPI debit, collect request, QR-code payment, wallet transfer, or payment-app fraud.',
    severity: 'critical',
    reportingRoute: 'financial',
    officialAction: 'Call 1930 now',
    officialDetail:
      'For cyber financial fraud, report immediately and also contact the bank or payment provider using its official channel.',
    actions: [
      action(
        'call-1930',
        'Call 1930 immediately',
        'Report the financial fraud quickly; have the amount, time, transaction reference, and recipient details ready.',
        'now',
      ),
      action(
        'contact-provider',
        'Contact your bank or payment provider',
        'Use the number in the official app, card, or website and ask about blocking or disputing the transaction.',
        'now',
      ),
      action(
        'preserve-receipt',
        'Save the receipt and full conversation',
        'Keep transaction alerts, UPI IDs, chats, call logs, and screenshots unchanged.',
        'next',
      ),
      action(
        'report-ncrp',
        'File the NCRP report',
        'Use “Report Other Cyber Crime” and select the closest financial-fraud category.',
        'next',
      ),
      action(
        'avoid-recovery',
        'Ignore recovery offers',
        'Do not pay another fee or share an OTP, PIN, password, CVV, or screen-control access.',
        'protect',
      ),
    ],
    evidence: financialEvidence,
  },
  card_or_banking_fraud: {
    type: 'card_or_banking_fraud',
    title: 'Card, internet-banking, or e-wallet fraud',
    category: 'Online financial fraud',
    summary: 'Unauthorised card, net-banking, wallet, or business-email payment activity.',
    severity: 'critical',
    reportingRoute: 'financial',
    officialAction: 'Call 1930 now',
    officialDetail:
      'Fast reporting of a financial loss can help the response process; contact your bank or provider through a verified official channel.',
    actions: [
      action(
        'call-1930',
        'Call 1930 immediately',
        'Report the cyber financial fraud with transaction and account details.',
        'now',
      ),
      action(
        'block-instrument',
        'Block or secure the affected banking channel',
        'Use the bank’s official app or number to block a card, account access, or wallet if advised.',
        'now',
      ),
      action(
        'review-activity',
        'Review recent transactions',
        'Note every unauthorised debit or login without deleting notifications.',
        'next',
      ),
      action(
        'report-ncrp',
        'File an NCRP financial-fraud complaint',
        'Keep the acknowledgement number for follow-up.',
        'next',
      ),
      action(
        'avoid-recovery',
        'Do not reveal banking secrets',
        'Banks do not need your PIN, OTP, password, or CVV to help you.',
        'protect',
      ),
    ],
    evidence: financialEvidence,
  },
  investment_or_crypto_scam: {
    type: 'investment_or_crypto_scam',
    title: 'Investment, trading, or cryptocurrency scam',
    category: 'Online financial fraud / cryptocurrency crime',
    summary:
      'A promise of returns, a fake trading dashboard, crypto-transfer pressure, or a fake investment group.',
    severity: 'critical',
    reportingRoute: 'financial',
    officialAction: 'Call 1930 now if money was sent',
    officialDetail:
      'Report a completed or attempted financial transfer immediately, then preserve wallet addresses, transaction references, and group messages.',
    actions: [
      action(
        'call-1930',
        'Call 1930 if a transfer was made',
        'Report each transaction, payment method, wallet address, and the time it was sent.',
        'now',
      ),
      action(
        'stop-investing',
        'Stop further transfers',
        'Do not send a “tax”, “unlock”, “verification”, or recovery payment.',
        'now',
      ),
      action(
        'preserve-dashboard',
        'Capture the investment trail',
        'Save app names, group links, wallet addresses, transaction hashes, chats, and receipts.',
        'next',
      ),
      action(
        'report-ncrp',
        'Report to NCRP',
        'Select the closest financial-fraud or cryptocurrency-related category.',
        'next',
      ),
      action(
        'avoid-recovery',
        'Beware of recovery agents',
        'A person promising to recover crypto for an upfront fee may be another scammer.',
        'protect',
      ),
    ],
    evidence: financialEvidence,
  },
  impersonation_or_digital_arrest: {
    type: 'impersonation_or_digital_arrest',
    title: 'Impersonation or “digital arrest” scam',
    category: 'Online financial fraud / social engineering',
    summary:
      'Someone claims to be police, CBI, a court, customs, a bank, or another authority and uses fear to demand secrecy, money, or access.',
    severity: 'critical',
    reportingRoute: 'financial',
    officialAction: 'End the call and call 1930 if money or details were shared',
    officialDetail:
      'No authority should keep you on a video call to “arrest” you or demand a transfer. If there is immediate physical danger, call 112.',
    actions: [
      action(
        'end-contact',
        'End the call or chat',
        'Do not stay isolated, transfer money, install an app, or move to another platform.',
        'now',
      ),
      action(
        'call-1930',
        'Call 1930 if money or credentials were shared',
        'Have any transaction details ready. If no money moved, preserve the identifiers and report the attempt.',
        'now',
      ),
      action(
        'tell-trusted-person',
        'Tell a trusted person',
        'Scammers rely on secrecy and urgency; get independent support before taking any further step.',
        'next',
      ),
      action(
        'preserve-impersonation',
        'Preserve the caller and message details',
        'Keep phone numbers, profile names, emails, call logs, and screenshots.',
        'next',
      ),
      action(
        'avoid-recovery',
        'Do not trust a “case closer” or recovery fee',
        'Verify authorities through independently found official contact details.',
        'protect',
      ),
    ],
    evidence: [
      ...financialEvidence,
      {
        key: 'platform',
        label: 'Call or chat platform',
        help: 'For example, phone, WhatsApp, Skype, or Telegram.',
      },
    ],
  },
  phishing_or_vishing: {
    type: 'phishing_or_vishing',
    title: 'Phishing, smishing, or vishing',
    category: 'Online and social-media related crime',
    summary:
      'A fake link, delivery/KYC message, deceptive email, or call attempting to steal logins, codes, or payment details.',
    severity: 'high',
    reportingRoute: 'suspect',
    officialAction: 'Report the suspect identifier',
    officialDetail:
      'If no loss occurred, use NCRP’s Report Suspect facility for the suspicious URL, phone number, email, SMS header, or social-media link. If money moved, call 1930.',
    actions: [
      action(
        'stop-clicking',
        'Stop using the suspicious link or caller',
        'Do not reply, install an app, enter another code, or reuse the link.',
        'now',
      ),
      action(
        'change-password',
        'Change exposed passwords from a trusted device',
        'Use the official website or app, then turn on two-factor authentication and sign out unknown sessions.',
        'now',
      ),
      action(
        'report-suspect',
        'Report the suspicious identifier',
        'Use the NCRP Report Suspect facility for the URL, number, email, or social handle.',
        'next',
      ),
      action(
        'preserve-message',
        'Keep the original message',
        'Save the sender, link, email headers when available, and screenshots.',
        'next',
      ),
      action(
        'watch-financial',
        'Watch for follow-on fraud',
        'If an unauthorised transaction appears, call 1930 immediately.',
        'protect',
      ),
    ],
    evidence: [
      ...standardEvidence,
      { key: 'email', label: 'Sender email or SMS header', help: 'Record exactly as shown.' },
    ],
  },
  account_takeover: {
    type: 'account_takeover',
    title: 'Account takeover or profile hacking',
    category: 'Online and social-media related crime',
    summary:
      'You are locked out, your password/recovery details changed, or messages/posts were sent from your account without permission.',
    severity: 'high',
    reportingRoute: 'general',
    officialAction: 'Secure the account and report on NCRP',
    officialDetail:
      'Use the platform’s recovery and reporting tools from a trusted device, then report the cybercrime through NCRP if there is unauthorised access or harm.',
    actions: [
      action(
        'secure-account',
        'Recover and secure the account',
        'Use the platform’s official recovery page; change passwords, remove unknown sessions, and enable two-factor authentication.',
        'now',
      ),
      action(
        'secure-email',
        'Secure the linked email and phone number',
        'Your email or SIM may be the recovery path; review recovery settings and active sessions.',
        'now',
      ),
      action(
        'notify-contacts',
        'Warn recent contacts if needed',
        'Tell them not to trust payment or link requests sent from the compromised account.',
        'next',
      ),
      action(
        'preserve-access',
        'Preserve login alerts and profile evidence',
        'Save alerts, changed settings, messages, usernames, and timestamps.',
        'next',
      ),
      action(
        'report-ncrp',
        'Report through NCRP',
        'Choose the closest online or social-media crime category.',
        'protect',
      ),
    ],
    evidence: [
      ...socialEvidence,
      {
        key: 'email',
        label: 'Linked email',
        help: 'Record only the email address, never the password.',
      },
    ],
  },
  social_media_abuse: {
    type: 'social_media_abuse',
    title: 'Fake profile, harassment, threats, or harmful post',
    category: 'Online and social-media related crime',
    summary:
      'A fake or impersonating profile, threats, abusive posts, doxxing, blackmail, or harmful content on social media.',
    severity: 'high',
    reportingRoute: 'general',
    officialAction: 'Report the content and use NCRP',
    officialDetail:
      'Report the account/content in the platform first, preserve the URLs and context, then use the relevant NCRP category. Call 112 if there is immediate danger.',
    actions: [
      action(
        'safety-first',
        'Prioritize immediate safety',
        'If a threat suggests immediate danger, contact local emergency services at 112 and a trusted person.',
        'now',
      ),
      action(
        'report-platform',
        'Report and restrict the account on the platform',
        'Use the platform’s reporting tools; do not argue with or pay the person.',
        'now',
      ),
      action(
        'preserve-social',
        'Capture the complete context',
        'Save profile URLs, usernames, post links, chats, dates, and screenshots before blocking where safe.',
        'next',
      ),
      action(
        'report-ncrp',
        'Report through NCRP',
        'Choose the closest online/social-media category and keep the acknowledgement number.',
        'next',
      ),
      action(
        'privacy-check',
        'Tighten privacy and account settings',
        'Change passwords if access may be exposed and avoid sharing new personal information.',
        'protect',
      ),
    ],
    evidence: socialEvidence,
  },
  cyber_stalking_or_bullying: {
    type: 'cyber_stalking_or_bullying',
    title: 'Cyber stalking, bullying, or repeated harassment',
    category: 'Online and social-media related crime',
    summary:
      'Repeated unwanted contact, monitoring, threats, bullying, or coercive messages online.',
    severity: 'high',
    reportingRoute: 'general',
    officialAction: 'Put safety first, preserve evidence, and report',
    officialDetail:
      'If you feel unsafe or threatened, call 112. Preserve the pattern of contact and report the account/platform as well as NCRP.',
    actions: [
      action(
        'safety-first',
        'Get immediate help if you feel unsafe',
        'Call 112 for an urgent threat; contact a trusted person and avoid meeting or confronting the person.',
        'now',
      ),
      action(
        'stop-engagement',
        'Stop engaging where safe',
        'Use blocking and privacy controls after saving evidence. Do not share your location or routine.',
        'now',
      ),
      action(
        'preserve-pattern',
        'Preserve the pattern of harassment',
        'Save full conversations, call logs, profiles, dates, and any threats—not just one message.',
        'next',
      ),
      action(
        'report-platform',
        'Report the account on the platform',
        'Use the in-app safety/reporting process.',
        'next',
      ),
      action(
        'report-ncrp',
        'Report through NCRP',
        'Select the closest online/social-media crime category.',
        'protect',
      ),
    ],
    evidence: socialEvidence,
  },
  sextortion_or_intimate_content: {
    type: 'sextortion_or_intimate_content',
    title: 'Sextortion or non-consensual intimate content',
    category: 'Crime related to women / online sexual content',
    summary:
      'Threats to share intimate material, blackmail, or non-consensual sexual/intimate content online.',
    severity: 'critical',
    reportingRoute: 'women_child',
    officialAction: 'Protect yourself and report on NCRP',
    officialDetail:
      'Do not pay or send more material. Preserve identifying details and use the NCRP women/child-related reporting route; call 112 if you are in immediate danger.',
    actions: [
      action(
        'safety-first',
        'Get immediate support and safety help',
        'If you are in danger, call 112. Tell someone you trust; you do not need to handle threats alone.',
        'now',
      ),
      action(
        'stop-payment',
        'Do not pay or send more content',
        'Paying rarely stops blackmail and can lead to further demands.',
        'now',
      ),
      action(
        'preserve-identifier',
        'Preserve identifiers, not the harmful content',
        'Save usernames, URLs, threats, dates, and screenshots necessary for reporting. Avoid forwarding or resharing intimate material.',
        'next',
      ),
      action(
        'report-platform',
        'Report the account or content to the platform',
        'Use the platform’s abuse report tools.',
        'next',
      ),
      action(
        'report-women-child',
        'Report through NCRP',
        'Use the women/child-related route as applicable and retain your acknowledgement.',
        'protect',
      ),
    ],
    evidence: socialEvidence,
  },
  child_safety_or_grooming: {
    type: 'child_safety_or_grooming',
    title: 'Child online safety, grooming, or sexual exploitation content',
    category: 'Crime related to women / children',
    summary: 'Online grooming, sexual exploitation, or sexual content involving a child.',
    severity: 'critical',
    reportingRoute: 'women_child',
    officialAction: 'Ensure the child’s immediate safety and report',
    officialDetail:
      'If there is immediate danger, call 112. Use NCRP’s women/child-related reporting route. Do not download, forward, or reshare child sexual content.',
    actions: [
      action(
        'safety-first',
        'Ensure immediate safety',
        'Call 112 for immediate danger and involve a trusted parent, guardian, or local authority.',
        'now',
      ),
      action(
        'stop-contact',
        'Stop contact with the suspected person',
        'Do not confront them or arrange a meeting; block/report after preserving safe identifiers.',
        'now',
      ),
      action(
        'preserve-identifiers',
        'Preserve identifiers without copying harmful content',
        'Record usernames, URLs, dates, and threats. Do not download, forward, or circulate sexual content involving a child.',
        'next',
      ),
      action(
        'report-platform',
        'Report the account/content to the platform',
        'Use platform safety tools in addition to official reporting.',
        'next',
      ),
      action(
        'report-women-child',
        'Report on NCRP',
        'Use the women/child-related reporting option; the official portal also offers an anonymous option for specified sexual-content reports.',
        'protect',
      ),
    ],
    evidence: socialEvidence,
  },
  job_loan_or_marketplace_scam: {
    type: 'job_loan_or_marketplace_scam',
    title: 'Job, loan, shopping, delivery, or marketplace scam',
    category: 'Online financial fraud / online and social-media crime',
    summary:
      'A fake job or loan, a fake seller/buyer, delivery scam, rental scam, advance-fee request, or marketplace deception.',
    severity: 'high',
    reportingRoute: 'financial',
    officialAction: 'Call 1930 if money was sent',
    officialDetail:
      'Keep the listing, ad, payment record, account details, and conversation. Use NCRP’s closest category after contacting your bank/provider.',
    actions: [
      action(
        'call-1930',
        'Call 1930 if money was sent',
        'Report the transfer as quickly as possible with its transaction reference.',
        'now',
      ),
      action(
        'stop-payment',
        'Stop further payments and app installs',
        'Do not pay a registration, delivery, loan-processing, or refund fee.',
        'now',
      ),
      action(
        'preserve-listing',
        'Save the listing and full conversation',
        'Capture ad URLs, seller/buyer profiles, messages, receipts, and delivery details.',
        'next',
      ),
      action(
        'report-platform',
        'Report the listing or account',
        'Use the marketplace, job site, or social platform’s reporting tool.',
        'next',
      ),
      action(
        'report-ncrp',
        'File the NCRP report',
        'Choose the closest online financial or social-media category.',
        'protect',
      ),
    ],
    evidence: financialEvidence,
  },
  romance_or_matrimonial_scam: {
    type: 'romance_or_matrimonial_scam',
    title: 'Romance or matrimonial scam',
    category: 'Online and social-media related crime',
    summary:
      'A dating or matrimonial connection asks for money, secrecy, gifts, account use, or sends a fake emergency/story.',
    severity: 'high',
    reportingRoute: 'financial',
    officialAction: 'Stop payments and call 1930 if money was sent',
    officialDetail:
      'Preserve the complete conversation, profile, promises, and payment trail. The NCRP manual includes online matrimonial fraud under online/social-media crime.',
    actions: [
      action(
        'stop-payment',
        'Stop sending money or valuables',
        'Do not send a “customs”, travel, medical, or verification payment.',
        'now',
      ),
      action(
        'call-1930',
        'Call 1930 if money was transferred',
        'Report the transaction with amount, time, and recipient details.',
        'now',
      ),
      action(
        'preserve-profile',
        'Preserve the profile and full conversation',
        'Save username, platform, chats, images, email, phone number, and receipts.',
        'next',
      ),
      action(
        'report-platform',
        'Report the profile on the platform',
        'Use the dating/matrimonial platform’s reporting tools.',
        'next',
      ),
      action(
        'report-ncrp',
        'Report through NCRP',
        'Use the closest online/social-media or financial-fraud category.',
        'protect',
      ),
    ],
    evidence: [...financialEvidence, ...socialEvidence],
  },
  identity_theft_or_sim_swap: {
    type: 'identity_theft_or_sim_swap',
    title: 'Identity theft, SIM swap, or unauthorised KYC use',
    category: 'Online financial fraud / mobile crime',
    summary:
      'Your identity documents, phone number, SIM, or KYC details may be used without permission, often followed by account takeovers or fraud.',
    severity: 'critical',
    reportingRoute: 'financial',
    officialAction: 'Contact the telecom provider and affected bank immediately',
    officialDetail:
      'If a SIM suddenly loses service or financial activity occurs, act quickly: secure banking, contact the telecom provider through verified channels, call 1930 for fraud, and report on NCRP.',
    actions: [
      action(
        'contact-provider',
        'Contact your telecom provider and bank',
        'Use verified support channels to secure the SIM, account recovery, and financial access.',
        'now',
      ),
      action(
        'call-1930',
        'Call 1930 for a financial loss',
        'Report any unauthorised transfer as soon as possible.',
        'now',
      ),
      action(
        'secure-email',
        'Secure email and account recovery settings',
        'Change passwords from a trusted device and remove unknown sessions.',
        'next',
      ),
      action(
        'preserve-alerts',
        'Save SIM, bank, and login alerts',
        'Keep messages, timestamps, account notices, and phone details.',
        'next',
      ),
      action(
        'report-ncrp',
        'Report through NCRP',
        'Choose the closest financial fraud or mobile-crime category.',
        'protect',
      ),
    ],
    evidence: [
      ...financialEvidence,
      {
        key: 'email',
        label: 'Identity/KYC-related email or message',
        help: 'Save the sender and context.',
      },
    ],
  },
  lost_or_stolen_phone: {
    type: 'lost_or_stolen_phone',
    title: 'Lost or stolen phone',
    category: 'Mobile crime',
    summary:
      'A phone is lost or stolen, especially where accounts, SIM, payment apps, or personal data could be accessed.',
    severity: 'high',
    reportingRoute: 'ceir',
    officialAction: 'Block the device through CEIR after a police report',
    officialDetail:
      'For a lost/stolen phone, the government’s CEIR process requires a police report and a re-issued SIM for OTP verification. Secure accounts first.',
    actions: [
      action(
        'secure-accounts',
        'Secure accounts from another device',
        'Change important passwords, sign out sessions, and contact your bank/provider if payment apps were active.',
        'now',
      ),
      action(
        'file-police-report',
        'File a police report',
        'Keep the report/FIR or lost-report copy and the phone’s IMEI number.',
        'now',
      ),
      action(
        'block-sim',
        'Contact your telecom provider',
        'Secure or replace the SIM to protect OTP-based account recovery.',
        'next',
      ),
      action(
        'block-ceir',
        'Request IMEI blocking through CEIR',
        'Use the official CEIR / Sanchar Saathi service after preparing the police report and required identity details.',
        'next',
      ),
      action(
        'watch-financial',
        'Watch for account misuse',
        'Call 1930 immediately if you spot a financial fraud.',
        'protect',
      ),
    ],
    evidence: [
      {
        key: 'imei',
        label: 'IMEI number',
        help: 'From the box, bill, or purchase record.',
        critical: true,
      },
      {
        key: 'policeReport',
        label: 'Police report / FIR reference',
        help: 'Keep a copy for CEIR.',
        critical: true,
      },
      { key: 'device', label: 'Device make and model', help: 'Record the identifying details.' },
      { key: 'contact', label: 'Lost phone number', help: 'Record it without exposing an OTP.' },
      ...standardEvidence,
    ],
  },
  ransomware_or_malware: {
    type: 'ransomware_or_malware',
    title: 'Ransomware or malware infection',
    category: 'Ransomware',
    summary:
      'Files are encrypted or locked, a ransom is demanded, a device behaves maliciously, or remote-control malware may be present.',
    severity: 'critical',
    reportingRoute: 'technical',
    officialAction: 'Disconnect the affected device or network',
    officialDetail:
      'CERT-In advises isolating affected systems, preserving logs and malware indicators, and recovering only after the threat is removed. Do not pay a ransom.',
    actions: [
      action(
        'isolate-device',
        'Disconnect the affected device or network',
        'Turn off Wi-Fi/Bluetooth, unplug network cables, and disconnect external storage; avoid spreading the infection.',
        'now',
      ),
      action(
        'do-not-pay',
        'Do not pay or negotiate',
        'Payment does not guarantee recovery and can lead to more demands.',
        'now',
      ),
      action(
        'preserve-technical',
        'Preserve evidence for technical recovery',
        'Keep ransom notes, file extensions, screenshots, logs, suspicious files, and known timestamps.',
        'next',
      ),
      action(
        'contact-it',
        'Use qualified technical support',
        'Restore only from a known-clean backup or rebuild after the threat is removed.',
        'next',
      ),
      action(
        'report-technical',
        'Report the incident',
        'Report the crime through NCRP; CERT-In also accepts technical incident reports.',
        'protect',
      ),
    ],
    evidence: [
      {
        key: 'device',
        label: 'Affected device or system',
        help: 'Record make/model, OS, and whether it is personal or work.',
        critical: true,
      },
      {
        key: 'screenshot',
        label: 'Ransom note or error screenshot',
        help: 'Do not run unknown “decryptor” tools.',
      },
      {
        key: 'url',
        label: 'Suspicious link, app, or file name',
        help: 'Record it without reopening it.',
      },
      ...standardEvidence,
    ],
  },
  hacking_or_data_breach: {
    type: 'hacking_or_data_breach',
    title: 'Unauthorised access, hacking, or data breach',
    category: 'Hacking',
    summary:
      'Someone accessed an account, device, network, or data without permission; personal data may have been exposed.',
    severity: 'high',
    reportingRoute: 'technical',
    officialAction: 'Contain access and preserve evidence',
    officialDetail:
      'Secure the affected account/system from a trusted device, retain login alerts and logs, then report through NCRP. CERT-In accepts technical incident reports.',
    actions: [
      action(
        'contain-access',
        'Contain the unauthorised access',
        'Change credentials from a trusted device, remove unknown sessions/tokens, and secure administrator accounts.',
        'now',
      ),
      action(
        'preserve-logs',
        'Preserve alerts and logs',
        'Keep access notifications, timestamps, IP/device information, emails, and screenshots.',
        'now',
      ),
      action(
        'assess-exposure',
        'Identify potentially affected accounts or data',
        'Do not delete logs or overwrite the affected device.',
        'next',
      ),
      action(
        'report-ncrp',
        'Report through NCRP',
        'Choose the hacking/unauthorised-access category.',
        'next',
      ),
      action(
        'report-technical',
        'Use technical incident reporting if needed',
        'CERT-In can receive computer-security incident reports and offer technical guidance.',
        'protect',
      ),
    ],
    evidence: [
      {
        key: 'device',
        label: 'Affected system or account',
        help: 'Record the device, app, site, or network involved.',
        critical: true,
      },
      { key: 'email', label: 'Security-alert email', help: 'Save the original alert if possible.' },
      ...standardEvidence,
    ],
  },
  website_defacement: {
    type: 'website_defacement',
    title: 'Website defacement or compromised website',
    category: 'Hacking',
    summary:
      'A website has been altered, inaccessible, redirected, or otherwise compromised without authorisation.',
    severity: 'high',
    reportingRoute: 'technical',
    officialAction: 'Contain the site and preserve server evidence',
    officialDetail:
      'Take a careful record of the defacement/redirect, preserve server and access logs, secure administrator credentials, and report the incident through NCRP/CERT-In as appropriate.',
    actions: [
      action(
        'contain-site',
        'Contain the website compromise',
        'Limit unauthorised access, rotate admin credentials, and use a qualified administrator; avoid deleting logs.',
        'now',
      ),
      action(
        'preserve-logs',
        'Preserve pages and server logs',
        'Save screenshots, URLs, access logs, timestamps, and malicious file indicators.',
        'now',
      ),
      action(
        'assess-impact',
        'Check for data exposure or persistence',
        'Review backups and other administrator accounts from a trusted environment.',
        'next',
      ),
      action(
        'report-technical',
        'Report to NCRP and CERT-In as appropriate',
        'Use the official reporting channels and retain acknowledgment details.',
        'next',
      ),
      action(
        'notify-users',
        'Follow your organisation’s incident process',
        'Do not make unsupported claims; communicate verified protective steps if users may be affected.',
        'protect',
      ),
    ],
    evidence: [
      {
        key: 'url',
        label: 'Affected website URL',
        help: 'Record the exact address.',
        critical: true,
      },
      {
        key: 'device',
        label: 'Hosting/server or admin account details',
        help: 'Do not enter passwords or secrets.',
      },
      ...standardEvidence,
    ],
  },
  online_gambling: {
    type: 'online_gambling',
    title: 'Online gambling or betting-related harm',
    category: 'Online gambling',
    summary:
      'A gambling/betting platform, payment group, or app has caused suspected fraud, coercion, or unauthorised financial activity.',
    severity: 'high',
    reportingRoute: 'financial',
    officialAction: 'Stop transfers and document the platform',
    officialDetail:
      'If money was moved fraudulently, call 1930. Preserve the site/app, account, payment details, and chats, then select the online-gambling category on NCRP.',
    actions: [
      action(
        'stop-payment',
        'Stop further payments',
        'Do not send a “withdrawal unlock”, tax, or verification fee.',
        'now',
      ),
      action(
        'call-1930',
        'Call 1930 for unauthorised financial loss',
        'Keep transaction details ready.',
        'now',
      ),
      action(
        'preserve-gambling',
        'Save platform and payment evidence',
        'Record the site/app, account/profile, payment history, group links, and messages.',
        'next',
      ),
      action(
        'report-ncrp',
        'Report through NCRP',
        'Choose online gambling or the closest financial-fraud category.',
        'next',
      ),
      action(
        'avoid-recovery',
        'Avoid recovery scams',
        'Do not trust third parties asking for payment to release funds.',
        'protect',
      ),
    ],
    evidence: [
      ...financialEvidence,
      {
        key: 'platform',
        label: 'Website or app',
        help: 'Record the name and URL without reopening it.',
      },
    ],
  },
  online_trafficking: {
    type: 'online_trafficking',
    title: 'Suspected online trafficking or exploitation',
    category: 'Online trafficking',
    summary:
      'Online recruitment, coercion, sale, transport, or exploitation that may put a person at risk.',
    severity: 'critical',
    reportingRoute: 'general',
    officialAction: 'Put immediate safety first and report',
    officialDetail:
      'If anyone is in immediate danger, call 112. Do not confront suspected traffickers; preserve available identifiers and report on NCRP.',
    actions: [
      action(
        'safety-first',
        'Call 112 for immediate danger',
        'Prioritize the person’s safety and seek local emergency support.',
        'now',
      ),
      action(
        'do-not-confront',
        'Do not confront or alert the suspected person',
        'Avoid creating additional risk; coordinate with appropriate authorities.',
        'now',
      ),
      action(
        'preserve-identifiers',
        'Preserve safe identifiers and communications',
        'Keep usernames, phone numbers, URLs, ads, dates, and messages.',
        'next',
      ),
      action(
        'report-platform',
        'Report the content/account to the platform',
        'Use the platform’s reporting process where safe.',
        'next',
      ),
      action(
        'report-ncrp',
        'Report through NCRP',
        'Choose the online trafficking category.',
        'protect',
      ),
    ],
    evidence: socialEvidence,
  },
  suspicious_identifier: {
    type: 'suspicious_identifier',
    title: 'Suspicious link, number, email, or social profile',
    category: 'Suspected cybercrime attempt',
    summary: 'You received a suspicious identifier but have not confirmed a loss or compromise.',
    severity: 'medium',
    reportingRoute: 'suspect',
    officialAction: 'Use NCRP’s Report Suspect facility',
    officialDetail:
      'The official portal accepts suspicious website URLs, WhatsApp/Telegram handles, phone numbers, email IDs, SMS headers/numbers, and social-media URLs for analysis and monitoring. Call 1930 if you become a financial-fraud victim.',
    actions: [
      action(
        'stop-engagement',
        'Do not interact with the identifier',
        'Do not click, call back, reply, send details, or install anything.',
        'now',
      ),
      action(
        'verify-independently',
        'Verify through a trusted source',
        'Find the organisation’s official website or number yourself; do not use the message’s contact details.',
        'now',
      ),
      action(
        'report-suspect',
        'Report the suspect on NCRP',
        'Submit the suspicious URL, number, email, SMS header, or social handle through Report Suspect.',
        'next',
      ),
      action(
        'save-message',
        'Keep a safe copy of the message',
        'Save screenshots and the sender details; do not forward malicious links.',
        'next',
      ),
      action(
        'watch-accounts',
        'Watch your accounts',
        'If you entered a password, change it. If money moves, call 1930 right away.',
        'protect',
      ),
    ],
    evidence: [
      ...standardEvidence,
      { key: 'email', label: 'Sender email or SMS header', help: 'Record it exactly as received.' },
    ],
  },
  other: {
    type: 'other',
    title: 'Other cyber-enabled incident',
    category: 'Any other cybercrime',
    summary:
      'A situation that does not clearly fit a known pattern yet, including new or mixed scam methods.',
    severity: 'medium',
    reportingRoute: 'general',
    officialAction: 'Preserve evidence and select the closest NCRP category',
    officialDetail:
      'NCRP provides an “Any Other Cyber Crime” option when no narrower category fits. If financial loss happened, call 1930 immediately.',
    actions: generalActions,
    evidence: standardEvidence,
  },
};

const legacyIncidentTypes: Record<string, IncidentType> = {
  bank_otp_fraud: 'card_or_banking_fraud',
  investment_scam: 'investment_or_crypto_scam',
  digital_arrest: 'impersonation_or_digital_arrest',
  phishing: 'phishing_or_vishing',
};

export function getIncidentGuide(type?: IncidentType | string): IncidentGuide {
  const normalized = type && type in legacyIncidentTypes ? legacyIncidentTypes[type] : type;
  return incidentGuides[normalized as IncidentType] ?? incidentGuides.other;
}

export function getEvidenceRequirements(type?: IncidentType | string) {
  const unique = new Map<EvidenceFieldKey, EvidenceField>();
  for (const field of getIncidentGuide(type).evidence) unique.set(field.key, field);
  return [...unique.values()];
}

export function isFinancialIncident(type?: IncidentType) {
  return getIncidentGuide(type).reportingRoute === 'financial';
}

export const officialLinks = {
  ncrp: 'https://cybercrime.gov.in/',
  suspect: 'https://cybercrime.gov.in/Webform/cyber_suspect.aspx',
  ceir: 'https://ceir.sancharsaathi.gov.in/',
  certIn: 'https://www.cert-in.org.in/',
} as const;
