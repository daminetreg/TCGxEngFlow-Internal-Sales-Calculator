import { calculate4YearImpact } from "./roiCalculator.js";

const form = document.querySelector("#calculator-form");
const fundingStageInput = document.querySelector("#funding-stage");
const headcountLowInput = document.querySelector("#headcount-low");
const headcountHighInput = document.querySelector("#headcount-high");
const salaryInput = document.querySelector("#salary");
const errorMessage = document.querySelector("#form-error");
const yearList = document.querySelector("#year-list");
const summaryAmount = document.querySelector("#summary-amount");
const summaryRange = document.querySelector("#summary-range");
const summaryTeam = document.querySelector("#summary-team");

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("en-US");

function formatCurrency(value) {
  return currencyFormatter.format(value);
}

function renderProjection() {
  const headcountLow = Number(headcountLowInput.value);
  const headcountHigh = Number(headcountHighInput.value);
  const salary = Number(salaryInput.value);

  errorMessage.hidden = true;
  errorMessage.textContent = "";
  yearList.replaceChildren();

  if (
    !form.checkValidity() ||
    !Number.isFinite(headcountLow) ||
    !Number.isFinite(headcountHigh) ||
    !Number.isFinite(salary) ||
    headcountLow > headcountHigh
  ) {
    errorMessage.textContent =
      headcountLow > headcountHigh
        ? "The low headcount must be less than or equal to the high headcount."
        : "Enter valid positive numbers for headcount and salary.";
    errorMessage.hidden = false;
    return;
  }

  const projection = calculate4YearImpact(
    fundingStageInput.value,
    headcountLow,
    headcountHigh,
    salary,
  );
  const yearFour = projection.at(-1);
  const highYearFourLoss = yearFour.annualProductivityLossUSD.high;
  const chartMaximum = Math.max(
    ...projection.map((year) => year.annualProductivityLossUSD.high),
    1,
  );

  summaryAmount.textContent = formatCurrency(highYearFourLoss);
  summaryRange.textContent =
    `${formatCurrency(yearFour.annualProductivityLossUSD.low)} – ` +
    `${formatCurrency(highYearFourLoss)} estimated annual loss`;
  summaryTeam.textContent =
    `${numberFormatter.format(yearFour.headcount.low)}–` +
    `${numberFormatter.format(yearFour.headcount.high)} developers`;

  projection.forEach((year) => {
    const row = document.createElement("article");
    row.className = "year-row";

    const label = document.createElement("div");
    label.className = "year-label";
    const yearName = document.createElement("span");
    yearName.textContent = year.year;
    const teamSize = document.createElement("span");
    teamSize.className = "year-team";
    teamSize.textContent =
      `${numberFormatter.format(year.headcount.low)}–` +
      `${numberFormatter.format(year.headcount.high)} devs`;
    label.append(yearName, teamSize);

    const bars = document.createElement("div");
    bars.className = "bar-stack";
    for (const [type, value] of [
      ["low", year.annualProductivityLossUSD.low],
      ["high", year.annualProductivityLossUSD.high],
    ]) {
      const bar = document.createElement("div");
      bar.className = `loss-bar loss-bar-${type}`;
      bar.style.width = `${Math.max((value / chartMaximum) * 100, 1)}%`;
      bar.setAttribute(
        "aria-label",
        `${type} estimate: ${formatCurrency(value)} annual productivity loss`,
      );
      bars.append(bar);
    }

    const values = document.createElement("div");
    values.className = "year-values";
    for (const value of [
      year.annualProductivityLossUSD.low,
      year.annualProductivityLossUSD.high,
    ]) {
      const estimate = document.createElement("span");
      estimate.textContent = formatCurrency(value);
      values.append(estimate);
    }

    row.append(label, bars, values);
    yearList.append(row);
  });
}

form.addEventListener("input", renderProjection);
form.addEventListener("change", renderProjection);
renderProjection();
