# Cyber First Response

**The first 30 minutes after a cybercrime.**

Cyber First Response is a persistent cybercrime response workflow built for the Build What Moves India hackathon. It helps a user move from panic to urgent actions, privately stored evidence, a reconstructed timeline, a structured case file, an editable complaint, human review, and an external official-channel handoff.

## Trust boundary

This is not a government service. It does not submit to NCRP, connect to 1930 or a bank API, or access law-enforcement systems. User cases are stored in Sites-managed D1, uploaded evidence is stored in Sites-managed R2, and the final action only opens the official NCRP website; no information is transferred.

## Architecture

- `app/page.tsx` — incident state-driven citizen workflow
- `lib/incident.ts` — central incident model and legal state transitions
- `app/api/case/*` — versioned case commands and evidence upload endpoints
- `lib/server/store.ts` — D1 persistence, private session ownership, and R2 evidence storage
- `lib/server/workflow.ts` — server-authoritative workflow transitions
- `lib/services.ts` — incident analysis, response plans, timelines, and complaint generation
- `db/schema.ts` and `migrations/` — Sites D1 schema
- `tests/core.test.mjs` — dependency-free reliability tests for the critical pipeline

## Local commands

```text
pnpm dev
pnpm test:core
pnpm test:backend
pnpm lint
pnpm build
```

The golden demo begins with: `Mujhe bank se call aaya tha KYC ke liye... OTP liya aur 25 hazaar kat gaya.`
