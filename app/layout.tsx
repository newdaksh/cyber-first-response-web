import type { Metadata } from 'next';
import './globals.css';

const siteOrigin = 'https://cyber-first-response.daksh-jain819813.chatgpt.site';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: 'Cyber First Response — The first 30 minutes after a cybercrime',
  description: 'A secure cybercrime first-response workflow for persistent, evidence-backed, report-ready cases.',
  openGraph: {
    title: 'Cyber First Response',
    description: 'The first 30 minutes after a cybercrime.',
    type: 'website',
    images: [{ url: '/og.png', width: 1680, height: 945, alt: 'Cyber First Response — The first 30 minutes after a cybercrime.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cyber First Response',
    description: 'The first 30 minutes after a cybercrime.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-IN"><body>{children}</body></html>;
}
