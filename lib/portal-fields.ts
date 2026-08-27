export type PortalCategory =
  'Women/Children Related Crime' | 'Financial Fraud' | 'Other Cyber Crime';

export const portalCategories: PortalCategory[] = [
  'Women/Children Related Crime',
  'Financial Fraud',
  'Other Cyber Crime',
];

export const portalSubcategories: Record<PortalCategory, string[]> = {
  'Women/Children Related Crime': [
    'Cyberstalking',
    'Online Harassment',
    'Child Sexual Abuse Material (CSAM)',
    'Non-consensual Imagery',
    'Other Women/Children Related Crime',
  ],
  'Financial Fraud': [
    'Aadhaar Enabled Payment System (AEPS)',
    'Business Email Compromise / Email Takeover',
    'Debit / Credit Card Fraud / SIM Swap Fraud',
    'Demat / Depository Fraud',
    'E-Wallet Related Fraud',
    'Fraud Call / Vishing',
    'Internet Banking Related Fraud',
    'UPI Related Frauds',
  ],
  'Other Cyber Crime': [
    'Social Media Impersonation',
    'Identity Theft',
    'Unauthorised Access / Hacking',
    'Cyber Threats',
    'Other Cyber Crime',
  ],
};

export const occurrencePlatforms = [
  'Email',
  'Facebook',
  'Instagram',
  'Snapchat',
  'Twitter (X)',
  'WhatsApp',
  'Website URL',
  'YouTube',
  'LinkedIn',
  'Telegram',
  'Mobile App',
  'Other',
] as const;

export function isPortalCategory(value: string): value is PortalCategory {
  return portalCategories.some((option) => option === value);
}

export function isPortalSubcategory(category: PortalCategory, value: string) {
  return portalSubcategories[category].includes(value);
}

export function isOccurrencePlatform(value: string) {
  return occurrencePlatforms.some((option) => option === value);
}
