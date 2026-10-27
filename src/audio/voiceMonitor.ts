import { VoiceAggregator, type VoiceSnapshot } from "./features";
import workletUrl from "./voice.worklet.ts?worker&url";

export type VoiceStatus = "starting" | "listening" | "noAudio" | "error" | "stopped";

export interface VoiceView {
  status: VoiceStatus;
  snapshot: VoiceSnapshot | null;
}

/**
 * Listens to the audio track of a shared tab, only while it is running. The audio goes into an
 * AudioWorklet that returns feature numbers; it is never connected to the speakers, recorded or
 * sent anywhere. `stop()` disconnects everything. The stream's tracks belong to the caller.
 */
export class VoiceMonitor {
  private status: VoiceStatus = "starting";
  private aggregator: VoiceAggregator | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private track: MediaStreamTrack | null = null;
  private stopped = false;
  /** While true, incoming numbers are dropped (the session is paused). */
  paused = false;
  private readonly onTrackEnded = () => this.stop();

  constructor(private readonly stream: MediaStream) {}

  async start(): Promise<void> {
    const track = this.stream.getAudioTracks().find((t) => t.readyState === "live");
    if (!track) {
      this.status = "noAudio";
      return;
    }
    if (typeof AudioContext === "undefined" || typeof AudioWorkletNode === "undefined") {
      this.status = "error";
      return;
    }
    try {
      const context = new AudioContext({ latencyHint: "playback" });
      this.context = context;
      // Same-origin module built by Vite, so the page's script-src 'self' allows it.
      await context.audioWorklet.addModule(workletUrl);
      if (this.stopped) return; // stop() already closed the context
      const aggregator = new VoiceAggregator(context.sampleRate);
      this.aggregator = aggregator;
      const node = new AudioWorkletNode(context, "verilive-voice", { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1, channelCountMode: "explicit" });
      node.port.onmessage = (e: MessageEvent) => {
        if (this.paused || this.stopped || !Array.isArray(e.data)) return;
        aggregator.addFlat(e.data as number[]);
      };
      const source = context.createMediaStreamSource(new MediaStream([track]));
      source.connect(node); // deliberately not connected to context.destination
      this.node = node;
      this.source = source;
      this.track = track;
      track.addEventListener("ended", this.onTrackEnded);
      await context.resume().catch(() => undefined);
      if (!this.stopped) this.status = "listening";
    } catch {
      if (!this.stopped) this.status = "error";
      this.release();
    }
  }

  view(): VoiceView {
    return { status: this.status, snapshot: this.aggregator ? this.aggregator.snapshot() : null };
  }

  /** Stops listening and disconnects everything. The numbers collected so far stay readable. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.status === "starting" || this.status === "listening") this.status = "stopped";
    this.release();
  }

  private release(): void {
    this.track?.removeEventListener("ended", this.onTrackEnded);
    if (this.node) {
      this.node.port.onmessage = null;
      this.node.port.close();
      this.node.disconnect();
    }
    this.source?.disconnect();
    void this.context?.close().catch(() => undefined);
    this.node = null;
    this.source = null;
    this.context = null;
    this.track = null;
  }
}
