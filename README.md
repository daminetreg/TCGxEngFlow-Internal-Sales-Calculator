# EngFlow 4-Year ROI & Developer Friction Calculator Engine

A zero-dependency, high-performance JavaScript/TypeScript calculation engine designed to quantify the engineering friction and monetized productivity loss caused by the "Build Infrastructure Wall".

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

## File Architecture

```text
├── roiCalculator.js       # Core calculation engine & exported functions
├── README.md              # Mathematical spec sheet & integration guide