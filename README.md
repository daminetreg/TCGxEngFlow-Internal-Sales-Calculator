# EngFlow 4-Year ROI & Developer Friction Calculator

A zero-dependency calculator that estimates engineering friction and monetized productivity loss caused by the "Build Infrastructure Wall." The browser interface runs projections locally using the calculation engine.

The engine uses empirical growth parameters from Ordinary Least Squares (OLS) regression models to project headcount compound growth, quadratic dependency graph complexity, daily context switching penalties, and financial productivity loss over a 4-year time horizon.

---

## Features

* **Zero Dependency & Zero API Overhead:** Calculates all mathematical projections client-side in sub-millisecond execution time for fluid slider/input responsiveness.
* **Empirical Growth Engine:** Uses statistical OLS regression models (R^2 = 0.1214, p = 0.00214) mapping funding tiers directly to YoY company growth acceleration/deceleration.
* **Bounded Range Projections:** Evaluates inputs across low and high headcount bounds to output realistic operational ranges.
* **Quadratic Complexity Modeling:** Calculates codebase dependency interaction vectors, V = (N(N-1))/2 rather than simple linear headcount scaling.
* **Cognitive Context Switch Penalty:** Models cognitive friction by adding a 15-minute refocus penalty when CI build times cross the 15-minute feedback loop threshold.
* **AI Code Volume Multiplier:** Accounts for 1.25 times increased Pull Request (PR) generation volume from modern AI tools (GitHub Copilot, Cursor).

---

## Run the calculator

The app is static and has no build step or package dependencies. Serve the repository root over HTTP so the browser can load the JavaScript modules:

```sh
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## File architecture

```text
├── index.html             # Calculator interface
├── app.js                 # Browser UI and projection rendering
├── styles.css             # Responsive application styles
├── roiCalculator.js       # Core calculation engine & exported functions
├── README.md              # Model and usage guide
└── analysis/              # Source data and model validation