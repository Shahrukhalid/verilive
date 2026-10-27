# Research: an on-device voice-clone signal from shared tab audio

Status: research notes for issue #6. Nothing here is implemented, and no audio detector ships with Verilive. A detector only goes in once it passes the evaluation plan below.

## Goal and constraints

Voice clones are common in call scams. The idea is a signal that listens to the audio of the call and contributes a risk reading next to the face signals.

Hard constraints, inherited from the project:

- **On-device only.** Audio is never uploaded, stored or logged. The page's Content Security Policy (`connect-src 'self'`) already blocks outbound requests and must stay that way.
- **Honest framing.** The output is a risk signal with a confidence, never a verdict. It must say when it cannot tell.
- **Permissive licences** for code and model weights, with dataset terms respected.
- **Experimental and opt-in** until validated: off by default, behind a setting, clearly labelled.

## What the browser gives us

`getDisplayMedia({ audio: true })` can return audio with the screen share, but:

- Chromium only (Chrome, Edge). Tab audio is offered when sharing a tab; whole-system audio only on Windows and ChromeOS. Firefox and Safari do not provide it. The person must tick "Share tab audio", so the signal has to work without it and say it is not listening.
- Everything in the tab arrives as **one mixed stream**: every participant, plus notification sounds. There is no per-speaker separation, so a score cannot be tied to "Person 2" without diarization, which is itself unreliable in overlapping speech.
- The audio has already been through the call app: a codec (typically Opus at low bitrates), noise suppression, automatic gain control, echo cancellation and packet-loss concealment. These erase or imitate many of the artifacts that detectors learn from clean data.

Processing can stay local with the Web Audio API: a `MediaStreamAudioSourceNode` into an `AudioWorklet` (worker-side, no network) producing small feature vectors. Raw samples are discarded after each window; nothing but a few numbers per window should reach the page state or the saved report.

## Feasible approaches

| Approach | Idea | Cost in browser | Main limits |
| --- | --- | --- | --- |
| Signal-processing features plus a small classifier | Spectral and cepstral features (LFCC, CQCC, spectral flatness, high-band energy, pitch and jitter statistics) into a GMM or small MLP, as in the ASVspoof baselines | Very cheap; plain JavaScript or WebAssembly | Trained on clean studio-style data; generalises poorly to unseen generators and to codec-degraded audio |
| Small end-to-end neural detector | Compact CNN or graph-attention models on raw waveform or spectrogram (RawNet2 and AASIST families) run with ONNX Runtime Web or TensorFlow Lite on WASM | Moderate; a few MB of weights, real-time on a laptop CPU | Check the licence of the code and the weights separately; trained on ASVspoof-style data; sensitive to channel mismatch |
| Self-supervised front end plus classifier | wav2vec 2.0 or XLS-R embeddings with a light head, currently the strongest in research | Heavy (hundreds of millions of parameters) | Too large and slow to ship in a page; a distilled model would need its own validation |
| Audio-visual consistency | Compare mouth opening from the existing face mesh with the audio energy envelope (lip-sync agreement, SyncNet-style) | Cheap; reuses the face pipeline | Needs a single clear speaker; call latency and audio-video drift add noise; a voice clone over a real face passes, and a lip-synced fake may too |
| Physical and behavioural cues | Breathing and pauses, room noise continuity, pitch range, unnaturally clean silence | Cheap | Weak on their own; overlap with noise suppression behaviour; easily changed by the clone's author |

A realistic first experiment is the small neural detector and the audio-visual consistency check, evaluated on call-like audio, with the cheap feature classifier as the baseline to beat.

## Limits to state up front

- **Codec and processing mismatch** is the main risk. Detectors that score well on clean benchmarks often degrade sharply after Opus compression, resampling and noise suppression. Without validation on call-like audio, any number is misleading.
- **Generalisation.** New synthesis systems appear faster than detectors are retrained, so a detector tuned on today's generators can miss tomorrow's.
- **False alarms.** Poor microphones, strong accents and other languages, speech-enhancement filters, voice changers used for privacy and children's voices can all look "synthetic". A false accusation of a real person is a harm, so a precision-first threshold and an "unsure" state are needed.
- **Mixed speakers** make per-person attribution unreliable, and the user's own voice may be in the stream.
- **Adversarial pressure.** A clone played through a phone speaker, mixed with background noise or re-compressed hides artifacts further.
- **Short windows.** Reliable decisions usually need several seconds of clean speech from one speaker, so the signal would often report "not enough speech".

## Privacy design (if it ever ships)

- Off by default; a plain-language setting explains what is listened to and that it stays on the device.
- Only after the person grants tab-audio sharing; stops when sharing stops.
- Processing in an AudioWorklet or worker; no recording, no `MediaRecorder`, no copies of the buffer kept beyond the current window.
- No network: the existing CSP stays strict and the model, if any, is bundled and served from the same origin.
- The saved report and copied summary contain only the signal's score, confidence and a count of seconds analysed, never audio or transcripts. No speech recognition.
- Tests assert that no request leaves the page when the audio signal is on, as the video path already does.

## Evaluation plan

The aim is to decide, with numbers, whether a signal is useful enough to ship as experimental.

1. **Data.** Use public datasets under their licences and keep them out of the repository: ASVspoof 2019 LA and 2021 (including the codec-degraded DF track) for training-style baselines; In-the-Wild and WaveFake for generalisation to unseen generators; MLAAD for many languages; FakeAVCeleb for audio-visual cases. For genuine call speech, record consenting volunteers over several apps (Meet, Zoom, Teams), devices and rooms, and clone a volunteer's voice with their written permission using a few open and commercial tools for the fake class.
2. **Make it call-like.** Pass every clip through a degradation chain that matches shared tab audio: Opus at 16, 24 and 32 kbps, 8 kHz and 16 kHz paths, noise suppression and gain control on and off, packet-loss concealment at 0, 3 and 10 percent, background noise and room reverberation. Report results per condition as well as pooled.
3. **Split by generator and by speaker.** Train and tune on some synthesis systems and speakers; test only on unseen ones. Never tune a threshold on the test set.
4. **Metrics.** Equal error rate and AUC for ranking; false-positive rate on genuine speech at fixed true-positive rates (for example the FPR when recall is 80 percent), because the cost of wrongly flagging a real person is high; fraction of windows reported as "unsure"; latency and CPU use on a mid-range laptop; model size.
5. **Calibration.** Check that a reported 70 percent risk corresponds to roughly that fraction in held-out data, using reliability plots, and set the evidence meter from the amount of clean speech heard.
6. **Fairness.** Break results down by language, accent, gender, age range and microphone type, and look for groups with a higher false-alarm rate.
7. **Shipping gate (proposed).** Ship as experimental only if, on unseen generators and call-degraded audio, the signal clearly beats the baseline of chance and of the simple feature classifier, keeps the false-positive rate on genuine call speech low enough to be proposed publicly (a target such as 1 to 2 percent is a starting point to agree on, not a measured result), shows no large gap across the groups above, and runs in real time without hurting the face analysis. Otherwise publish the negative result.
8. **Reuse the harness.** `npm run evaluate` already walks labelled folders and reports precision, recall and per-signal statistics for video; an audio signal should plug into the same report format, with the dataset kept outside the repo.

## Open questions

- Can per-speaker attribution be done reliably enough, or should the signal be a single "voices in this call" reading?
- Is audio-visual consistency robust enough on gallery views with many small faces?
- Which small detectors have code and weights under licences compatible with MIT distribution, and were they trained on data whose terms allow that use?
- How should the interface present a result that is mostly "not enough speech"?
