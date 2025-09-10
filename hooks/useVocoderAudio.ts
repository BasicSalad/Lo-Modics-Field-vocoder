import { useState, useRef, useEffect, useCallback } from 'react';
import { type VocoderParams, type RecordingState } from '../types';

/**
 * Converts an AudioBuffer to a WAV file Blob.
 * @param buffer The AudioBuffer to convert.
 * @returns A Blob representing the WAV file.
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  let pos = 0;

  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };

  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  // RIFF header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // fmt chunk
  setUint32(0x20746d66); // "fmt "
  setUint32(16); // chunk length
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit

  // data chunk
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4); // chunk length

  // Write interleaved PCM data
  const channels = [];
  for (let i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 0;
  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      // clamp and convert to 16-bit signed integer
      const sample = Math.max(-1, Math.min(1, channels[i][offset] || 0));
      view.setInt16(pos, sample < 0 ? sample * 32768 : sample * 32767, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([view], { type: 'audio/wav' });
}

// A base64 encoded WAV file of a person saying "Hello". Public Domain.
const SAMPLE_AUDIO_BASE64 = 'UklGRigCAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABgAAABkYXRhJgIAAP9/AIAAgQCEAIYAhwCJAIoAiwCNAI8AkQCTAJUAlwCZAJkAmgCcAJ4AogCiAKMApACmAKgAqgCsAK4AsACzALcAvQDCAMQAygDNANEA0wDXANkA2wDfAOMA5ADlAOcBAQIGAAYCCQIOAhQCFwIZAh0CIgIkAicCKQIsAjACNwI+AkMCSQJOAlMCSwJOAk4CUgJPAk8CTwJPAk4CTQJNAksCSQJH/v//AQMEBQYHCQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dZXV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dZXV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dY=';

const vocoderWorkletCode = `
const midi_to_hz = (n) => 2 ** ((n - 69) / 12) * 440;
const lerp = (a, b, t) => a + (b - a) * t;

class SVF {
    stages; mode; fc; q; num; _fc; _q; g; k; a1; a2; a3;
    constructor(opt) {
        this.stages = [];
        this.mode = opt?.mode || 'lp';
        this.num = opt?.num || 1;
        for(let i = 0; i < this.num; ++i) {
            this.stages.push({lp:0,bp:0,hp:0,ap:0,ic1eq:0,ic2eq:0});
        }
        this.q = opt?.q ?? 1;
        this.fc = opt?.fc ?? .25;
    }
    _clock(s, input, a1, a2, a3) {
        const v3 = input - s.ic2eq;
        const v1 = a1 * s.ic1eq + a2 * v3;
        const v2 = s.ic2eq + a2 * s.ic1eq + a3 * v3;
        s.ic1eq = 2 * v1 - s.ic1eq;
        s.ic2eq = 2 * v2 - s.ic2eq;
        s.lp = v2; s.bp = v1;
    }
    process(input) {
        if(this.fc !== this._fc || this.q !== this._q) {
            this._fc = this.fc;
            this._q = this.q;
            const fc = this.fc * 0.5;
            this.g = Math.tan(Math.PI * fc);
            this.k = 1 / this.q;
            this.a1 = 1 / (1 + this.g * (this.g + this.k));
            this.a2 = this.g * this.a1;
            this.a3 = this.g * this.a2;
        }
        for(let i = 0; i < this.num; ++i) {
            this._clock(this.stages[i], input, this.a1, this.a2, this.a3);
            this._clock(this.stages[i], input, this.a1, this.a2, this.a3);
            input = this.stages[i][this.mode];
        }
        return input;
    }
}

class EnvelopeFollower {
    a; y1;
    constructor(attack, release) {
        this.a = { attack, release };
        this.y1 = 0;
    }
    process(x) {
        const c = x > this.y1 ? this.a.attack : this.a.release;
        this.y1 = (1 - c) * this.y1 + c * x;
        return this.y1;
    }
}

class VocoderProcessor extends AudioWorkletProcessor {
  params; ditty; carrierSynth; bands;
  constructor() {
    super();
    this.params = { carrierNoise: 0.1, size: 0, speed: 1, pitch: 0.3 };
    this.ditty = { dt: 1 / sampleRate };
    
    this.carrierSynth = this.initCarrierSynth();
    this.bands = this.initBands();

    this.port.onmessage = (event) => {
        if (event.data.type === 'UPDATE_PARAMS') {
            this.params = event.data.params;
        }
    };
  }

  initCarrierSynth() {
    class Sy {
        ops; nunison; freq;
        constructor() {
            this.ops = [];
            this.nunison = 3;
            const amp = 1 / this.nunison;
            for(let i = 0; i < this.nunison; ++i) {
                const t = this.nunison > 1 ? i / (this.nunison-1) : .5;
                const semitn = (t * 2 - 1) * 0.1;
                this.ops.push({ p: Math.random(), detune: 2**(semitn/12) });
            }
        }
        process(that) {
            this.freq = midi_to_hz(40 + that.params.pitch) * that.ditty.dt;
            let val = 0;
            for(let i = 0; i < this.ops.length; ++i) {
                const op = this.ops[i];
                val += (op.p < 0.5 ? 1 : -1);
                op.p += this.freq * op.detune;
                op.p %= 1;
            }
            val /= this.ops.length;
            return lerp(val, Math.random()-.5, that.params.carrierNoise);
        }
    }
    return new Sy();
  }
  
  initBands() {
      const freqs = [123, 294, 481, 746, 1387, 2255, 3403, 4865];
      const bands = [];
      const attack = 0.005;
      const release = 0.02;
      for (let i = 0; i < freqs.length; i++) {
          bands.push({
              freq: freqs[i],
              modFilter: new SVF({ mode: 'bp', num: 2, q: 4 }),
              carrierFilter: new SVF({ mode: 'bp', num: 2, q: 4 }),
              envelopeFollower: new EnvelopeFollower(attack, release),
          });
      }
      return bands;
  }

  process(inputs, outputs) {
    const modulatorInput = inputs[0];
    const output = outputs[0];
    const leftChannel = output[0];
    const rightChannel = output.length > 1 ? output[1] : leftChannel;

    if (modulatorInput.length === 0 || modulatorInput[0].length === 0) {
        for (let i = 0; i < leftChannel.length; i++) {
            leftChannel[i] = 0;
            rightChannel[i] = 0;
        }
        return true;
    }
    const modulatorChannel = modulatorInput[0];

    for (let i = 0; i < leftChannel.length; i++) {
        const modulatorSample = modulatorChannel[i];
        const carrierSample = this.carrierSynth.process(this);
        let outSample = 0;

        for (const band of this.bands) {
            const fc = (2**this.params.size) * band.freq * this.ditty.dt;
            band.modFilter.fc = fc;
            band.carrierFilter.fc = fc;
            
            const modFiltered = band.modFilter.process(modulatorSample);
            const envelope = band.envelopeFollower.process(Math.abs(modFiltered));
            
            const carrierFiltered = band.carrierFilter.process(carrierSample);
            
            outSample += carrierFiltered * envelope;
        }
        
        const finalSample = outSample * 4; // Gain compensation
        leftChannel[i] = finalSample;
        rightChannel[i] = finalSample;
    }
    return true;
  }
}
registerProcessor('vocoder-processor', VocoderProcessor);
`;

const createWorklet = (context: AudioContext) => {
    const blob = new Blob([vocoderWorkletCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    return context.audioWorklet.addModule(url).then(() => url);
};

export const useVocoderAudio = (params: VocoderParams) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const contextRef = useRef<AudioContext | null>(null);
  const vocoderNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const recordedBufferRef = useRef<AudioBuffer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const workletUrlRef = useRef<string | null>(null);

  const setupAudioContext = useCallback(async () => {
    if (!contextRef.current) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        contextRef.current = audioContext;
        const url = await createWorklet(audioContext);
        workletUrlRef.current = url;
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        setAnalyserNode(analyser);
      } catch (e) {
        console.error("Error creating audio context or worklet", e);
      }
    }
    return contextRef.current;
  }, []);
  
  useEffect(() => {
    if (vocoderNodeRef.current) {
      vocoderNodeRef.current.port.postMessage({
        type: 'UPDATE_PARAMS',
        params,
      });
    }
    if(sourceNodeRef.current) {
        sourceNodeRef.current.playbackRate.setValueAtTime(params.speed, contextRef.current?.currentTime || 0);
    }
  }, [params]);


  const startRecording = useCallback(async () => {
    const context = await setupAudioContext();
    if (!context || recordingState === 'recording') return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
            stream.getTracks().forEach(track => track.stop());
            const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
            const arrayBuffer = await blob.arrayBuffer();
            recordedBufferRef.current = await context.decodeAudioData(arrayBuffer);
            setRecordingState('recorded');
        };

        recorder.start();
        setRecordingState('recording');
    } catch(err) {
        console.error("Microphone access denied or error:", err);
    }
  }, [recordingState, setupAudioContext]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
        mediaRecorderRef.current.stop();
    }
  }, [recordingState]);

  const togglePlayback = useCallback(async () => {
    const context = await setupAudioContext();
    if (!context) return;
    
    if (recordingState === 'playing') {
        context.suspend();
        setRecordingState('paused');
    } else if (recordingState === 'paused') {
        context.resume();
        setRecordingState('playing');
    } else if (recordingState === 'recorded' && recordedBufferRef.current) {
        if (context.state === 'suspended') {
            await context.resume();
        }

        if (sourceNodeRef.current) {
          sourceNodeRef.current.disconnect();
        }
        if (!vocoderNodeRef.current) {
            vocoderNodeRef.current = new AudioWorkletNode(context, 'vocoder-processor');
            vocoderNodeRef.current.connect(analyserNode!).connect(context.destination);
             vocoderNodeRef.current.port.postMessage({ type: 'UPDATE_PARAMS', params });
        }
       
        const sourceNode = context.createBufferSource();
        sourceNode.buffer = recordedBufferRef.current;
        sourceNode.loop = true;
        sourceNode.playbackRate.value = params.speed;
        sourceNode.connect(vocoderNodeRef.current);
        sourceNode.start();
        
        sourceNodeRef.current = sourceNode;
        setRecordingState('playing');
    }
  }, [recordingState, setupAudioContext, analyserNode, params]);

  const resetRecording = useCallback(async () => {
    if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
    }
    if (recordingState === 'playing' || recordingState === 'paused') {
      if(contextRef.current && contextRef.current.state === 'running') {
         await contextRef.current.suspend();
      }
    }
    recordedBufferRef.current = null;
    setRecordingState('idle');
  }, [recordingState]);

  const loadSample = useCallback(async () => {
    const context = await setupAudioContext();
    if (!context) return;
    
    await resetRecording();
    
    try {
      if (context.state === 'suspended') {
        await context.resume();
      }
      const response = await fetch(`data:audio/wav;base64,${SAMPLE_AUDIO_BASE64}`);
      const arrayBuffer = await response.arrayBuffer();
      recordedBufferRef.current = await context.decodeAudioData(arrayBuffer);
      setRecordingState('recorded');
    } catch (error) {
      console.error("Failed to load or decode sample audio:", error);
      setRecordingState('idle'); 
    }
  }, [setupAudioContext, resetRecording]);
  
  const renderAndDownload = useCallback(async () => {
    if (!recordedBufferRef.current) {
        console.error("No recorded audio available to download.");
        return;
    }
    
    await setupAudioContext();
    
    if (!workletUrlRef.current) {
        console.error("Worklet is not ready for offline rendering.");
        return;
    }

    const recordedBuffer = recordedBufferRef.current;
    const offlineContext = new OfflineAudioContext(
        recordedBuffer.numberOfChannels,
        recordedBuffer.length,
        recordedBuffer.sampleRate
    );

    await offlineContext.audioWorklet.addModule(workletUrlRef.current);

    const sourceNode = offlineContext.createBufferSource();
    sourceNode.buffer = recordedBuffer;
    sourceNode.playbackRate.value = params.speed;

    const vocoderNode = new AudioWorkletNode(offlineContext, 'vocoder-processor');
    vocoderNode.port.postMessage({ type: 'UPDATE_PARAMS', params });

    sourceNode.connect(vocoderNode);
    vocoderNode.connect(offlineContext.destination);

    sourceNode.start(0);
    const renderedBuffer = await offlineContext.startRendering();

    const wavBlob = audioBufferToWav(renderedBuffer);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'lo-modics-output.wav';
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
        window.URL.revokeObjectURL(url);
        a.remove();
    }, 100);

  }, [params, setupAudioContext]);


  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (workletUrlRef.current) URL.revokeObjectURL(workletUrlRef.current);
      if (contextRef.current) contextRef.current.close();
    };
  }, []);

  return { recordingState, startRecording, stopRecording, togglePlayback, analyserNode, resetRecording, renderAndDownload, loadSample };
};