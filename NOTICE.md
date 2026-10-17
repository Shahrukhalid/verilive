# Third-party notices

Verilive's own code is MIT licensed (see [LICENSE](LICENSE)). It ships or uses the following third-party work:

| Component | License | Where |
|---|---|---|
| [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) WebAssembly runtime | Apache-2.0 | copied from `node_modules/@mediapipe/tasks-vision` at build time |
| MediaPipe Face Landmarker model (`face_landmarker.task`, float16 v1) | Apache-2.0 | `public/models/` (SHA-256 `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`, the official release at `storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`; CI re-checks it) |
| [React](https://react.dev) | MIT | npm dependency |
| Sora, Onest, IBM Plex Mono fonts via [Fontsource](https://fontsource.org) | SIL Open Font License 1.1 | bundled in the build |
| Portrait of astronaut Eileen Collins (NASA), as bundled with scikit-image | Public domain | source image for the test videos in `tests/e2e/fixtures/` |

MediaPipe's privacy notice: https://goo.gle/mediapipe-privacy. Verilive runs the model locally and sends no data anywhere.
