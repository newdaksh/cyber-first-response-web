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
- `lib/server/llm.ts` — Mesh-backed Gemini inference with validated fallbacks
- `lib/services.ts` — incident analysis, response plans, timelines, and complaint generation
- `db/schema.ts` and `drizzle/` — Sites D1 schema and deployable migration

## LLM configuration

The hosted Site reads `MESH_API_KEY`, `MESH_API_ENDPOINT`, and `MESH_API_MODEL` from protected Sites runtime configuration. The key is never bundled into client code or committed to source. Mesh inference is used for classification, fact extraction, timeline generation, and complaint drafting; deterministic validation and fallbacks keep the workflow available if the provider is unavailable.
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
