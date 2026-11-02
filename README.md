# EngFlow 4-Year ROI & Developer Friction Calculator

A React calculator that estimates engineering friction and monetized productivity loss caused by the "Build Infrastructure Wall." The browser interface runs projections locally using the calculation engine.

The engine uses empirical growth parameters from Ordinary Least Squares (OLS) regression models to project headcount compound growth, quadratic dependency graph complexity, daily context switching penalties, and financial productivity loss over a 4-year time horizon.

---

## Features

* **Client-Side Calculations:** Calculates projections in the browser without sending prospect inputs to a server.
* **Empirical Growth Engine:** Uses statistical OLS regression models (R^2 = 0.1214, p = 0.00214) mapping funding tiers directly to YoY company growth acceleration/deceleration.
* **Bounded Range Projections:** Evaluates inputs across low and high headcount bounds to output realistic operational ranges.
* **Executive Briefing Export:** Downloads a three-page, prospect-personalized PDF with the four-year outlook, model assumptions, discussion prompts, and estimate caveats.
* **Quadratic Complexity Modeling:** Calculates codebase dependency interaction vectors, V = (N(N-1))/2 rather than simple linear headcount scaling.
* **Cognitive Context Switch Penalty:** Models cognitive friction by adding a 15-minute refocus penalty when CI build times cross the 15-minute feedback loop threshold.
* **AI Code Volume Multiplier:** Accounts for 1.25 times increased Pull Request (PR) generation volume from modern AI tools (GitHub Copilot, Cursor).

---

## Run the calculator

The app is a static React frontend with no build step. React and ReactDOM are served locally from `vendor/react`; serving the repository root over HTTP is required for JavaScript modules:

```sh
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Modern browsers with ES module support are required. Google Fonts are optional external assets.

The current app is a standalone React frontend; CRM authentication, embedding, and prospect-data synchronization are not configured. Those require the target CRM and its integration details.

Use the **Download executive pitch deck** button to create a PDF from the current inputs. The export runs locally in the browser and labels the figures as modeled estimates, not guaranteed or recoverable savings.

## File architecture

```text
├── index.html             # Calculator interface
├── app.js                 # React UI and projection rendering
├── pitchDeck.js           # Client-side three-page PDF export
├── styles.css             # Responsive application styles
├── roiCalculator.js       # Core calculation engine & exported functions
├── vendor/react/          # Locally served React runtime and MIT license
├── README.md              # Model and usage guide
└── analysis/              # Source data and model validation