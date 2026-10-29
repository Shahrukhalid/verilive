<div align="center">

<img src="public/favicon.svg" width="72" alt="" />

# Verilive

**Is the face on your video call real?**

A free, open-source **deepfake detector for video calls**: Zoom, Google Meet, Microsoft Teams, Webex and more.<br>
It looks for a pulse in the skin, natural blinking and face-swap artifacts, entirely in your browser.

[![CI](https://github.com/Shahrukhalid/verilive/actions/workflows/ci.yml/badge.svg)](https://github.com/Shahrukhalid/verilive/actions/workflows/ci.yml)
[![Live site](https://img.shields.io/badge/try_it-live-3456e8)](https://shahrukhalid.github.io/verilive/)
[![License: MIT](https://img.shields.io/badge/license-MIT-14804a)](LICENSE)
![Privacy](https://img.shields.io/badge/video-never_leaves_your_device-0b1220)

**[Open Verilive →](https://shahrukhalid.github.io/verilive/)** &nbsp;·&nbsp; no install, no account

<img src="docs/demo.gif" alt="Verilive analyzing a simulated face swap and flagging warning signs" width="820" />

</div>

## Why

Video-call deepfakes are now used to impersonate executives, relatives and job candidates. Commercial detectors exist, but they are sold to enterprises. Verilive is a free, private alternative anyone can open in a browser tab during a call.

## Features

- **Works with any call app.** Share the Zoom, Teams or Webex window (or a Meet tab) and Verilive analyzes the faces it can see. No plugins, no bots joining your meeting.
- **Six independent signals** grouped into *liveness* (pulse, blinking) and *swap artifacts* (sharpness, colour flicker, shape stability, head-turn test). The worse family decides, so neither a replayed video nor a live face swap can hide behind the other signals.
- **Guided head-turn check.** Face swaps break when the head turns. One click records a 12-second test while you ask the person to turn their head.
- **Several people at once**, each with a risk gauge, evidence meter, plain-language reasons and a risk timeline.
- **Finds small faces.** In gallery view Verilive zooms in automatically, or you can drag a box around a person.
- **Analyze recordings** of calls or clips someone sent you, and **try it on yourself** with your camera.
- **Floating verdict.** Pop the live verdict out into a small picture-in-picture window that stays on top of the call (Chrome and Edge).
- **Nine languages:** English, Filipino, Spanish, French, German, Portuguese, Indonesian, Chinese and Japanese. Each person card also shows a live pulse waveform.
- **Reports.** Save a JSON report (numbers only, never images) or copy a summary.
- **Private by design.** The face model and all analysis run in WebAssembly in your tab. A strict Content Security Policy blocks every other origin, and there is no server.
- Light and dark themes, keyboard and screen-reader friendly, works on desktop browsers.

## Use it on a call

1. Join the call as usual. Spotlight or pin the person you want to check.
2. Open **[Verilive](https://shahrukhalid.github.io/verilive/)** in Chrome, Edge or Firefox and click **Check a live call**. Pick the call window.
3. Put Verilive next to the call (split screen) so the tab stays visible.
4. After about 15 seconds each person gets a reading: **Looks real**, **Some warning signs** or **Likely synthetic**.
5. For a stronger test, ask them to turn their head slowly and press **Start 12-second check**.

| Flagged: simulated face swap | Looks real: simulated live face |
|---|---|
| ![Session flagging a simulated face swap](docs/screenshots/flagged.png) | ![Session showing a natural pulse](docs/screenshots/real.png) |

## How it works

```
video frame ─► MediaPipe face landmarks (478 points, blinks, head pose) ─► 160×160 face crop
            ─► per-person 60 s window ─► 6 signals ─► liveness | artifacts ─► worse family = risk
```

| Signal | What a real face does | What a fake tends to do |
|---|---|---|
| Pulse in skin colour (rPPG) | Skin colour changes slightly with each heartbeat, forehead and cheeks in sync | No clean, consistent pulse |
| Blinking | 8–25 irregular blinks a minute, both eyes | Rare, metronomic or one-eyed blinks |
| Face sharpness match | Eyes and lips are the sharpest part of the face | The pasted inner face is softer than the skin around it |
| Colour flicker at face edge | Inner and outer face change colour together | The re-rendered face shifts colour on its own |
| Face shape stability | Rigid landmarks move as one | The shape shimmers between frames |
| Head-turn test | Stable at any angle | Breaks down past about 30° |

Details, formulas and thresholds: **[docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)**.

## Honest limitations

Verilive gives **risk signals, not proof**. Heavy compression, beauty filters and bad lighting can make a real person look suspicious, and the best deepfakes may pass. Voice analysis exists only as an off-by-default, unvalidated experiment that never changes the face verdict (see [research notes](docs/research/VOICE_CLONE_SIGNAL.md)). Thresholds were set from research and simulations, not a large benchmark. Read **[docs/LIMITATIONS.md](docs/LIMITATIONS.md)**, and if a call asks for money, codes or urgent action, verify the person another way, whatever the score says.

## Run it yourself

```bash
git clone https://github.com/Shahrukhalid/verilive.git
cd verilive
npm install
npm run dev        # http://localhost:5173
```

`npm run build` produces a static site in `dist/` that you can host anywhere (it needs HTTPS for screen sharing).

```bash
npm test           # detector unit tests
npm run e2e        # the real app in Chromium on generated test videos
npm run evaluate -- <folder>   # accuracy on your own labelled videos (docs/EVALUATION.md)
```

## Project layout

```
src/engine/   detectors and scoring (pure TypeScript, unit-tested)
src/vision/   face landmarks, pixel measurements, small-face search
src/ui/       React interface
tests/        unit tests (synthetic signals) and end-to-end tests (generated videos)
docs/         how it works, limitations, translating, evaluation, research notes, screenshots
```

## Roadmap

- [ ] Validate (or retire) the experimental voice signal on call-like audio
- [ ] Evaluation on public deepfake datasets and published accuracy numbers
- [ ] Optional opt-in ONNX classifier for frame-level artifacts

Ideas and research pointers are welcome in [Discussions](https://github.com/Shahrukhalid/verilive/discussions).

## FAQ

**Can I detect a deepfake on a Zoom call for free?**
Yes. Open [Verilive](https://shahrukhalid.github.io/verilive/), click *Check a live call* and share the Zoom window. It is free and open source, with no account.

**Does it work with Google Meet and Microsoft Teams?**
Yes. It analyzes whatever call window or browser tab you share, so it works with Meet, Teams, Webex, FaceTime on the web, Skype and others. Nothing is installed into the call app.

**Is my video uploaded anywhere?**
No. The face model runs in WebAssembly inside your browser tab, and a strict Content Security Policy blocks the page from sending data to any other site. That includes the usage metrics the MediaPipe library would otherwise try to send to Google (they never contain images); see [SECURITY.md](SECURITY.md).

**How accurate is it?**
It gives risk signals, not proof. It catches replayed photos and video and common face-swap artifacts. It can be fooled by high-quality deepfakes and confused by heavy compression or beauty filters. See [LIMITATIONS.md](docs/LIMITATIONS.md).

**How is this different from commercial deepfake detectors?**
Commercial tools for live calls are paid enterprise products. Verilive is free, private, auditable and runs in any desktop browser.

## Contributing

Pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [good first issues](https://github.com/Shahrukhalid/verilive/labels/good%20first%20issue). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md) and report security issues privately ([SECURITY.md](SECURITY.md)).

## Credits

Face landmarks by Google's [MediaPipe](https://github.com/google-ai-edge/mediapipe) (Apache-2.0). Pulse extraction follows the POS method of Wang, den Brinker, Stuijk and de Haan (2017). Test videos are generated from NASA's public-domain portrait of astronaut Eileen Collins. Full list: [NOTICE.md](NOTICE.md).

## License

[MIT](LICENSE) © Shahrukhalid

If Verilive helps you or someone you know, please ⭐ star the repo so more people can find it.

Also by the same author: **[STARK OS](https://github.com/Shahrukhalid/stark-os)**, a free, self-hosted AI social media team that asks before it posts.
