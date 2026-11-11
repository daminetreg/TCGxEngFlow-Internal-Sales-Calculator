# EngFlow CI Economics

Sales calculator comparing equal-size baseline CI with modeled EngFlow infrastructure cost and finite-fleet throughput.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/engflow-calculator run dev` — run the web artifact through its managed workflow
- `pnpm test:calculator` — run economics unit tests
- `pnpm build:calculator && pnpm start:calculator` — build and run both components as one server outside Replit
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- No database, authentication, API keys or prospect-data server storage is required.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/engflow-calculator/src/lib/economics.ts` — scenario model and validation
- `artifacts/engflow-calculator/src/pages/calculator.tsx` — calculator UI, reports and local-only scenario persistence
- `artifacts/engflow-calculator/public/legacy/` — original four-year model and PDF export, with a navigation link back
- `artifacts/api-server/src/lib/pricing.ts` — public Vantage EC2 and Azure Retail API lookup
- `lib/api-spec/openapi.yaml` — pricing API contract

## Architecture decisions

- Language/file-count presets are illustrative, never measured benchmark evidence. Verify performance with a pilot.
- Hard ROI excludes developer-time opportunity and includes annual EngFlow fees and initial implementation costs.
- Both scenarios use identical machines and cores; on-prem retained hardware and fixed-fleet costs are not avoided cash spend.
- Prices are public Linux on-demand USD rates with retrieval timestamps; manual rates are always supported. GCP is manual-only.

## Product

Cloud and On-Prem comparison modes; infrastructure cash ROI, CPU utilization, active and allocated core-hours, capacity, developer-time opportunity, print/PDF, CSV and JSON reports. The original four-year calculator remains available.

## User preferences

The user wants normal CI estimates without EngFlow for equal-size CI, hard ROI, and granular on-prem CPU utilization and productivity throughput on finite resources.

## Gotchas

Pricing endpoints receive only cloud provider, region and machine type. Prospect assumptions are calculated in the browser, not sent to the server. No CPU time-series is fabricated. Fork source: https://github.com/daminetreg/TCGxEngFlow-Internal-Sales-Calculator.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
