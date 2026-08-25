# Cyber First Response

**The first 30 minutes after a cybercrime.**

Cyber First Response is an India-focused, persistent incident-response workflow built for the Build What Moves India hackathon. It guides a user from an initial description through urgent actions, private evidence storage, a reconstructed timeline, a structured case file, an editable complaint, human review, and an external official-channel handoff.

## Trust boundary

This is an independent prototype, not a government service. It does not submit to NCRP, connect to 1930 or a bank API, or access law-enforcement systems. The final handoff opens the official NCRP website; no case data is transferred automatically.

An opaque, `HttpOnly`, `SameSite=Lax` cookie associates one browser with its current case. There is no user account or identity verification, so anyone with access to that browser session can access the case. Starting a fresh case removes the previous D1 record and its tracked R2 evidence objects. There is currently no scheduled retention expiry.

## Security and privacy controls

- Server-authoritative workflow transitions with optimistic revision checks prevent stale writes.
- Same-origin mutation checks and restrictive response headers reduce CSRF, framing, MIME-sniffing, referrer, and browser-capability risks.
- JSON commands are schema-validated and limited to 40 KiB.
- Evidence is limited to 10 MiB and to PNG, JPEG, WebP, or PDF signatures; filenames are normalized before private R2 storage.
- OTPs, PINs, passwords, passcodes, and CVVs are redacted before descriptions, evidence fields, and complaint edits are persisted.
- D1 snapshot and evidence-metadata writes are atomic; failed metadata writes trigger R2 cleanup.
- API failures return safe messages and correlation references instead of stack traces or sensitive values.

Pattern-based redaction is defense in depth, not a substitute for user care. Do not enter authentication secrets. Uploaded files are not malware-scanned and must not be made publicly downloadable without an additional scanning and authorization layer.

## AI configuration

If `MESH_API_KEY` is configured, server-side Mesh inference assists classification, fact extraction, timeline creation, and complaint drafting. The case text and extracted evidence fields required for those tasks are sent to the configured provider; uploaded file bytes are not. Validated deterministic fallbacks keep the workflow available when the provider is absent or unavailable.

Copy `.env.example` to `.env.local` for local provider testing:

```dotenv
MESH_API_KEY=
MESH_API_ENDPOINT=https://api.meshapi.ai/v1/chat/completions
MESH_API_MODEL=google/gemini-2.5-flash-lite
```

The endpoint must use HTTPS and must not contain embedded credentials. Runtime secrets belong in protected Sites configuration and must never be committed or exposed through client-prefixed variables.

## Architecture

- `app/page.tsx` — state-driven citizen workflow and accessible UI
- `app/api/case/*` — validated case-command and evidence endpoints
- `lib/workflow.ts` — platform-neutral, testable workflow state machine
- `lib/server/workflow.ts` — server adapter for the configured analysis provider
- `lib/server/store.ts` — D1 persistence, session ownership, revision control, and R2 lifecycle
- `lib/server/llm.ts` — bounded Mesh requests, response validation, and fallbacks
- `lib/commands.ts`, `lib/evidence.ts`, `lib/security.ts` — input, upload, and redaction boundaries
- `lib/services.ts` — incident analysis, action plans, timelines, and complaint generation
- `db/schema.ts` and `drizzle/` — D1 schema and deployable migration
- `e2e/` — API, complete-journey, mobile keyboard, and automated accessibility tests

## Local development

Requirements: Node.js 22.13 or newer and pnpm 11.22.

```text
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

The golden demo begins with: `Mujhe bank se call aaya tha KYC ke liye... OTP liya aur 25 hazaar kat gaya.`

## Quality commands

```text
pnpm format:check       # formatting gate
pnpm lint               # ESLint, zero warnings allowed
pnpm typecheck          # strict TypeScript validation
pnpm test:unit          # deterministic unit and security tests
pnpm test:coverage      # native Node coverage report
pnpm test:integration   # live API and persistence tests
pnpm test:a11y          # complete journey plus axe and keyboard checks
pnpm test:e2e           # all browser/API tests
pnpm build              # production build
pnpm check              # format, lint, types, coverage, and build
```

CI runs the complete static, unit, audit, build, API, browser, mobile, and accessibility gate on every pull request and push to `main`.
