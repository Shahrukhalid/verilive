# How Verilive works

Verilive is a static web page. When you start a check, it reads frames from the video (a shared call window, a video file or your camera), finds faces with Google's MediaPipe Face Landmarker running in WebAssembly, measures each face, and turns the measurements into a risk reading. Nothing is uploaded: the page's Content Security Policy only allows it to talk to its own origin, and it has no server to talk to.

```
video frame ──► face landmarks (478 points, blink scores, head pose)
             └► 160×160 face crop ──► skin colour, sharpness, colour balance
                                     │
            per person, rolling 60 s window
                                     ▼
   pulse · blinking · sharpness match · colour flicker · shape stability · head-turn test
                                     │
              liveness family   ◄────┴────►   artifact family
                                     │
                     worse family = risk score (+ evidence %)
```

## The six signals

| Signal | Family | What a real face does | What a fake tends to do | Implementation |
|---|---|---|---|---|
| Pulse in skin colour | liveness | Skin colour changes very slightly with each heartbeat; forehead and cheeks change together | No clean pulse; regions don't agree | POS remote-photoplethysmography (Wang et al., 2017) on forehead and cheeks, 0.7–3 Hz band, spectral SNR and cross-region correlation (`src/engine/pulse.ts`) |
| Blinking | liveness | 8–25 irregular blinks a minute, both eyes together | Rare, metronomic or one-eyed blinks | MediaPipe blink blendshapes with hysteresis (`src/engine/blink.ts`) |
| Face sharpness match | artifacts | Eyes, brows and lips make the inner face sharper than the cheeks | The pasted inner face is softer than the real skin around it | Ratio of mean absolute Laplacian inside the eyes-nose-mouth hull vs. the rest of the face oval (`src/engine/appearance.ts`) |
| Colour flicker at face edge | artifacts | Inner and outer face change colour together (lighting) | The re-rendered inner face shifts colour on its own | Frame-to-frame change of the chromaticity difference between inner face and outer ring |
| Face shape stability | artifacts | Rigid landmarks (eye corners, nose bridge, chin) move as one | Shape shimmers between frames | Residual after a 2-D similarity (Procrustes) fit between consecutive frames (`src/engine/geometry.ts`) |
| Head-turn test | artifacts | Stays stable when the head turns | Swaps trained on frontal faces break down at 30°+ yaw | Shape residual at large yaw vs. frontal frames, recorded during the guided check |

