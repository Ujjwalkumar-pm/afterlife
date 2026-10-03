# Pre-launch QA scripts

These scripts back `docs/testing/2026-10-03-launch-test-report.md`.

**Before running:**
- The browser scripts need `npm run dev` running on port 5173.
- Install Playwright's engines with `npx playwright-core install webkit` (Chrome is used from /Applications).

**Running a script:** pass an output folder as the first argument, for example `node tools/qa/matrix.mjs /tmp/qa`.

| Script | Test type |
|---|---|
| fuzz.ts (run with `npx tsx tools/qa/fuzz.ts out.json`) | Statistical usage and invariants, plus simulated play-test personas |
| pairwise.mjs | Combinatorial (pairwise) testing |
| functional.mjs | Functional feature checklist |
| matrix.mjs | Compatibility matrix (devices × engines) |
| tree_adhoc.mjs | Tree (navigation) testing, plus ad hoc monkey and edge cases |
| perf.mjs, perfcheck.mjs | Frame rate and memory under CPU throttling |
| load.mjs | Page-load timing on 4G and Slow 4G (live site) |
| load2.mjs | Load testing with concurrent visitors (live site) |
