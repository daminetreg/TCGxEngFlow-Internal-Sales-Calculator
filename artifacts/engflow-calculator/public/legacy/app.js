import { calculate4YearImpact } from "./roiCalculator.js";
import { downloadExecutiveBriefing } from "./pitchDeck.js";

const React = window.React;
const { useState } = React;
const { createRoot } = window.ReactDOM;
const h = React.createElement;
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("en-US");

function formatCurrency(value) {
  return currencyFormatter.format(value);
}

function getValidationError(inputs) {
  const low = Number(inputs.headcountLow);
  const high = Number(inputs.headcountHigh);
  const salary = Number(inputs.salary);

  if (
    inputs.headcountLow === "" ||
    inputs.headcountHigh === "" ||
    inputs.salary === "" ||
    !Number.isFinite(low) ||
    !Number.isFinite(high) ||
    !Number.isFinite(salary) ||
    low < 1 ||
    high < 1 ||
    !Number.isInteger(low) ||
    !Number.isInteger(high) ||
    salary < 1
  ) {
    return "Enter whole-number headcounts and a positive salary.";
  }
  if (low > high) {
    return "The low headcount must be less than or equal to the high headcount.";
  }
  return "";
}

function App() {
  const [inputs, setInputs] = useState({
    fundingStage: "Series C & D",
    headcountLow: "50",
    headcountHigh: "75",
    salary: "180000",
    companyName: "",
  });
  const validationError = getValidationError(inputs);
  const projection = validationError
    ? []
    : calculate4YearImpact(
        inputs.fundingStage,
        Number(inputs.headcountLow),
        Number(inputs.headcountHigh),
        Number(inputs.salary),
      );
  const yearFour = projection.at(-1);
  const chartMaximum = Math.max(
    ...projection.map((year) => year.annualProductivityLossUSD.high),
    1,
  );
  const updateInput = (name) => (event) => {
    setInputs((current) => ({ ...current, [name]: event.target.value }));
  };

  return h(
    React.Fragment,
    null,
    h(
      "header",
      { className: "topbar" },
      h(
        "a",
        { className: "brand", href: "#", "aria-label": "EngFlow home" },
        h("span", { className: "brand-mark", "aria-hidden": true }, "e"),
        h("span", null, "engflow", h("span", { className: "brand-period" }, ".")),
      ),
      h("a", { className: "topbar-label", href: "../../", style: { color: "#2f7457" } }, "Cloud & On-Prem CI economics →"),
    ),
    h(
      "main",
      null,
      h(
        "section",
        { className: "intro" },
        h(
          "p",
          { className: "eyebrow" },
          h("span", { className: "eyebrow-line", "aria-hidden": true }),
          "THE COST OF SLOW FEEDBACK",
        ),
        h(
          "h1",
          null,
          "When engineering",
          h("br"),
          "friction ",
          h("span", null, "compounds."),
        ),
        h(
          "p",
          { className: "intro-copy" },
          "See how growing teams can lose productive time to long build cycles and context switching — and what that friction could cost over four years.",
        ),
      ),
      h(
        "section",
        { className: "calculator", "aria-label": "ROI calculator" },
        h(
          "form",
          {
            className: "inputs-panel",
            onSubmit: (event) => event.preventDefault(),
            noValidate: true,
          },
          h(
            "div",
            { className: "panel-heading" },
            h(
              "div",
              null,
              h("p", { className: "eyebrow" }, "01 / YOUR TEAM"),
              h("h2", null, "Set your assumptions"),
            ),
            h(
              "span",
              { className: "live-indicator" },
              h("span", { "aria-hidden": true }),
              " LIVE MODEL",
            ),
          ),
          h(
            "label",
            { className: "field" },
            h("span", { className: "field-label" }, "Funding stage"),
            h(
              "span",
              { className: "select-wrap" },
              h(
                "select",
                {
                  name: "fundingStage",
                  value: inputs.fundingStage,
                  onChange: updateInput("fundingStage"),
                },
                h("option", null, "Series A & B"),
                h("option", null, "Series C & D"),
                h("option", null, "Late Stage & Public"),
              ),
              h("span", { className: "select-chevron", "aria-hidden": true }, "⌄"),
            ),
            h(
              "span",
              { className: "field-hint" },
              "Used to estimate annual engineering team growth.",
            ),
          ),
          h(
            "fieldset",
            { className: "field" },
            h("legend", { className: "field-label" }, "Starting engineering headcount"),
            h(
              "div",
              { className: "range-fields" },
              h(
                "label",
                null,
                h("span", { className: "range-label" }, "LOW ESTIMATE"),
                h(
                  "span",
                  { className: "number-wrap" },
                  h("input", {
                    name: "headcountLow",
                    type: "number",
                    min: "1",
                    step: "1",
                    required: true,
                    value: inputs.headcountLow,
                    onChange: updateInput("headcountLow"),
                  }),
                  h("span", null, "devs"),
                ),
              ),
              h("span", { className: "range-separator", "aria-hidden": true }, "–"),
              h(
                "label",
                null,
                h("span", { className: "range-label" }, "HIGH ESTIMATE"),
                h(
                  "span",
                  { className: "number-wrap" },
                  h("input", {
                    name: "headcountHigh",
                    type: "number",
                    min: "1",
                    step: "1",
                    required: true,
                    value: inputs.headcountHigh,
                    onChange: updateInput("headcountHigh"),
                  }),
                  h("span", null, "devs"),
                ),
              ),
            ),
            h(
              "span",
              { className: "field-hint" },
              "Project a range rather than a single team-size estimate.",
            ),
          ),
          h(
            "label",
            { className: "field" },
            h("span", { className: "field-label" }, "Prospect / company (optional)"),
            h("span", { className: "number-wrap" },
              h("input", {
                name: "companyName",
                type: "text",
                maxLength: 80,
                placeholder: "e.g. Acme, Inc.",
                value: inputs.companyName,
                onChange: updateInput("companyName"),
              }),
            ),
            h("span", { className: "field-hint" }, "Personalizes the executive PDF briefing."),
          ),
          h(
            "label",
            { className: "field salary-field" },
            h(
              "span",
              { className: "field-label" },
              "Average fully loaded annual salary",
            ),
            h(
              "span",
              { className: "number-wrap salary-wrap" },
              h("span", { "aria-hidden": true }, "$"),
              h("input", {
                name: "salary",
                type: "number",
                min: "1",
                step: "any",
                required: true,
                value: inputs.salary,
                onChange: updateInput("salary"),
              }),
              h("span", null, "USD / year"),
            ),
            h(
              "span",
              { className: "field-hint" },
              "Used to translate lost engineering hours into estimated cost.",
            ),
          ),
          validationError
            ? h("p", { className: "form-error", role: "alert" }, validationError)
            : null,
          h(
            "div",
            { className: "model-note" },
            h("span", { className: "info-icon", "aria-hidden": true }, "i"),
            h(
              "p",
              null,
              "Estimates use the calculator's built-in growth and CI-friction assumptions. Actual outcomes will vary.",
            ),
          ),
        ),
        h(
          "section",
          {
            className: "results-panel",
            "aria-live": "polite",
            "aria-label": "Four-year projection",
          },
          h(
            "div",
            { className: "results-heading" },
            h(
              "div",
              null,
              h("p", { className: "eyebrow" }, "02 / FOUR-YEAR OUTLOOK"),
              h("h2", null, "Your projected impact"),
            ),
            h("span", { className: "projection-badge" }, "4 YEAR PROJECTION"),
          ),
          h(
            "div",
            { className: "summary-card" },
            h(
              "div",
              { className: "summary-topline" },
              h("span", null, "ESTIMATED ANNUAL PRODUCTIVITY LOSS"),
              h("span", { className: "summary-year" }, "YEAR 4"),
            ),
            h(
              "div",
              { className: "summary-amount" },
              yearFour
                ? formatCurrency(yearFour.annualProductivityLossUSD.high)
                : "$0",
            ),
            h(
              "div",
              { className: "summary-range" },
              yearFour
                ? `${formatCurrency(yearFour.annualProductivityLossUSD.low)} – ${formatCurrency(yearFour.annualProductivityLossUSD.high)} estimated annual loss`
                : "Enter valid assumptions to see the estimate.",
            ),
            h(
              "div",
              { className: "summary-footer" },
              h("span", { className: "summary-icon", "aria-hidden": true }, "↗"),
              h("span", null, "Annual impact at projected team size"),
              h(
                "span",
                { className: "summary-team" },
                yearFour
                  ? `${numberFormatter.format(yearFour.headcount.low)}–${numberFormatter.format(yearFour.headcount.high)} developers`
                  : "",
              ),
            ),
          ),
          h(
            "div",
            { className: "deck-action" },
            h(
              "button",
              {
                className: "deck-button",
                type: "button",
                disabled: !yearFour,
                onClick: () =>
                  downloadExecutiveBriefing({
                    companyName: inputs.companyName,
                    inputs,
                    projection,
                  }),
              },
              h("span", { "aria-hidden": true }, "↓"),
              " Download executive pitch deck",
            ),
            h("span", { className: "deck-hint" }, "3-page PDF · ready to share"),
          ),
          h(
            "div",
            { className: "projection-heading" },
            h("h3", null, "Impact by year"),
            h("span", null, "ANNUAL PRODUCTIVITY LOSS"),
          ),
          h(
            "div",
            { className: "year-list" },
            projection.map((year) =>
              h(
                "article",
                { className: "year-row", key: year.year },
                h(
                  "div",
                  { className: "year-label" },
                  h("span", null, year.year),
                  h(
                    "span",
                    { className: "year-team" },
                    `${numberFormatter.format(year.headcount.low)}–${numberFormatter.format(year.headcount.high)} devs`,
                  ),
                ),
                h(
                  "div",
                  { className: "bar-stack" },
                  ...[
                    ["low", year.annualProductivityLossUSD.low],
                    ["high", year.annualProductivityLossUSD.high],
                  ].map(([type, value]) =>
                    h("div", {
                      key: type,
                      className: `loss-bar loss-bar-${type}`,
                      style: {
                        width: `${Math.max((value / chartMaximum) * 100, 1)}%`,
                      },
                      "aria-label": `${type} estimate: ${formatCurrency(value)} annual productivity loss`,
                    }),
                  ),
                ),
                h(
                  "div",
                  { className: "year-values" },
                  h("span", null, formatCurrency(year.annualProductivityLossUSD.low)),
                  h("span", null, formatCurrency(year.annualProductivityLossUSD.high)),
                ),
              ),
            ),
          ),
          h(
            "div",
            { className: "metric-footer" },
            h(
              "span",
              null,
              h("span", { className: "metric-dot" }),
              " Low estimate",
            ),
            h(
              "span",
              null,
              h("span", { className: "metric-dot metric-dot-high" }),
              " High estimate",
            ),
            h(
              "span",
              { className: "metric-explainer" },
              "Based on annual lost engineering hours",
            ),
          ),
        ),
      ),
      h(
        "footer",
        { className: "page-footer" },
        h("span", null, "ENGFLOW ENGINEERING IMPACT MODEL"),
        h("span", null, "Illustrative estimates · Not financial advice"),
      ),
    ),
  );
}

createRoot(document.getElementById("root")).render(h(App));
