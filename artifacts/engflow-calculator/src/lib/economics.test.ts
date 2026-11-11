import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateEconomics, DEFAULT_INPUTS, validateInputs, recommendPerformance } from "./economics.ts";

test("identical performance has no infrastructure savings", () => {
  const r = calculateEconomics({ ...DEFAULT_INPUTS, cacheHitRate: 0, targetUtilization: 35 });
  assert.equal(r.timeRatio, 1);
  assert.equal(r.grossInfrastructureSavings, 0);
  assert.equal(r.netAnnualCashSavings, -DEFAULT_INPUTS.engflowAnnualCost);
  assert.equal(r.paybackMonths, null);
});
test("cloud autoscale compares the same completed builds at the same rate", () => {
  const r = calculateEconomics(DEFAULT_INPUTS);
  assert.equal(r.comparedBuildsPerYear, 400 * 252);
  assert.equal(r.baselineAnnualInfrastructure, 400 * 252 * 0.5 * 0.34);
  assert.ok(Math.abs(r.engflowAnnualInfrastructure - r.baselineAnnualInfrastructure * r.timeRatio) < 1e-8);
  assert.equal(r.netAnnualCashSavings, r.grossInfrastructureSavings - 6000);
  assert.equal(r.firstYearNetCashSavings, r.netAnnualCashSavings - 2000);
  assert.equal(r.hardRoiPercent, r.firstYearNetCashSavings / 8000 * 100);
});
test("fixed cloud fleet and on-prem never claim capacity as avoided spending", () => {
  for (const input of [{ ...DEFAULT_INPUTS, billingMode: "fixed" as const }, { ...DEFAULT_INPUTS, mode: "onprem" as const }]) {
    const r = calculateEconomics(input);
    assert.equal(r.baselineAnnualInfrastructure, r.engflowAnnualInfrastructure);
    assert.equal(r.grossInfrastructureSavings, 0);
    assert.equal(r.netAnnualCashSavings, -6000);
    assert.ok(r.engflowCapacityPerDay > r.baselineCapacityPerDay);
    assert.ok(r.engflowCpuUtilization > r.baselineCpuUtilization);
    assert.equal(r.paybackMonths, null);
  }
});
test("finite fleet caps matched workload rather than promising unlimited savings", () => {
  const r = calculateEconomics({ ...DEFAULT_INPUTS, buildsPerDay: 100000 });
  assert.equal(r.comparedBuildsPerYear, r.baselineCapacityPerDay * 252);
  assert.ok(r.warnings.some(x => x.includes("Demand exceeds")));
});
test("CPU hours, allocation and utilization remain dimensionally consistent", () => {
  const r = calculateEconomics(DEFAULT_INPUTS);
  assert.ok(Math.abs(r.engflowCoreHours / r.engflowAllocatedCoreHours * 100 - r.engflowCpuUtilization) < 1e-8);
  assert.ok(r.engflowCpuUtilization <= 100);
  assert.equal(r.baselineBusyCores + r.baselineIdleCores, DEFAULT_INPUTS.machines * DEFAULT_INPUTS.coresPerMachine);
});
test("zero workload and zero investment produce no NaN or infinite ROI", () => {
  const r = calculateEconomics({ ...DEFAULT_INPUTS, buildsPerDay: 0, engflowAnnualCost: 0, implementationCost: 0 });
  assert.equal(r.hardRoiPercent, null);
  assert.equal(r.paybackMonths, null);
  assert.equal(r.baselineAnnualInfrastructure, 0);
  assert.equal(r.productivityValue, 0);
  assert.ok(Object.values(r).every(v => typeof v !== "number" || Number.isFinite(v)));
});
test("invalid, blank and fractional counts cannot produce misleading estimates", () => {
  for (const input of [
    { ...DEFAULT_INPUTS, buildMinutes: NaN },
    { ...DEFAULT_INPUTS, machines: 0 },
    { ...DEFAULT_INPUTS, baselineUtilization: 0 },
    { ...DEFAULT_INPUTS, fileCount: 0 },
    { ...DEFAULT_INPUTS, buildsPerDay: 1.5 },
    { ...DEFAULT_INPUTS, engflowAnnualCost: -1 },
  ]) {
    assert.ok(validateInputs(input).length > 0);
    assert.throws(() => calculateEconomics(input));
  }
});
test("the serial share prevents unbounded performance and heuristics remain explicit", () => {
  const r = calculateEconomics({ ...DEFAULT_INPUTS, parallelFraction: 0, cacheHitRate: 99 });
  assert.equal(r.timeRatio, 1);
  assert.equal(r.workReductionPercent, 0);
  assert.match(recommendPerformance("cpp", 50000).label, /Illustrative/);
});
