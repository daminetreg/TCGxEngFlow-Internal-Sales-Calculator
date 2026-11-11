# EngFlow CI Economics

Extension of [Rachel Coutinho's sales calculator](https://github.com/rachel-coutinho/TCGxEngFlow-Internal-Sales-Calculator), adding **Cloud CI** and **On-Prem CI** comparisons against EngFlow on the **same fleet size and core count**.

The original four-year headcount/productivity model and its executive PDF export remain at `/legacy/index.html`. Its engine is unchanged; a header link returns to the new calculator. Original analysis files are retained in the GitHub fork.

## What is included

- Build duration, source-file count, programming language and cloud selection.
- Editable workload, utilization, cache reuse, parallel share, machine capacity and EngFlow investment assumptions.
- AWS Linux on-demand rates through the public Vantage Instances family API, and selected Azure Linux VM rates from Microsoft's Retail Prices API. Google Cloud and unsupported machines use manual rates.
- Baseline infrastructure cost, EngFlow infrastructure cost and fees, net annual cash savings, first-year ROI and implementation payback.
- Finite on-prem fleet throughput, modeled active-build CPU utilization, busy/idle cores, and work versus allocated core-hours.
- Separate developer-time opportunity, never included in hard-dollar ROI.
- Browser print / Save as PDF, CSV and JSON exports. Optional browser-only scenario saving; no database or login required.

## Run the enhanced calculator

Requires Node.js 24+ and pnpm.

```sh
pnpm install
pnpm build:calculator
pnpm start:calculator
```

Open `http://localhost:3000`. Set `PORT` to override the default. This starts one Express process serving the built frontend and `/api/pricing`. No credentials are needed.

In Replit, use the existing managed frontend and API workflows instead; those configure the ports and proxy routing. No separate startup server is needed.

```sh
pnpm test:calculator
pnpm run typecheck
```

The original root static files, when retained by the fork, can still be served independently using Python's HTTP server. The enhanced calculator requires the build above; a static-only host can support manual rates but not the server-side live pricing route.

## Model and caveats

**These are scenario estimates, not verified EngFlow benchmark results.** File count and language only suggest editable starting assumptions when the user explicitly applies the heuristic. They do not prove an acceleration factor.

Each representative build occupies one machine. With parallel/cacheable fraction `p`, cache hit rate `h`, baseline active CPU utilization `u0` and target utilization `u1`, the duration ratio is:

```
ratio = (1 − p) + p × (1 − h) × u0 / u1
EngFlow duration = baseline duration × ratio
remaining CPU work = baseline CPU work × (1 − p × h)
```

The serial share remains unchanged. Overall achieved utilization is derived from work divided by allocated core-hours, not assumed equal to the target. Capacity is whole builds per machine within the daily operating window. Cost comparisons use the same completed workload, capped by both fleets' modeled capacity. Excess demand is flagged, not counted as unlimited savings.

For autoscaling cloud machines, billed hours are matched builds × duration. Fixed cloud fleets retain the same annual infrastructure cost. On-prem annual cost includes hardware amortization, power at the entered draw for the powered-on window, and operations; both sides retain the same cost. More on-prem throughput is **not** automatically cash savings.

```
Recurring net cash savings = baseline infra − EngFlow infra − annual EngFlow fee
First-year net cash savings = recurring net cash savings − implementation cost
First-year hard ROI = first-year net cash savings / (annual fee + implementation cost)
Payback months = implementation cost / recurring net cash savings × 12
```

ROI is undefined when investment is zero. Payback is unavailable when recurring cash savings are non-positive. Negative ROI is shown without suppression. Productivity value is estimated from the blocked share of matched build-time reductions, assuming one developer per build; recovery is capped at the team's annual working hours.

**Not modeled:** queueing, cache storage/egress, CI platform fees, orchestration overhead, workload variation, minimum cloud billing increments, contract discounts or taxes. Include applicable costs in the entered EngFlow annual quote. Validate performance with representative build traces and a pilot before using modeled ROI for a purchasing decision.

## Pricing provenance and privacy

AWS uses `https://instances-api.vantage.sh/api/v1/instances/ec2/families/{family}/global`. Azure uses `https://prices.azure.com/api/retail/prices`. Supported Azure names are Standard_F{2,4,8,16,32,64}s_v2 and Standard_D{2,4,8,16,32,64}s_v5.

Only provider, region and instance type are sent for price lookup. Responses identify the source, retrieval time and currency. Six-hour server caching limits external requests; the retrieval timestamp is not a guarantee of the provider's price-effective date. Errors are shown explicitly and manual rates remain available. Default rates and fees are illustrative, not an EngFlow quote.

Prospect inputs are calculated locally. Optional persistence uses this browser's local storage only. Exported reports may contain entered prospect assumptions; share them accordingly.
