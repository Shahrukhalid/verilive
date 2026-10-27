# Security policy

## Reporting a vulnerability

Please report security issues privately through [GitHub's private vulnerability reporting](https://github.com/Shahrukhalid/verilive/security/advisories/new), not in public issues. You'll get a reply within a few days.

## Design

- Verilive is a static site with no backend. Video, images and measurements never leave the browser.
- The production build ships a strict Content Security Policy: scripts, styles, fonts and network requests are limited to the page's own origin (`connect-src 'self'`), and `wasm-unsafe-eval` is allowed only so the face model can run.
- The MediaPipe runtime and face model are served from the same origin, never from a CDN. The model's SHA-256 is checked at build time and against Google's official download in CI.
- The MediaPipe library itself tries to send usage metrics (task type, timings; never images or video) to `odml.pa.googleapis.com`, as described in its own privacy notice. The CSP above blocks that request on the live site and in any production build, and the dev server (`npm run dev`) sends a `connect-src 'self'` header so it is blocked there too. If you host the build yourself, keep the injected CSP.
- Saved reports contain numbers and text only; no frames or images.

## Supported versions

Only the latest release and the live site receive fixes.
