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

Each signal returns a **suspicion** (0 natural to 1 synthetic), a **confidence** (how much evidence it has: footage length, frame rate, face size, head motion) and a plain-language sentence.

## From signals to a verdict

Signals are grouped into two families. A replayed photo or video fails the liveness family while looking perfectly sharp; a face swap on a live person may keep part of the real pulse but leaves artifacts. Averaging everything would hide either attack, so each family is a confidence-weighted average and the **worse family** is the risk score. One strong, well-supported signal can raise the level on its own.

| Level | Score (balanced) | Shown as |
|---|---|---|
| Collecting | evidence < 30% | Analyzing |
| Low | < 0.35 | Looks real |
| Elevated | 0.35–0.6 | Some warning signs |
| High | ≥ 0.6 | Likely synthetic |

The Sensitivity setting moves both thresholds by 0.08 (Relaxed raises them, Strict lowers them).

## Small faces and gallery view

The face model works on a downscaled frame, so small faces (a 3×3 gallery, a thumbnail) can be missed. When no face is found for about a second, Verilive searches overlapping tiles of the frame at higher resolution and zooms in on the largest face it finds. You can also drag a box around a person on the video to analyze just that area.

## Performance

Analysis runs at up to about 20 frames per second on the main thread using WebAssembly (CPU). The face model (≈3.7 MB) and runtime (≈13 MB) load once and are cached by the browser. Keep the Verilive tab visible next to the call; browsers slow down hidden tabs.

## Testing

- `tests/unit`: the signal processing and every detector against deterministic synthetic data (living face, frozen photo, face swap, metronome blinking, head-turn breakdown).
- `tests/e2e`: the real app in Chromium on generated videos made from NASA's public-domain portrait of Eileen Collins: a still photo held up to a camera, the same photo with a simulated 72 bpm pulse, a simulated face swap (softened, re-tinted inner face), and a small face that requires auto-zoom. `scripts/make-fixtures.py` regenerates them.

The thresholds were set from these simulations and published research, not from a large benchmark. See [LIMITATIONS.md](LIMITATIONS.md).
