/**
 * AudioWorklet that turns shared tab audio into a few numbers per frame. It runs on the audio
 * thread, keeps one frame of samples at a time, and posts only feature numbers (about twice a
 * second). The samples themselves are overwritten by the next frame and never leave this file.
 */
import { FRAME, FEATURE_COUNT, analyzeFrame, frameToArray } from "./features";

// The worklet scope has these globals; the DOM typings do not declare them.
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;

/** Frames per message: about half a second of audio, so the main thread is woken rarely. */
const FRAMES_PER_MESSAGE = 12;

class VoiceFeatureProcessor extends AudioWorkletProcessor {
  private buffer = new Float32Array(FRAME);
  private filled = 0;
  private spectrum: Float64Array | null = null;
  private batch: number[] = [];

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    let offset = 0;
    while (offset < channel.length) {
      const take = Math.min(FRAME - this.filled, channel.length - offset);
      this.buffer.set(channel.subarray(offset, offset + take), this.filled);
      this.filled += take;
      offset += take;
      if (this.filled === FRAME) {
        const { features, spectrum } = analyzeFrame(this.buffer, sampleRate, this.spectrum);
        this.spectrum = spectrum;
        this.batch.push(...frameToArray(features));
        this.filled = 0;
        if (this.batch.length >= FRAMES_PER_MESSAGE * FEATURE_COUNT) {
          this.port.postMessage(this.batch);
          this.batch = [];
        }
      }
    }
    return true;
  }
}

registerProcessor("verilive-voice", VoiceFeatureProcessor);
