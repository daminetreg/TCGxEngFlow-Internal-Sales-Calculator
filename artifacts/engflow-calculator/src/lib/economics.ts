/**
 * Equal-fleet, equal-completed-workload CI scenario model.
 * No measured EngFlow benchmark data is implied by these assumptions.
 */
export type CIInputs = {
  mode: "cloud" | "onprem";
  companyName: string;
  buildMinutes: number;
  fileCount: number;
  language: "cpp" | "java" | "rust" | "go" | "typescript" | "other";
  buildsPerDay: number;
  workingDays: number;
  hoursPerDay: number;
  machines: number;
  coresPerMachine: number;
  baselineUtilization: number;
  targetUtilization: number;
  cacheHitRate: number;
  parallelFraction: number;
  engflowAnnualCost: number;
  implementationCost: number;
  hourlyMachineCost: number;
  billingMode: "autoscale" | "fixed";
  hardwareCostPerMachine: number;
  amortizationYears: number;
  wattsPerMachine: number;
  electricityPerKwh: number;
  annualOpsCost: number;
  developers: number;
  annualSalary: number;
  blockedTimePercent: number;
};

export const DEFAULT_INPUTS: CIInputs = {
  mode: "cloud",
  companyName: "",
  buildMinutes: 30,
  fileCount: 50000,
  language: "cpp",
  buildsPerDay: 400,
  workingDays: 252,
  hoursPerDay: 12,
  machines: 32,
  coresPerMachine: 8,
  baselineUtilization: 35,
  targetUtilization: 75,
  cacheHitRate: 45,
  parallelFraction: 85,
  engflowAnnualCost: 6000,
  implementationCost: 2000,
  hourlyMachineCost: 0.34,
  billingMode: "autoscale",
  hardwareCostPerMachine: 6000,
  amortizationYears: 4,
  wattsPerMachine: 300,
  electricityPerKwh: 0.18,
  annualOpsCost: 10000,
  developers: 100,
  annualSalary: 180000,
  blockedTimePercent: 25,
};

/** Illustrative starting points, not empirical language-specific speedup claims. */
export function recommendPerformance(language: CIInputs["language"], fileCount: number) {
  const base = { cpp: 75, java: 70, rust: 65, go: 65, typescript: 55, other: 50 }[language];
  const sizeAdjustment = Math.min(10, Math.max(-20, Math.log10(Math.max(1, fileCount) / 1000) * 5));
  return {
    parallelFraction: Math.round(Math.min(90, Math.max(20, base + sizeAdjustment))),
    cacheHitRate: 45,
    targetUtilization: 75,
    label: "Illustrative heuristic — validate with a representative build trace and EngFlow pilot.",
  };
}

export function validateInputs(i: CIInputs): string[] {
  const errors: string[] = [];
  const bounds: [keyof CIInputs, number, number, boolean][] = [
    ["buildMinutes", 0.01, 1440, false], ["fileCount", 1, 1e9, true],
    ["buildsPerDay", 0, 1e9, true], ["workingDays", 1, 366, true],
    ["hoursPerDay", 0.1, 24, false], ["machines", 1, 100000, true],
    ["coresPerMachine", 1, 4096, true], ["baselineUtilization", 1, 100, false],
    ["targetUtilization", 1, 100, false], ["cacheHitRate", 0, 99, false],
    ["parallelFraction", 0, 99, false], ["engflowAnnualCost", 0, 1e12, false],
    ["implementationCost", 0, 1e12, false], ["hourlyMachineCost", 0, 1e6, false],
    ["hardwareCostPerMachine", 0, 1e9, false], ["amortizationYears", 1, 30, false],
    ["wattsPerMachine", 0, 100000, false], ["electricityPerKwh", 0, 1000, false],
    ["annualOpsCost", 0, 1e12, false], ["developers", 1, 1e6, true],
    ["annualSalary", 0, 1e8, false], ["blockedTimePercent", 0, 100, false],
  ];
  for (const [key, min, max, integer] of bounds) {
    const v = i[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) {
      const label = key.replace(/([A-Z])/g, " $1").toLowerCase();
      errors.push(`${label}: enter ${integer ? "a whole number" : "a number"} between ${min} and ${max}.`);
    }
  }
  if (!["cloud", "onprem"].includes(i.mode)) errors.push("Choose cloud or on-prem CI.");
  if (!["autoscale", "fixed"].includes(i.billingMode)) errors.push("Choose a supported cloud billing mode.");
  if (!["cpp", "java", "rust", "go", "typescript", "other"].includes(i.language)) errors.push("Choose a supported language.");
  return errors;
}

