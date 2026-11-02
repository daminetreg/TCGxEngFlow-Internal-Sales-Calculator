# EngFlow 4-Year ROI & Developer Friction Calculator

A React calculator that estimates engineering friction and monetized productivity loss caused by the "Build Infrastructure Wall." The browser interface runs projections locally using the calculation engine.

The engine uses empirical growth parameters from Ordinary Least Squares (OLS) regression models to project headcount compound growth, quadratic dependency graph complexity, daily context switching penalties, and financial productivity loss over a 4-year time horizon.

---

## Features

* **Client-Side Calculations:** Calculates projections in the browser without sending prospect inputs to a server.
* **Empirical Growth Engine:** Uses statistical OLS regression models (R^2 = 0.1214, p = 0.00214) mapping funding tiers directly to YoY company growth acceleration/deceleration.
* **Bounded Range Projections:** Evaluates inputs across low and high headcount bounds to output realistic operational ranges.
* **Quadratic Complexity Modeling:** Calculates codebase dependency interaction vectors, V = (N(N-1))/2 rather than simple linear headcount scaling.
* **Cognitive Context Switch Penalty:** Models cognitive friction by adding a 15-minute refocus penalty when CI build times cross the 15-minute feedback loop threshold.
* **AI Code Volume Multiplier:** Accounts for 1.25 times increased Pull Request (PR) generation volume from modern AI tools (GitHub Copilot, Cursor).

---

## Run the calculator

The app is a static React frontend with no build step. React and ReactDOM are loaded from esm.sh, so an internet connection is required. Serve the repository root over HTTP:

```sh
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Modern browsers with ES module and import-map support are required.

The current app is a standalone React frontend; CRM authentication, embedding, and prospect-data synchronization are not configured. Those require the target CRM and its integration details.

## File architecture

```text
├── index.html             # Calculator interface
├── app.js                 # React UI and projection rendering
├── styles.css             # Responsive application styles
├── roiCalculator.js       # Core calculation engine & exported functions
├── README.md              # Model and usage guide
└── analysis/              # Source data and model validation