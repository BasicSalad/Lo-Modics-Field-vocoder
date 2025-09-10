
export interface VocoderParams {
  carrierNoise: number;
  size: number;
  speed: number;
  pitch: number;
}

export type RecordingState = 'idle' | 'recording' | 'recorded' | 'playing';