/**
 * EngFlow 4-Year ROI & Developer Friction Calculator Engine
 * 
 * Client-side calculation engine predicting developer productivity drag,
 * CI feedback loop friction, and monetized productivity loss across a 4-year horizon.
 */

/**
 * Empirical YoY Growth Rates Derived from OLS Regression Model 1 (R² = 0.1214, p = 0.00214)
 * - Baseline Intercept (Series A & B): 40.174%
 * - Series C & D: 40.174% - 21.716% = 18.458%
 * - Late Stage & Public: 40.174% - 27.350% = 12.824%
 */
export const FUNDING_STAGE_GROWTH_RATES = {
  "Series A & B": 40.174,
  "Series C & D": 18.458,
  "Late Stage & Public": 12.824,
};

// Fixed Operational Constants
export const DEFAULTS = {
  DAILY_PRS_PER_DEV: 3,
  AI_PR_MULTIPLIER: 1.25, // AI code gen multiplier (e.g., GitHub Copilot, Cursor)
  WORKING_DAYS_PER_YEAR: 252,
  WORKING_HOURS_PER_YEAR: 2000,
  DEFAULT_SALARY_USD: 180000,
  BASE_BUILD_MINS: 5,
  BUILD_LATENCY_SCALE_FACTOR: 1.5, // Added mins per 1,000 interaction vectors
  CONTEXT_PENALTY_THRESHOLD_MINS: 15,
  HIGH_CONTEXT_DRAG_MINS: 15, // Refocus penalty if build > 15 mins
  LOW_CONTEXT_DRAG_MINS: 5,  // Refocus penalty if build <= 15 mins
};

/**
 * Calculates friction metrics for a single headcount point N
 * 
 * @param {number} headcount - Active engineering headcount (N)
 * @param {number} avgSalary - Fully loaded developer annual salary in USD
 * @param {Object} [customOptions] - Optional overrides for operational defaults
 * @returns {Object} Metric calculations for a single headcount
 */
export function calculateSingleHeadcountMetrics(headcount, avgSalary = DEFAULTS.DEFAULT_SALARY_USD, customOptions = {}) {
  const opts = { ...DEFAULTS, ...customOptions };
  
  const N = Math.round(headcount);
  
  // Quadratic Dependency Interaction Graph: V = N * (N - 1) / 2
  const V = (N * (N - 1)) / 2;
  
  // Base CI Build Time (minutes)
  const baseBuildMins = opts.BASE_BUILD_MINS + (V / 1000) * opts.BUILD_LATENCY_SCALE_FACTOR;
  
  // Cognitive Context Switching Drag (minutes)
  const contextDragMins = baseBuildMins > opts.CONTEXT_PENALTY_THRESHOLD_MINS 
    ? opts.HIGH_CONTEXT_DRAG_MINS 
    : opts.LOW_CONTEXT_DRAG_MINS;
    
  const totalWaitPerPrMins = baseBuildMins + contextDragMins;
  
  // Daily lost wait hours per developer
  const dailyWaitHrsPerDev = (opts.DAILY_PRS_PER_DEV * opts.AI_PR_MULTIPLIER * totalWaitPerPrMins) / 60;
  
  // Annual team lost hours
  const annualTeamLostHrs = N * dailyWaitHrsPerDev * opts.WORKING_DAYS_PER_YEAR;
  
  // Hourly wage rate
  const hourlyWage = avgSalary / opts.WORKING_HOURS_PER_YEAR;
  
  // Monetized Annual Productivity Loss ($USD)
  const annualProductivityLossUSD = annualTeamLostHrs * hourlyWage;

  return {
    headcount: N,
    interactionVectors: Math.round(V),
    baseBuildMins: Number(baseBuildMins.toFixed(2)),
    contextDragMins,
    totalWaitPerPrMins: Number(totalWaitPerPrMins.toFixed(2)),
    dailyWaitHoursPerDev: Number(dailyWaitHrsPerDev.toFixed(2)),
    annualTeamLostHours: Math.round(annualTeamLostHrs),
    annualProductivityLossUSD: Math.round(annualProductivityLossUSD),
  };
}

/**
 * Calculates 4-Year Bounded Range Projections
 * 
 * @param {string} fundingStage - "Series A & B", "Series C & D", or "Late Stage & Public"
 * @param {number} headcountLow - Low bound starting active engineering headcount
 * @param {number} headcountHigh - High bound starting active engineering headcount
 * @param {number} [avgSalary=180000] - Fully loaded developer salary ($USD)
 * @param {Object} [customOptions] - Optional operational constant overrides
 * @returns {Array<Object>} 4-Year projection data array
 */
export function calculate4YearImpact(
  fundingStage,
  headcountLow,
  headcountHigh,
  avgSalary = DEFAULTS.DEFAULT_SALARY_USD,
  customOptions = {}
) {
  const predictedGrowthPct = FUNDING_STAGE_GROWTH_RATES[fundingStage] ?? FUNDING_STAGE_GROWTH_RATES["Series C & D"];
  const growthRate = predictedGrowthPct / 100;

  const projection = [];
  let currentHcLow = headcountLow;
  let currentHcHigh = headcountHigh;

  for (let yr = 1; yr <= 4; yr++) {
    if (yr > 1) {
      currentHcLow *= (1 + growthRate);
      currentHcHigh *= (1 + growthRate);
    }

    const lowMetrics = calculateSingleHeadcountMetrics(currentHcLow, avgSalary, customOptions);
    const highMetrics = calculateSingleHeadcountMetrics(currentHcHigh, avgSalary, customOptions);

    projection.push({
      year: `Year ${yr}`,
      fundingStage,
      predictedYoYGrowthPct: Number(predictedGrowthPct.toFixed(2)),
      headcount: {
        low: lowMetrics.headcount,
        high: highMetrics.headcount,
      },
      interactionVectors: {
        low: lowMetrics.interactionVectors,
        high: highMetrics.interactionVectors,
      },
      dailyWaitHoursPerDev: {
        low: lowMetrics.dailyWaitHoursPerDev,
        high: highMetrics.dailyWaitHoursPerDev,
      },
      annualTeamLostHours: {
        low: lowMetrics.annualTeamLostHours,
        high: highMetrics.annualTeamLostHours,
      },
      annualProductivityLossUSD: {
        low: lowMetrics.annualProductivityLossUSD,
        high: highMetrics.annualProductivityLossUSD,
      },
    });
  }

  return projection;
}