# Cyber First Response

**The first 30 minutes after a cybercrime.**

Cyber First Response is an AI-assisted, mock-first cybercrime response workflow built for the Build What Moves India hackathon. It helps a fictional demo victim move from panic to urgent actions, organized evidence, a reconstructed timeline, a structured case file, an editable complaint, human review, and an external official-channel handoff.

## Trust boundary

This is not a government service. It does not submit to NCRP, connect to 1930 or a bank API, access law-enforcement systems, or store real victim data. Every identifier and transaction is fictional. The final action only opens the official NCRP website; no information is transferred.

## Architecture

- `app/page.tsx` — incident state-driven citizen workflow
- `lib/incident.ts` — central incident model and legal state transitions
- `lib/services.ts` — typed AI provider stages, deterministic fallback, evidence extraction, and simulated government service
- `tests/core.test.mjs` — dependency-free reliability tests for the critical pipeline

## Local commands

```text
pnpm dev
pnpm test:core
pnpm lint
pnpm build
```

The golden demo begins with: `Mujhe bank se call aaya tha KYC ke liye... OTP liya aur 25 hazaar kat gaya.`