Each signal returns a **suspicion** (0 natural to 1 synthetic), a **confidence** (how much evidence it has: footage length, frame rate, face size, head motion) and a plain-language sentence. The sentence is built with `describe(key, params)` (`src/i18n`), so it carries both its English text and a translation key (see [Languages](#languages)).

## From signals to a verdict

Signals are grouped into two families. A replayed photo or video fails the liveness family while looking perfectly sharp; a face swap on a live person may keep part of the real pulse but leaves artifacts. Averaging everything would hide either attack, so each family is a confidence-weighted average and the **worse family** is the risk score. One strong, well-supported signal can raise the level on its own.

| Level | Score (balanced) | Shown as |
|---|---|---|
| Collecting | evidence < 30% | Analyzing |
| Low | < 0.35 | Looks real |
| Elevated | 0.35–0.6 | Some warning signs |
| High | ≥ 0.6 | Likely synthetic |

The Sensitivity setting moves both thresholds by 0.08 (Relaxed raises them, Strict lowers them).

## Experimental: voice signal

This is a prototype, off by default and unvalidated (see [LIMITATIONS.md](LIMITATIONS.md) and the [research notes](research/VOICE_CLONE_SIGNAL.md)). It is separate from the six face signals and never changes the verdict or the main score.

1. **Opt in.** The "Experimental: voice signal" checkbox (home page or session settings) is off by default and remembered in this browser only. With it on, "Check a live call" also asks the browser for tab audio (`getDisplayMedia({ audio: true })`). Only Chromium browsers offer it, and only if "Share tab audio" is ticked.
2. **Listen on the audio thread.** The audio track goes into an AudioWorklet (`src/audio/voice.worklet.ts`), bundled by Vite and served from the same origin, so the strict Content Security Policy is unchanged. The node is never connected to the speakers. Every 2048 samples (about 43 ms) the worklet measures one frame and discards the samples; about twice a second it posts a batch of numbers, which is the only thing that reaches the page.
3. **Measure.** Pure functions in `src/audio/features.ts`: spectral flatness, 95 percent rolloff, share of energy above 6 kHz, spectral flux, pitch and voicing (autocorrelation), and level.
4. **Read.** `VoiceAggregator` keeps a bounded window of those numbers and looks at four traits: no energy in the high band on a wide stream (a vocoder or resampling tell), unusually small pitch changes between neighbouring voiced frames, unusually even loudness, and unusually even spectral change. Each runs from 0 (ordinary) to 1, and their mean is the "synthetic-like traits" percentage. Evidence is the seconds of voiced speech heard, out of 20; below about 8 seconds it says it is still listening. The cut-offs are untuned starting points.
5. **Show.** A separate "Voice (experimental)" card with a plain sentence ("nothing unusual", "some traits seen in synthetic voices") and the caveat that it is unvalidated. The report gets an `experimental.voice` object (numbers only: seconds heard, trait share, evidence and the measured values) only when the setting is on.
6. **Stop.** Turning the setting off, ending the share or leaving the session disconnects the nodes, closes the audio context and keeps no samples. Nothing is recorded, stored, transcribed or sent.

## Small faces and gallery view

The face model works on a downscaled frame, so small faces (a 3×3 gallery, a thumbnail) can be missed. When no face is found for about a second, Verilive searches overlapping tiles of the frame at higher resolution and zooms in on the largest face it finds. You can also drag a box around a person on the video to analyze just that area.

## Performance

Analysis runs at up to about 20 frames per second on the main thread using WebAssembly (CPU). The face model (≈3.7 MB) and runtime (≈13 MB) load once and are cached by the browser. Keep the Verilive tab visible next to the call; browsers slow down hidden tabs.

## Languages

The interface follows the browser's language. English is the default; Filipino, Spanish, French, German, Portuguese, Indonesian, Chinese (Simplified) and Japanese are also included. There is no i18n library, only a few small files in `src/i18n/`, each with one job:

```
navigator.languages ──► detect.ts ──► locale ──► translate.ts ──► text on screen
                        (picks a supported      (looks up a key in that language's
                         language, else "en")    dictionary, fills {placeholders},
                                                 picks plural forms)
                                    locales/*.ts: one dictionary per language
```

- **Detection** takes the first language in the browser's preference list that Verilive supports and ignores the region (`es-MX` gives Spanish). `tl` is read as Filipino and `in` as Indonesian. Anything else gives English.
- **Fallback** never breaks the page: a key missing from a language shows the English text, and a key missing everywhere shows the key itself.
- **What is translated:** all UI text, the four risk levels (title and advice), the signal names, the detectors' sentences and the summary you copy. The detectors do not know about languages: each returns the English `detail` plus a `detailKey` and `detailParams`, and the interface translates those when it shows them. The detection maths is untouched.
- **The saved JSON report stays in English** so it has one stable format for other tools. It also records each sentence's `detailKey` and `detailParams`, and `reasonIds` pointing at the signals behind the top reasons.
- **Adding a language** takes one new dictionary file and one line in `src/i18n/locales/index.ts`. TypeScript and the unit tests flag any missing key or mismatched placeholder. See [TRANSLATING.md](TRANSLATING.md).

## Testing

- `tests/unit`: the signal processing and every detector against deterministic synthetic data (living face, frozen photo, face swap, metronome blinking, head-turn breakdown), the experimental voice features on synthetic signals (`voice.test.ts`: a pure tone, white noise, band-limited noise, pitch finding, spectral flux, and machine-even versus lively speech), and the translation layer (`i18n.test.ts`: every language has the same keys and placeholders as English, language detection, fallback, plurals, the English report versus the translated summary).
- `tests/e2e`: the real app in Chromium on generated videos made from NASA's public-domain portrait of Eileen Collins: a still photo held up to a camera, the same photo with a simulated 72 bpm pulse, a simulated face swap (softened, re-tinted inner face), and a small face that requires auto-zoom. `scripts/make-fixtures.py` regenerates them.

The thresholds were set from these simulations and published research, not from a large benchmark. See [LIMITATIONS.md](LIMITATIONS.md).
