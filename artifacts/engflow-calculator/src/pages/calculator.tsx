import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  Cloud,
  Download,
  FileJson,
  History,
  Info,
  Printer,
  RefreshCw,
  RotateCcw,
  Server,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useGetMachinePrice, getGetMachinePriceQueryKey } from '@workspace/api-client-react';
import {
  DEFAULT_INPUTS,
  calculateEconomics,
  recommendPerformance,
  validateInputs,
  type CIInputs,
  type EconomicsResult,
} from '@/lib/economics';

type Provider = 'aws' | 'azure' | 'gcp';
type PriceSource = {
  kind: 'manual' | 'api';
  source?: string;
  sourceUrl?: string;
  fetchedAt?: string;
  description?: string;
};
type Cloud = { provider: Provider; region: string; instanceType: string };

const PROVIDER_DEFAULTS: Record<Provider, Cloud & { label: string; note: string }> = {
  aws: { provider: 'aws', region: 'us-east-1', instanceType: 'c6i.2xlarge', label: 'AWS', note: 'Live public EC2 catalog (Vantage)' },
  azure: { provider: 'azure', region: 'eastus', instanceType: 'Standard_F8s_v2', label: 'Azure', note: 'Azure Retail Prices API' },
  gcp: { provider: 'gcp', region: 'us-central1', instanceType: 'n2-standard-8', label: 'GCP', note: 'Manual rate only - no API lookup' },
};
const DEFAULT_CLOUD: Cloud = { provider: 'aws', region: 'us-east-1', instanceType: 'c6i.2xlarge' };
const STORAGE_KEY = 'engflow-ci-economics:v1';
const SOURCE_REPO = 'https://github.com/daminetreg/TCGxEngFlow-Internal-Sales-Calculator';
const LEGACY_URL = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/legacy/index.html`;

type Saved = { inputs: CIInputs; cloud: Cloud; price: PriceSource };

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Saved;
    if (!p?.inputs) return null;
    return { inputs: { ...DEFAULT_INPUTS, ...p.inputs }, cloud: p.cloud ?? DEFAULT_CLOUD, price: p.price ?? { kind: 'manual' } };
  } catch {
    return null;
  }
}

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });
const n0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const n1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const fin = (v: number | null | undefined) => typeof v === 'number' && Number.isFinite(v);
const money = (v: number | null | undefined) => (fin(v) ? usd0.format(v as number) : '—');
const num = (v: number | null | undefined, f = n0) => (fin(v) ? f.format(v as number) : '—');
const pct = (v: number | null | undefined) => (fin(v) ? `${n1.format(v as number)}%` : '—');

const LANGS: { v: CIInputs['language']; l: string }[] = [
  { v: 'cpp', l: 'C / C++' },
  { v: 'java', l: 'Java / Kotlin' },
  { v: 'rust', l: 'Rust' },
  { v: 'go', l: 'Go' },
  { v: 'typescript', l: 'TypeScript' },
  { v: 'other', l: 'Other' },
];

/* ---------- primitives ---------- */

function NumField({
  id, label, value, onChange, suffix, prefix, step = 'any', min = 0, hint,
}: {
  id: keyof CIInputs; label: string; value: number; onChange: (v: number) => void;
  suffix?: string; prefix?: string; step?: string; min?: number; hint?: string;
}) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : '');
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current || Number(text) !== value) {
      if (!focused.current) setText(Number.isFinite(value) ? String(value) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const invalid = text.trim() === '' || !Number.isFinite(Number(text));
  return (
    <label className="group block" htmlFor={`in-${id}`}>
      <span className="mb-1 flex items-center justify-between text-[11.5px] font-medium text-muted-foreground">
        {label}
        {hint && <span className="text-[10.5px] font-normal opacity-70">{hint}</span>}
      </span>
      <span
        className={`flex h-9 items-center rounded-md border bg-card px-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 ${
          invalid ? 'border-destructive/70' : 'border-input group-hover:border-foreground/30'
        }`}
      >
        {prefix && <span className="num mr-1 text-xs text-muted-foreground">{prefix}</span>}
        <input
          id={`in-${id}`}
          data-testid={`input-${id}`}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={text}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false;
          }}
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            const n = Number(t);
            onChange(t.trim() !== '' && Number.isFinite(n) ? n : Number.NaN);
          }}
          className="num w-full min-w-0 bg-transparent text-sm outline-none"
        />
        {suffix && <span className="ml-1 shrink-0 text-[11px] text-muted-foreground">{suffix}</span>}
      </span>
      {invalid && <span className="mt-0.5 block text-[10.5px] text-destructive">Enter a number to calculate results</span>}
    </label>
  );
}

function Segmented<T extends string>({
  value, options, onChange, testid,
}: { value: T; options: { v: T; l: ReactNode }[]; onChange: (v: T) => void; testid: string }) {
  return (
    <div className="inline-flex w-full rounded-lg border border-border bg-secondary p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          data-testid={`${testid}-${o.v}`}
          onClick={() => onChange(o.v)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all ${
            value === o.v ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Section({ title, kicker, children, defaultOpen = true }: { title: string; kicker?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-border py-4 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid={`toggle-section-${title.toLowerCase().replace(/\W+/g, '-')}`}
        className="flex w-full items-center justify-between text-left"
      >
        <span>
          {kicker && <span className="num mr-2 text-[10px] text-primary">{kicker}</span>}
          <span className="font-display text-[13px] font-bold">{title}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="rise mt-3 space-y-3">{children}</div>}
    </section>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="font-display grid h-8 w-8 place-items-center rounded-lg bg-[#2f7457] text-[22px] font-extrabold leading-none text-[#f5f7f4]">
        <span className="-mt-1">e</span>
      </span>
      <span className="font-display text-[17px] font-extrabold tracking-tight">
        engflow<span className="ml-1.5 font-medium text-muted-foreground">CI Economics</span>
      </span>
    </div>
  );
}

/* ---------- page ---------- */

export default function Calculator() {
  const saved = useMemo(loadSaved, []);
  const [inputs, setInputs] = useState<CIInputs>(saved?.inputs ?? DEFAULT_INPUTS);
  const [cloud, setCloud] = useState<Cloud>(saved?.cloud ?? DEFAULT_CLOUD);
  const [price, setPrice] = useState<PriceSource>(saved?.price ?? { kind: 'manual' });
  const [persist, setPersist] = useState<boolean>(!!saved);
  const [priceError, setPriceError] = useState<string | null>(null);
  const priceRevision = useRef(0);

  const set = <K extends keyof CIInputs>(k: K, v: CIInputs[K]) => setInputs((p) => ({ ...p, [k]: v }));
  const setRate = (v: number) => {
    priceRevision.current++;
    set('hourlyMachineCost', v);
    setPrice({ kind: 'manual' });
  };

  useEffect(() => {
    try {
      if (persist) localStorage.setItem(STORAGE_KEY, JSON.stringify({ inputs, cloud, price }));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // A browser that blocks storage still supports calculations and exports.
      setPersist(false);
    }
  }, [inputs, cloud, price, persist]);

  const params = cloud;
  const priceQuery = useGetMachinePrice(params, {
    query: { enabled: false, retry: false, queryKey: getGetMachinePriceQueryKey(params) },
  });

  const refreshPrice = async () => {
    const revision = ++priceRevision.current;
    setPriceError(null);
    const r = await priceQuery.refetch();
    if (revision !== priceRevision.current) return;
    if (r.isSuccess && r.data) {
      const d = r.data;
      setInputs((p) => ({ ...p, hourlyMachineCost: d.hourlyUsd, coresPerMachine: d.vcpus }));
      setPrice({ kind: 'api', source: d.source, sourceUrl: d.sourceUrl, fetchedAt: d.fetchedAt, description: d.description });
    } else if (r.error) {
      const e = r.error as { message?: string; status?: number };
      setPriceError(`${e.status ? `HTTP ${e.status}: ` : ''}${e.message ?? 'Price lookup failed'}`);
    }
  };

  const changeCloud = (patch: Partial<Cloud>) => {
    priceRevision.current++;
    setCloud((c) => ({ ...c, ...patch }));
    setPrice({ kind: 'manual' });
    setPriceError(null);
  };
  const changeProvider = (p: Provider) => {
    priceRevision.current++;
    const d = PROVIDER_DEFAULTS[p];
    setCloud({ provider: p, region: d.region, instanceType: d.instanceType });
    setPrice({ kind: 'manual' });
    setPriceError(null);
  };

  const reset = () => {
    priceRevision.current++;
    setPersist(false);
    setInputs(DEFAULT_INPUTS);
    setCloud(DEFAULT_CLOUD);
    setPrice({ kind: 'manual' });
    setPriceError(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage may be unavailable */ }
  };

  const errors = useMemo(() => validateInputs(inputs), [inputs]);
  const result: EconomicsResult | null = useMemo(() => {
    if (errors.length) return null;
    try {
      return calculateEconomics(inputs);
    } catch {
      return null;
    }
  }, [inputs, errors]);

  const rec = useMemo(() => recommendPerformance(inputs.language, inputs.fileCount), [inputs.language, inputs.fileCount]);
  const recApplied =
    rec.parallelFraction === inputs.parallelFraction && rec.cacheHitRate === inputs.cacheHitRate && rec.targetUtilization === inputs.targetUtilization;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), inputs, cloud, pricing: price, result }, null, 2)], { type: 'application/json' });
    download(blob, 'engflow-ci-economics.json');
  };
  const exportCsv = () => {
    const rows: [string, unknown][] = [
      ...Object.entries(inputs).map(([k, v]) => [`input.${k}`, v] as [string, unknown]),
      ['cloud.provider', cloud.provider], ['cloud.region', cloud.region], ['cloud.instanceType', cloud.instanceType],
      ['pricing.kind', price.kind], ['pricing.source', price.source ?? ''], ['pricing.fetchedAt', price.fetchedAt ?? ''],
      ...(result ? Object.entries(result).filter(([k]) => k !== 'warnings').map(([k, v]) => [`result.${k}`, v] as [string, unknown]) : []),
    ];
    const csv = 'field,value\n' + rows.map(([k, v]) => `${k},"${String(v ?? '').replace(/"/g, '""')}"`).join('\n');
    download(new Blob([csv], { type: 'text/csv' }), 'engflow-ci-economics.csv');
  };

  const isCloud = inputs.mode === 'cloud';

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* top bar */}
      <header className="no-print sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <Logo />
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={LEGACY_URL}
              data-testid="link-legacy"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#2f7457]/40 bg-[#2f7457]/8 px-3 py-1.5 text-xs font-semibold text-[#2f7457] transition-colors hover:bg-[#2f7457] hover:text-[#f5f7f4]"
            >
              <History className="h-3.5 w-3.5" /> Original 4-year calculator
            </a>
            <button onClick={exportCsv} data-testid="button-export-csv" className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button onClick={exportJson} data-testid="button-export-json" className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              <FileJson className="h-3.5 w-3.5" /> JSON
            </button>
            <button
              onClick={() => window.print()}
              data-testid="button-export-report"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#15291f] px-3 py-1.5 text-xs font-semibold text-[#f5f7f4] transition-transform hover:-translate-y-px active:translate-y-0"
            >
              <Printer className="h-3.5 w-3.5" /> Export report
            </button>
          </div>
        </div>
      </header>

      {/* print header */}
      <div className="print-only px-2 pb-4">
        <Logo />
        <p className="mt-2 text-xs">
          Scenario report{inputs.companyName ? ` for ${inputs.companyName}` : ''} — generated {new Date().toLocaleString()}. Illustrative model; not measured results.
        </p>
      </div>

      <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-6 lg:grid-cols-[380px_1fr]">
        {/* ---------- inputs ---------- */}
        <aside className="lg:sticky lg:top-[68px] lg:max-h-[calc(100dvh-84px)] lg:overflow-y-auto lg:pr-1">
          <div className="rounded-xl border border-card-border bg-card px-4 shadow-[0_1px_0_hsl(var(--border)),0_12px_32px_-24px_hsl(147_32%_12%/0.35)]">
            <Section title="Scenario" kicker="01">
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Company / team</span>
                <input
                  data-testid="input-companyName"
                  value={inputs.companyName}
                  onChange={(e) => set('companyName', e.target.value)}
                  placeholder="e.g. Halvorsen Robotics"
                  className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
              <Segmented
                testid="toggle-mode"
                value={inputs.mode}
                onChange={(v) => set('mode', v)}
                options={[
                  { v: 'cloud', l: <><Cloud className="h-3.5 w-3.5" /> Cloud CI</> },
                  { v: 'onprem', l: <><Server className="h-3.5 w-3.5" /> On-Prem CI</> },
                ]}
              />
            </Section>

            <Section title="Your build" kicker="02">
              <div className="grid grid-cols-2 gap-3">
                <NumField id="buildMinutes" label="Build time" suffix="min" value={inputs.buildMinutes} onChange={(v) => set('buildMinutes', v)} />
                <NumField id="fileCount" label="Source files" value={inputs.fileCount} onChange={(v) => set('fileCount', v)} step="1" />
              </div>
              <div>
                <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Primary language</span>
                <div className="grid grid-cols-3 gap-1">
                  {LANGS.map((l) => (
                    <button
                      key={l.v}
                      type="button"
                      data-testid={`button-lang-${l.v}`}
                      onClick={() => set('language', l.v)}
                      className={`rounded-md border px-2 py-1.5 text-[11.5px] font-semibold transition-colors ${
                        inputs.language === l.v ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-foreground/30'
                      }`}
                    >
                      {l.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-dashed border-[hsl(36_78%_52%)]/60 bg-accent/60 p-3 text-xs">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-foreground" />
                  <div className="flex-1">
                    <p className="font-semibold text-accent-foreground">Heuristic preset: {rec.label}</p>
                    <p className="num mt-1 text-[11px] text-accent-foreground/80">
                      parallel {rec.parallelFraction}% · cache {rec.cacheHitRate}% · target util {rec.targetUtilization}%
                    </p>
                    <p className="mt-1 text-[11px] text-accent-foreground/70">Illustrative estimate from language and file count only. Not a measurement of your build.</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={recApplied}
                  data-testid="button-apply-preset"
                  onClick={() => setInputs((p) => ({ ...p, parallelFraction: rec.parallelFraction, cacheHitRate: rec.cacheHitRate, targetUtilization: rec.targetUtilization }))}
                  className="mt-2 w-full rounded-md bg-accent-foreground px-2 py-1.5 text-[11.5px] font-semibold text-accent transition-opacity disabled:opacity-40"
                >
                  {recApplied ? 'Preset applied' : 'Apply illustrative estimate'}
                </button>
              </div>
            </Section>

            {isCloud ? (
              <Section title="Cloud machines" kicker="03">
                <Segmented
                  testid="toggle-provider"
                  value={cloud.provider}
                  onChange={changeProvider}
                  options={(['aws', 'azure', 'gcp'] as Provider[]).map((p) => ({ v: p, l: PROVIDER_DEFAULTS[p].label }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Region" value={cloud.region} testid="input-region" onChange={(v) => changeCloud({ region: v })} />
                  <TextField label="Instance type" value={cloud.instanceType} testid="input-instance" onChange={(v) => changeCloud({ instanceType: v })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumField id="hourlyMachineCost" label="Hourly rate" prefix="$" suffix="/hr" value={inputs.hourlyMachineCost} onChange={setRate} />
                  <NumField id="coresPerMachine" label="vCPU / machine" value={inputs.coresPerMachine} onChange={(v) => set('coresPerMachine', v)} step="1" />
                </div>
                <PriceStatus
                  provider={cloud.provider}
                  price={price}
                  error={priceError}
                  loading={priceQuery.isFetching}
                  onRefresh={refreshPrice}
                />
                <div>
                  <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Billing</span>
                  <Segmented
                    testid="toggle-billing"
                    value={inputs.billingMode}
                    onChange={(v) => set('billingMode', v)}
                    options={[{ v: 'autoscale', l: 'Autoscale (pay per use)' }, { v: 'fixed', l: 'Fixed fleet' }]}
                  />
                </div>
                <NumField id="machines" label="Machines in fleet" value={inputs.machines} onChange={(v) => set('machines', v)} step="1" hint="same for both" />
              </Section>
            ) : (
              <Section title="On-prem fleet" kicker="03">
                <div className="grid grid-cols-2 gap-3">
                  <NumField id="machines" label="Machines" value={inputs.machines} onChange={(v) => set('machines', v)} step="1" />
                  <NumField id="coresPerMachine" label="Cores / machine" value={inputs.coresPerMachine} onChange={(v) => set('coresPerMachine', v)} step="1" />
                  <NumField id="hardwareCostPerMachine" label="Hardware / machine" prefix="$" value={inputs.hardwareCostPerMachine} onChange={(v) => set('hardwareCostPerMachine', v)} />
                  <NumField id="amortizationYears" label="Amortization" suffix="yr" value={inputs.amortizationYears} onChange={(v) => set('amortizationYears', v)} />
                  <NumField id="wattsPerMachine" label="Power draw" suffix="W" value={inputs.wattsPerMachine} onChange={(v) => set('wattsPerMachine', v)} />
                  <NumField id="electricityPerKwh" label="Electricity" prefix="$" suffix="/kWh" value={inputs.electricityPerKwh} onChange={(v) => set('electricityPerKwh', v)} />
                </div>
                <NumField id="annualOpsCost" label="Annual ops cost" prefix="$" value={inputs.annualOpsCost} onChange={(v) => set('annualOpsCost', v)} />
                <p className="text-[11px] text-muted-foreground">Baseline and EngFlow scenarios use the same fleet. Owned hardware you keep is not counted as cash savings.</p>
              </Section>
            )}

            <Section title="Workload" kicker="04" defaultOpen={false}>
              <div className="grid grid-cols-2 gap-3">
                <NumField id="buildsPerDay" label="Builds / day" value={inputs.buildsPerDay} onChange={(v) => set('buildsPerDay', v)} />
                <NumField id="workingDays" label="Working days" suffix="/yr" value={inputs.workingDays} onChange={(v) => set('workingDays', v)} />
                <NumField id="hoursPerDay" label="CI hours / day" value={inputs.hoursPerDay} onChange={(v) => set('hoursPerDay', v)} />
              </div>
            </Section>

            <Section title="Performance assumptions" kicker="05" defaultOpen={false}>
              <div className="grid grid-cols-2 gap-3">
                <NumField id="baselineUtilization" label="Baseline CPU util" suffix="%" value={inputs.baselineUtilization} onChange={(v) => set('baselineUtilization', v)} />
                <NumField id="targetUtilization" label="EngFlow target util" suffix="%" value={inputs.targetUtilization} onChange={(v) => set('targetUtilization', v)} />
                <NumField id="cacheHitRate" label="Cache hit rate" suffix="%" value={inputs.cacheHitRate} onChange={(v) => set('cacheHitRate', v)} />
                <NumField id="parallelFraction" label="Parallel fraction" suffix="%" value={inputs.parallelFraction} onChange={(v) => set('parallelFraction', v)} />
              </div>
            </Section>

            <Section title="Investment" kicker="06" defaultOpen={false}>
              <div className="grid grid-cols-2 gap-3">
                <NumField id="engflowAnnualCost" label="EngFlow annual" prefix="$" value={inputs.engflowAnnualCost} onChange={(v) => set('engflowAnnualCost', v)} />
                <NumField id="implementationCost" label="Implementation" prefix="$" value={inputs.implementationCost} onChange={(v) => set('implementationCost', v)} />
              </div>
            </Section>

            <Section title="Developer time (separate)" kicker="07" defaultOpen={false}>
              <div className="grid grid-cols-2 gap-3">
                <NumField id="developers" label="Developers" value={inputs.developers} onChange={(v) => set('developers', v)} step="1" />
                <NumField id="annualSalary" label="Loaded salary" prefix="$" value={inputs.annualSalary} onChange={(v) => set('annualSalary', v)} />
                <NumField id="blockedTimePercent" label="Time blocked on CI" suffix="%" value={inputs.blockedTimePercent} onChange={(v) => set('blockedTimePercent', v)} />
              </div>
            </Section>

            <div className="no-print space-y-2 border-t border-border py-4">
              <label className="flex cursor-pointer items-start gap-2 text-[11.5px] text-muted-foreground">
                <input type="checkbox" data-testid="checkbox-persist" checked={persist} onChange={(e) => setPersist(e.target.checked)} className="mt-0.5 accent-[#2f7457]" />
                <span>Remember this scenario in this browser only (localStorage). Nothing is sent to a server.</span>
              </label>
              <button
                type="button"
                onClick={reset}
                data-testid="button-reset"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset to illustrative defaults
              </button>
            </div>
          </div>
        </aside>

        {/* ---------- results ---------- */}
        <main className="min-w-0 space-y-5">
          {errors.length > 0 || !result ? (
            <div className="rise rounded-xl border border-destructive/40 bg-destructive/5 p-6" data-testid="status-invalid">
              <div className="flex items-center gap-2 text-destructive">
                <TriangleAlert className="h-5 w-5" />
                <h2 className="font-display text-lg font-bold">Results hidden until inputs are valid</h2>
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-6 text-sm">
                {(errors.length ? errors : ['The model could not compute this scenario.']).map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          ) : (
            <Results r={result} inputs={inputs} />
          )}

          <Methodology inputs={inputs} cloud={cloud} price={price} />

          <footer className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-[11.5px] text-muted-foreground">
            <span>Illustrative model. Validate with measured build data before making commitments.</span>
            <a href={SOURCE_REPO} target="_blank" rel="noreferrer" data-testid="link-source" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              Source fork on GitHub <ArrowUpRight className="h-3 w-3" />
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function TextField({ label, value, onChange, testid }: { label: string; value: string; onChange: (v: string) => void; testid: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">{label}</span>
      <input
        data-testid={testid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="num h-9 w-full rounded-md border border-input bg-card px-2.5 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}

function PriceStatus({
  provider, price, error, loading, onRefresh,
}: { provider: Provider; price: PriceSource; error: string | null; loading: boolean; onRefresh: () => void }) {
  const manualOnly = provider === 'gcp';
  return (
    <div className="rounded-lg border border-border bg-secondary/60 p-2.5 text-[11.5px]" data-testid="status-price">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${price.kind === 'api' ? 'bg-primary' : 'bg-[hsl(36_78%_52%)]'}`} />
          <span className="font-semibold">{price.kind === 'api' ? 'API rate' : 'Manual rate'}</span>
        </span>
        {!manualOnly && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            data-testid="button-refresh-price"
            className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-1 font-semibold ring-1 ring-border transition-colors hover:ring-primary disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Fetching' : 'Refresh price'}
          </button>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">
        {manualOnly
          ? 'GCP lookups are not supported. Enter your negotiated or list rate manually.'
          : price.kind === 'api'
            ? <>
                {price.source} · fetched {price.fetchedAt ? new Date(price.fetchedAt).toLocaleString() : 'unknown'}
                {price.sourceUrl && <> · <a className="text-primary underline" href={price.sourceUrl} target="_blank" rel="noreferrer">source</a></>}
              </>
            : `${PROVIDER_DEFAULTS[provider].note}. Rate shown is user-entered until refreshed.`}
      </p>
      {error && <p className="mt-1 font-medium text-destructive" data-testid="text-price-error">Lookup failed — {error}. Manual rate still used.</p>}
    </div>
  );
}

/* ---------- results ---------- */

function Results({ r, inputs }: { r: EconomicsResult; inputs: CIInputs }) {
  const roiNeg = fin(r.hardRoiPercent) && (r.hardRoiPercent as number) < 0;
  const netNeg = r.netAnnualCashSavings < 0;
  return (
    <div className="space-y-5">
      {/* hero */}
      <section className="rise print-break relative overflow-hidden rounded-2xl bg-[#15291f] p-6 text-[#f5f7f4] md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#2f7457]/40 blur-3xl" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f5f7f4]/60">
          {inputs.mode === 'cloud' ? 'Cloud CI' : 'On-prem CI'} · {inputs.companyName || 'Illustrative scenario'}
        </p>
        <div className="relative mt-4 grid gap-6 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <p className="text-xs text-[#f5f7f4]/60">Net annual cash savings (hard)</p>
            <p className={`num mt-1 text-4xl font-semibold tracking-tight md:text-5xl ${netNeg ? 'text-[#f0a29a]' : 'text-[#9fe0bf]'}`} data-testid="text-net-savings">
              {money(r.netAnnualCashSavings)}
            </p>
            <p className="mt-1 text-xs text-[#f5f7f4]/60">First year incl. implementation: <span className="num">{money(r.firstYearNetCashSavings)}</span></p>
          </div>
          <div>
            <p className="text-xs text-[#f5f7f4]/60">Hard ROI</p>
            <p className={`num mt-1 text-3xl font-semibold ${roiNeg ? 'text-[#f0a29a]' : ''}`} data-testid="text-roi">
              {fin(r.hardRoiPercent) ? pct(r.hardRoiPercent) : 'n/a'}
            </p>
            <p className="mt-1 text-xs text-[#f5f7f4]/60">{fin(r.hardRoiPercent) ? 'Excludes productivity' : 'Not defined for this scenario'}</p>
          </div>
          <div>
            <p className="text-xs text-[#f5f7f4]/60">Payback</p>
            <p className="num mt-1 text-3xl font-semibold" data-testid="text-payback">
              {fin(r.paybackMonths) ? `${n1.format(r.paybackMonths as number)} mo` : 'None'}
            </p>
            <p className="mt-1 text-xs text-[#f5f7f4]/60">{fin(r.paybackMonths) ? 'On cash savings only' : 'Cash savings do not recover cost'}</p>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-[#f5f7f4]/10 md:grid-cols-4">
          {[
            ['Build time', `${n1.format(inputs.buildMinutes)} → ${n1.format(r.engflowBuildMinutes)} min`],
            ['Speedup', `${n1.format(r.speedup)}×`],
            ['Compute work cut', pct(r.workReductionPercent)],
            ['Extra builds / day', num(r.additionalBuildsPerDay)],
          ].map(([k, v]) => (
            <div key={k} className="bg-[#15291f] p-3">
              <p className="text-[10.5px] uppercase tracking-wider text-[#f5f7f4]/50">{k}</p>
              <p className="num mt-0.5 text-sm font-medium">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {r.warnings.length > 0 && (
        <div className="rise rounded-xl border border-[hsl(36_78%_52%)]/50 bg-accent/50 p-4 text-sm text-accent-foreground" data-testid="status-warnings">
          <p className="flex items-center gap-1.5 font-semibold"><TriangleAlert className="h-4 w-4" /> Model warnings</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-6 text-[13px]">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {/* infra */}
        <Card title="Infrastructure cost, matched workload" sub={`${num(r.comparedBuildsPerYear)} builds/yr compared on both sides`}>
          <CostBars a={r.baselineAnnualInfrastructure} b={r.engflowAnnualInfrastructure} />
          <Rows
            rows={[
              ['Baseline infrastructure / yr', money(r.baselineAnnualInfrastructure)],
              ['With EngFlow infrastructure / yr', money(r.engflowAnnualInfrastructure)],
              ['Gross infrastructure savings', money(r.grossInfrastructureSavings)],
              ['EngFlow annual cost', `− ${money(inputs.engflowAnnualCost)}`],
              ['Net annual cash savings', money(r.netAnnualCashSavings), true],
            ]}
          />
        </Card>

        {/* capacity */}
        <Card title="Fixed-fleet capacity" sub={`${num(inputs.machines)} machines × ${num(inputs.coresPerMachine)} cores, identical in both`}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Baseline capacity" value={`${num(r.baselineCapacityPerDay)}`} unit="builds/day" />
            <Stat label="EngFlow capacity" value={`${num(r.engflowCapacityPerDay)}`} unit="builds/day" accent />
          </div>
          <Rows
            rows={[
              ['Requested builds / yr', num(r.requestedBuildsPerYear)],
              ['Compared builds / yr', num(r.comparedBuildsPerYear)],
              ['Additional builds / day', num(r.additionalBuildsPerDay)],
            ]}
          />
        </Card>

        {/* utilization */}
        <Card title="Core utilization" sub="Modeled active-build utilization at full fleet occupancy; not a measured time-series">
          <UtilBar label="Baseline" util={r.baselineCpuUtilization} busy={r.baselineBusyCores} idle={r.baselineIdleCores} />
          <UtilBar label="EngFlow" util={r.engflowCpuUtilization} busy={r.engflowBusyCores} idle={r.engflowIdleCores} accent />
          <Rows
            rows={[
              ['Baseline core-hours (work)', num(r.baselineCoreHours)],
              ['EngFlow core-hours (work)', num(r.engflowCoreHours)],
              ['Baseline allocated core-hours', num(r.baselineAllocatedCoreHours)],
              ['EngFlow allocated core-hours', num(r.engflowAllocatedCoreHours)],
            ]}
          />
        </Card>

        {/* productivity */}
        <Card title="Recovery opportunity" sub="Not cash. Not added to ROI. Shown separately on purpose." tone="soft">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Developer hours recovered" value={num(r.developerHoursRecovered)} unit="hrs/yr" />
            <Stat label="Notional value" value={money(r.productivityValue)} unit="salary-equivalent" />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            Assumes one developer blocked for {pct(inputs.blockedTimePercent)} of each matched build, capped at {num(inputs.developers)} developers' annual working hours. Recovered time only has value if redeployed; it is not payroll savings.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, sub, children, tone }: { title: string; sub?: string; children: ReactNode; tone?: 'soft' }) {
  return (
    <section className={`rise print-break rounded-xl border p-5 ${tone === 'soft' ? 'border-dashed border-border bg-secondary/40' : 'border-card-border bg-card'}`}>
      <h3 className="font-display text-[15px] font-bold">{title}</h3>
      {sub && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: [string, string, boolean?][] }) {
  return (
    <dl className="mt-4 divide-y divide-border text-[13px]">
      {rows.map(([k, v, strong]) => (
        <div key={k} className="flex items-center justify-between py-1.5">
          <dt className={strong ? 'font-semibold' : 'text-muted-foreground'}>{k}</dt>
          <dd className={`num ${strong ? 'font-semibold' : ''}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Stat({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${accent ? 'bg-primary/10' : 'bg-secondary'}`}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`num mt-0.5 text-xl font-semibold ${accent ? 'text-primary' : ''}`}>{value}</p>
      <p className="text-[10.5px] text-muted-foreground">{unit}</p>
    </div>
  );
}

function CostBars({ a, b }: { a: number; b: number }) {
  const max = Math.max(a, b, 1);
  return (
    <div className="space-y-2">
      {[['Baseline', a, 'bg-[#15291f]'], ['EngFlow', b, 'bg-[#2f7457]']].map(([l, v, c]) => (
        <div key={l as string} className="flex items-center gap-3 text-[11.5px]">
          <span className="w-16 text-muted-foreground">{l}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary">
            <div className={`h-full origin-left rounded-full ${c} transition-transform duration-500`} style={{ width: '100%', transform: `scaleX(${Math.max(0, (v as number) / max)})` }} />
          </div>
          <span className="num w-24 text-right">{money(v as number)}</span>
        </div>
      ))}
    </div>
  );
}

function UtilBar({ label, util, busy, idle, accent }: { label: string; util: number; busy: number; idle: number; accent?: boolean }) {
  const u = Math.min(100, Math.max(0, util));
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-[11.5px]">
        <span className="font-semibold">{label}</span>
        <span className="num text-muted-foreground">{pct(util)} · {num(busy, n1)} busy / {num(idle, n1)} idle cores</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[repeating-linear-gradient(135deg,hsl(var(--secondary))_0_4px,hsl(var(--border))_4px_5px)]">
        <div className={`h-full origin-left rounded-full transition-transform duration-500 ${accent ? 'bg-[#2f7457]' : 'bg-[#15291f]'}`} style={{ width: '100%', transform: `scaleX(${u / 100})` }} />
      </div>
    </div>
  );
}

function Methodology({ inputs, cloud, price }: { inputs: CIInputs; cloud: Cloud; price: PriceSource }) {
  return (
    <section className="print-break rounded-xl border border-card-border bg-card p-5" data-testid="section-methodology">
      <h3 className="flex items-center gap-1.5 font-display text-[15px] font-bold"><Info className="h-4 w-4 text-primary" /> Assumptions & methodology</h3>
      <div className="mt-3 grid gap-4 text-[12.5px] leading-relaxed text-muted-foreground md:grid-cols-2">
        <div className="space-y-2">
          <p><strong className="text-foreground">Heuristic, not measured.</strong> Cache hit rate, parallel fraction and target utilization are assumptions. Language and file-count presets are illustrative estimates only and are not sufficient to verify hard ROI. No benchmark from any specific customer is implied.</p>
          <p><strong className="text-foreground">Matched workload.</strong> Infrastructure costs compare the same number of builds per year on both sides, so savings come from doing less compute per build, not from doing fewer builds.</p>
          <p><strong className="text-foreground">Fixed-size capacity.</strong> Baseline and EngFlow use the identical fleet and core count. Faster builds show up as additional finite throughput, not as fewer machines. On-prem hardware you keep is not cash saved.</p>
          <p><strong className="text-foreground">First-year hard ROI</strong> = (gross infrastructure savings − annual EngFlow cost − implementation cost) ÷ (annual EngFlow cost + implementation cost). Payback = implementation cost ÷ recurring net cash savings, in months; none when recurring savings are non-positive. Developer productivity is excluded.</p>
          <p><strong className="text-foreground">Performance formula.</strong> Time ratio = (1 − parallel share) + parallel share × (1 − cache hit rate) × baseline utilization ÷ target utilization. The target is an editable assumption; achieved overall utilization also includes the unchanged serial share. One build occupies one machine. No CPU trace or verified speedup is inferred from source-file count.</p>
        </div>
        <div>
          <p className="mb-1.5 font-semibold text-foreground">Inputs and pricing provenance</p>
          <dl className="num grid grid-cols-2 gap-x-4 text-[11.5px]">
            {inputs.mode === 'cloud' && (
              <>
                <dt>provider / region</dt><dd>{cloud.provider} / {cloud.region}</dd>
                <dt>instance</dt><dd>{cloud.instanceType}</dd>
                <dt>rate source</dt><dd>{price.kind === 'api' ? `${price.source ?? 'API'} @ ${price.fetchedAt ?? '?'}` : 'manual entry'}</dd>
              </>
            )}
            {Object.entries(inputs).filter(([k]) => k !== 'companyName').map(([k, v]) => (
              <div key={k} className="contents"><dt className="truncate">{k}</dt><dd>{String(v)}</dd></div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