export interface EconomicsResult {
  timeRatio: number;
  engflowBuildMinutes: number;
  speedup: number;
  baselineCpuUtilization: number;
  engflowCpuUtilization: number;
  baselineCapacityPerDay: number;
  engflowCapacityPerDay: number;
  additionalBuildsPerDay: number;
  comparedBuildsPerYear: number;
  requestedBuildsPerYear: number;
  baselineAnnualInfrastructure: number;
  engflowAnnualInfrastructure: number;
  grossInfrastructureSavings: number;
  netAnnualCashSavings: number;
  firstYearNetCashSavings: number;
  hardRoiPercent: number | null;
  paybackMonths: number | null;
  developerHoursRecovered: number;
  productivityValue: number;
  baselineCoreHours: number;
  engflowCoreHours: number;
  baselineAllocatedCoreHours: number;
  engflowAllocatedCoreHours: number;
  baselineBusyCores: number;
  engflowBusyCores: number;
  baselineIdleCores: number;
  engflowIdleCores: number;
  workReductionPercent: number;
  warnings: string[];
}

export function calculateEconomics(i: CIInputs): EconomicsResult {
  const errors = validateInputs(i);
  if (errors.length) throw new Error(errors.join(" "));
  const u0 = i.baselineUtilization / 100;
  const u1 = i.targetUtilization / 100;
  const p = i.parallelFraction / 100;
  const hit = i.cacheHitRate / 100;
  // Amdahl-style serial share remains unchanged. Only parallel/cacheable work
  // is reduced; higher active utilization packs remaining work onto the SAME fleet.
  const timeRatio = 1 - p + p * (1 - hit) * u0 / u1;
  const workFactor = 1 - p * hit;
  const engflowBuildMinutes = i.buildMinutes * timeRatio;
  const baselineCapacityPerDay = Math.floor(i.hoursPerDay * 60 / i.buildMinutes) * i.machines;
  const engflowCapacityPerDay = Math.floor(i.hoursPerDay * 60 / engflowBuildMinutes) * i.machines;
  // One representative build occupies one machine. Compare identical completed
  // work, not unlimited demand or different fleet sizes.
  const dailyMatched = Math.min(i.buildsPerDay, baselineCapacityPerDay, engflowCapacityPerDay);
  const comparedBuildsPerYear = dailyMatched * i.workingDays;
  const baselineRunnerHours = comparedBuildsPerYear * i.buildMinutes / 60;
  const engflowRunnerHours = baselineRunnerHours * timeRatio;
  const fixedFleetHours = i.machines * i.hoursPerDay * i.workingDays;
  let baselineAnnualInfrastructure: number;
  let engflowAnnualInfrastructure: number;
  if (i.mode === "cloud") {
    baselineAnnualInfrastructure = (i.billingMode === "autoscale" ? baselineRunnerHours : fixedFleetHours) * i.hourlyMachineCost;
    engflowAnnualInfrastructure = (i.billingMode === "autoscale" ? engflowRunnerHours : fixedFleetHours) * i.hourlyMachineCost;
  } else {
    const depreciation = i.hardwareCostPerMachine * i.machines / i.amortizationYears;
    const electricity = fixedFleetHours * i.wattsPerMachine / 1000 * i.electricityPerKwh;
    // Fixed hardware and identical powered-on windows are NOT avoided cash spend.
    baselineAnnualInfrastructure = depreciation + electricity + i.annualOpsCost;
    engflowAnnualInfrastructure = baselineAnnualInfrastructure;
  }
  const grossInfrastructureSavings = baselineAnnualInfrastructure - engflowAnnualInfrastructure;
  const netAnnualCashSavings = grossInfrastructureSavings - i.engflowAnnualCost;
  const firstYearNetCashSavings = netAnnualCashSavings - i.implementationCost;
  const investment = i.engflowAnnualCost + i.implementationCost;
  const hardRoiPercent = investment > 0 ? firstYearNetCashSavings / investment * 100 : null;
  const paybackMonths = netAnnualCashSavings > 0 ? i.implementationCost / netAnnualCashSavings * 12 : null;
  const rawRecoveredHours = Math.max(0, baselineRunnerHours - engflowRunnerHours) * i.blockedTimePercent / 100;
  const developerHoursRecovered = Math.min(rawRecoveredHours, i.developers * 2000);
  const productivityValue = developerHoursRecovered * i.annualSalary / 2000;
  const baselineAllocatedCoreHours = baselineRunnerHours * i.coresPerMachine;
  const engflowAllocatedCoreHours = engflowRunnerHours * i.coresPerMachine;
  const baselineCoreHours = baselineAllocatedCoreHours * u0;
  const engflowCoreHours = baselineCoreHours * workFactor;
  const engU = u0 * workFactor / timeRatio;
  const fleetCores = i.machines * i.coresPerMachine;
  const warnings = [
    "Performance is modeled, not measured. Language and file count cannot establish hard ROI; validate utilization, cache reuse and parallelizable share with a representative pilot.",
    "One representative build occupies one machine. Assumes homogeneous work, no queueing, network, cache storage, egress, CI platform charges, or scheduling overhead; include those costs in your quote.",
    "Developer-time value is an opportunity estimate, not payroll savings, and is excluded from hard ROI. Assumes one blocked developer per build and caps recovered hours at team working hours.",
  ];
  if (dailyMatched < i.buildsPerDay) warnings.push(`Demand exceeds modeled capacity: costs compare ${dailyMatched.toLocaleString()} matched builds/day, not the full ${i.buildsPerDay.toLocaleString()} requested. Enlarge the fleet or extend its operating window.`);
  if (i.mode === "onprem") warnings.push("On-prem total includes annualized hardware cost, power and operations. The same hardware stays powered on: no hardware, power or operations cash savings are claimed. Added throughput is capacity, not cash ROI.");
  if (i.mode === "cloud" && i.billingMode === "fixed") warnings.push("Fixed-fleet billing keeps infrastructure spending unchanged. Faster builds create headroom, not avoided compute charges.");
  if (i.mode === "cloud") warnings.push("Cloud savings assume the same machine rate and workload in both scenarios. Autoscale only counts billable build time, without idle buffers, minimum billing increments or discounts.");
  return {
    timeRatio, engflowBuildMinutes, speedup: 1 / timeRatio,
    baselineCpuUtilization: i.baselineUtilization, engflowCpuUtilization: engU * 100,
    baselineCapacityPerDay, engflowCapacityPerDay,
    additionalBuildsPerDay: engflowCapacityPerDay - baselineCapacityPerDay,
    comparedBuildsPerYear, requestedBuildsPerYear: i.buildsPerDay * i.workingDays,
    baselineAnnualInfrastructure, engflowAnnualInfrastructure, grossInfrastructureSavings,
    netAnnualCashSavings, firstYearNetCashSavings, hardRoiPercent, paybackMonths,
    developerHoursRecovered, productivityValue, baselineCoreHours, engflowCoreHours,
    baselineAllocatedCoreHours, engflowAllocatedCoreHours,
    baselineBusyCores: fleetCores * u0, engflowBusyCores: fleetCores * engU,
    baselineIdleCores: fleetCores * (1 - u0), engflowIdleCores: fleetCores * (1 - engU),
    workReductionPercent: (1 - workFactor) * 100,
    warnings,
  };
}
