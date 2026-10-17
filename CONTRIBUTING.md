# Contributing to Verilive

Thanks for helping people spot deepfakes on video calls. Bug reports, accuracy reports, research pointers and code are all welcome.

## Quick start

```bash
git clone https://github.com/Shahrukhalid/verilive.git
cd verilive
npm install
npm run dev        # http://localhost:5173
```

Requirements: Node.js 22+. Screen sharing needs a desktop browser (Chrome, Edge or Firefox).

## Checks before a pull request

```bash
npm run lint
npm run typecheck
npm test           # unit tests for the detectors (fast)
npm run build
npm run e2e        # the real app in Chromium on test videos (first run: npx playwright install chromium)
```

## Where things live

| Path | What |
|---|---|
| `src/engine/` | Pure TypeScript detectors and scoring. No DOM, fully unit-tested. Start here for detection ideas. |
| `src/vision/` | MediaPipe face landmarks, pixel measurements, small-face search. |
| `src/ui/` | React interface. |
| `tests/unit/` | Detector tests on deterministic synthetic data (`synth.ts`). |
| `tests/e2e/` | Playwright tests on generated videos (`scripts/make-fixtures.py`). |
| `docs/` | How it works and limitations. |

## Ground rules

- **Privacy is a feature.** No network requests, analytics or uploads. Video and images must stay on the device. The CSP blocks other origins; please don't loosen it.
- **Honesty over hype.** Detection changes need tests and a short explanation in `docs/HOW_IT_WORKS.md`. Don't present heuristics as proof.
- **No offensive tooling.** This project detects deepfakes; it won't accept code that creates them.
- **Test data.** Only use media you have the right to share (public domain, your own, or properly licensed datasets). Never commit recordings of real people without their consent.

New here? Look for issues labelled [good first issue](https://github.com/Shahrukhalid/verilive/labels/good%20first%20issue). By contributing you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
