# Limitations

Verilive gives **risk signals, not proof**. Please read this before relying on it.

## It can say "real" when the face is fake

- New face-swap and avatar tools are improving quickly. A high-quality, well-lit deepfake may pass every check.
- A swap running on top of a real, live person can keep part of that person's real pulse and blinking.
- A short look (under about 15 seconds) or a tiny face gives too little evidence. The app says "Analyzing" until it has enough.

## It can say "suspicious" when the person is real

- **Heavy video compression** (poor connection, low bandwidth mode) can wash out the faint pulse signal.
- **Beauty and touch-up filters** (for example "Touch up my appearance" in Zoom) blur the skin and can look like a pasted face.
- **Virtual backgrounds and background blur** can disturb the face edge.
- **Poor or flickering lighting**, strong backlight, or a face that is mostly in shadow.
- **Fast movement** or a face partly out of frame.
- Some people blink rarely, especially when reading or concentrating.

## What it does not check

- **Voice, beyond an experiment.** Cloned voices are a major part of call scams. Verilive has only an off-by-default, unvalidated "voice signal" (see below). It is not a voice-clone detector, it needs shared tab audio, and it never feeds the face verdict.
- **Identity.** It does not know who someone is. A real person can still be a scammer.
- **Screen content** other than faces.

## The experimental voice signal

Settings has "Experimental: voice signal" (off by default). It is a hint, not a detector.

- **Unvalidated.** Its thresholds are starting points chosen from the usual behaviour of vocoders, tested only on synthetic signals. It has not been run on real calls or real voice clones, so a reading can be wrong in both directions.
- **Calls change the audio.** Codecs, noise suppression and gain control remove or imitate the traits it looks for. A low-bitrate call can look "synthetic" and a good clone can look normal.
- **Real voices trigger it too.** Cheap microphones, call filters, voice changers, very monotone speakers, and band-limited streams can show "synthetic-like" traits.
- **One mixed stream.** It cannot tell speakers apart, and your own voice or notification sounds may be in the mix.
- **Chromium and tab audio only.** Chrome and Edge can share a tab's audio; Firefox and Safari cannot. You must tick "Share tab audio", and the setting must be on before you share. Camera and file sessions are not analyzed.
- **Needs speech.** It says nothing until about eight seconds of voiced speech have been heard.
- It never changes the face-based risk level or the main score. The saved report adds an `experimental.voice` object of numbers only.

## Calibration

The thresholds come from published research on these signals and from simulated test videos (see [HOW_IT_WORKS.md](HOW_IT_WORKS.md)). They have not been validated on a large benchmark of real calls and real deepfakes. Contributions of evaluation results on public datasets (for example FaceForensics++ or the DFDC sample, under their licenses) are very welcome; the "Save report" JSON contains every metric needed.

## What to do instead of trusting a score

If a call asks you to move money, share a code or password, or act urgently: hang up and contact the person through a number or channel you already trust. Ask something only they would know. This works whatever the technology.
