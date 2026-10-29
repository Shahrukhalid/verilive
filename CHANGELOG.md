# Changelog

## 1.1.0 (2026-10-29)

- The interface is translated into nine languages (English, Filipino, Spanish, French, German, Portuguese, Indonesian, Chinese, Japanese), chosen from the browser's language; see `docs/TRANSLATING.md`. Thanks to rangerisrael.
- Person cards show a live pulse waveform (the last six seconds) once the pulse can be measured; it respects reduced-motion settings.
- Picture-in-picture button (browsers with the Document Picture-in-Picture API) floats each person's verdict over the call.
- `npm run evaluate` runs the engine over a folder of labelled videos and reports accuracy, precision, recall and per-signal statistics; see `docs/EVALUATION.md`.
- Experimental, off-by-default "voice signal" (setting "Experimental: voice signal"): when a shared tab carries audio, an AudioWorklet measures spectral flatness, rolloff, high-band energy, spectral flux, pitch and level steadiness on the device and shows a separate "Voice (experimental)" reading. Unvalidated; it never changes the face verdict or main score, and audio is never recorded or sent. Reports gain an `experimental.voice` object of numbers when it is on. Research notes: `docs/research/VOICE_CLONE_SIGNAL.md`.
- Head-turn test no longer reports a strong "face swap" reading when the head-on frames have no measured shape wobble (missing data was divided by a near-zero value).
- Session timer and the report's duration exclude paused time and stop when the recording or screen share ends.
- Resuming a recording no longer leaves an unhandled promise rejection when the browser refuses to play; the session returns to paused.
- Frame-loop cleanup cancels the right callback type and removes the screen-share track listener.
- Signal resampling no longer throws when timestamps do not increase.
- The build fails if the Content Security Policy cannot be injected; the dev server now blocks requests to other origins (`connect-src 'self'`), including MediaPipe's usage metrics.
- Lint rules now also apply to `scripts/*.mjs`.

## 1.0.0 (2026-10-17)

First public release.

- Check a live call (shared window), a recording, or yourself (camera), entirely in the browser.
- Six signals: pulse in skin colour (rPPG), blinking, face sharpness match, colour flicker, face shape stability, guided head-turn test.
- Separate liveness and artifact scoring with an evidence meter, per-person cards and risk timeline.
- Several people at once, automatic zoom for small faces, drag-to-focus.
- Report export (JSON, numbers only) and copyable summary.
- Strict Content Security Policy; no network access after load.
