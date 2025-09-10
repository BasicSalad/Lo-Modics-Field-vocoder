import React, { useState, useCallback } from 'react';
import { type VocoderParams, type RecordingState } from './types';
import { useVocoderAudio } from './hooks/useVocoderAudio';
import { PlayIcon, MicrophoneIcon, StopIcon, ResetIcon, DiceIcon, DownloadIcon } from './components/Icon';
import { SpectrumVisualizer } from './components/SpectrumVisualizer';
import { Slider } from './components/Slider';

const defaultParams: VocoderParams = {
    carrierNoise: 0.3,
    size: 0.2,
    speed: 1,
    pitch: -5,
};

const sliderRanges = {
    carrierNoise: { min: 0, max: 1 },
    size: { min: -2, max: 2 },
    speed: { min: 0.1, max: 2 },
    pitch: { min: -24, max: 24 },
};

const sliderColors = {
    pitch: '#ef4444',      // red-500
    size: '#22c55e',       // green-500
    carrierNoise: '#3b82f6', // blue-500
    speed: '#facc15',      // yellow-400
    dice: '#f97316',       // orange-500
};

const App: React.FC = () => {
  const [params, setParams] = useState<VocoderParams>(defaultParams);
  const [isRendering, setIsRendering] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [diceButtonColor, setDiceButtonColor] = useState(sliderColors.dice);

  const { 
    recordingState, 
    startRecording, 
    stopRecording, 
    togglePlayback,
    analyserNode,
    resetRecording,
    renderAndDownload,
    loadSample,
  } = useVocoderAudio(params);
  
  const handleParamChange = useCallback((param: keyof VocoderParams, value: number) => {
    setParams(prevParams => ({
      ...prevParams,
      [param]: value,
    }));
  }, []);

  const randomizeParams = useCallback(() => {
    setIsRandomizing(true);
    const newParams: VocoderParams = {
        carrierNoise: Math.random() * (sliderRanges.carrierNoise.max - sliderRanges.carrierNoise.min) + sliderRanges.carrierNoise.min,
        size: Math.random() * (sliderRanges.size.max - sliderRanges.size.min) + sliderRanges.size.min,
        speed: Math.random() * (sliderRanges.speed.max - sliderRanges.speed.min) + sliderRanges.speed.min,
        pitch: Math.random() * (sliderRanges.pitch.max - sliderRanges.pitch.min) + sliderRanges.pitch.min,
    };
    setParams(newParams);

    const colorCycle = [sliderColors.pitch, sliderColors.size, sliderColors.carrierNoise, sliderColors.speed];
    
    colorCycle.forEach((color, index) => {
        setTimeout(() => {
            setDiceButtonColor(color);
        }, index * 100);
    });

    setTimeout(() => {
        setDiceButtonColor(sliderColors.dice);
        setIsRandomizing(false);
    }, colorCycle.length * 100);
  }, []);
  
  const handleDownload = useCallback(async () => {
    if (recordingState === 'playing') {
      togglePlayback();
    }
    setIsRendering(true);
    try {
      await renderAndDownload();
    } catch (error) {
      console.error("Failed to render and download audio:", error);
    } finally {
      setIsRendering(false);
    }
  }, [renderAndDownload, recordingState, togglePlayback]);

  const canReset = ['recorded', 'playing'].includes(recordingState);

  const handlePlaybackToggle = useCallback(async () => {
    if (recordingState === 'recording') return;

    if (canReset) {
        togglePlayback();
    } else {
        await loadSample(true); // Autoplay
    }
  }, [recordingState, canReset, togglePlayback, loadSample]);

  const isPlaying = recordingState === 'playing';
  
  const getMainButtonContent = () => {
    switch (recordingState) {
      case 'idle':
        return { 
            icon: <MicrophoneIcon />, 
            action: startRecording, 
            aria: 'Start recording',
            className: 'bg-red-600 hover:bg-red-500 text-white',
            disabled: false,
        };
      case 'recording':
        return { 
            icon: <StopIcon />, 
            action: stopRecording, 
            aria: 'Stop recording',
            className: 'bg-red-600 hover:bg-red-500 text-white animate-record-pulse-glow',
            disabled: false,
        };
      case 'recorded':
      case 'playing':
        return { 
            icon: <MicrophoneIcon />, 
            action: () => {}, 
            aria: 'Microphone disabled. Press Reset to start a new recording.',
            className: 'bg-red-600 disabled:hover:bg-red-600',
            disabled: true,
        };
      default: // Should not happen
        return { 
            icon: <MicrophoneIcon />, 
            action: () => {}, 
            aria: 'Microphone disabled',
            className: 'bg-gray-800',
            disabled: true,
        };
    }
  };

  const getPlaybackButtonContent = () => {
    const baseClasses = 'bg-teal-600 hover:bg-teal-500';
    if (recordingState === 'playing') {
        return {
            icon: <StopIcon />,
            aria: 'Stop playback',
            className: baseClasses,
        };
    }
    return {
        icon: <PlayIcon />,
        aria: canReset ? 'Play audio' : 'Load and play sample',
        className: baseClasses,
    };
  };

  const mainButton = getMainButtonContent();
  const playbackButton = getPlaybackButtonContent();
  const mainButtonBaseClasses = "w-20 h-20 rounded-lg flex items-center justify-center shadow-lg transition-all duration-200 ease-in-out transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:w-10 [&_svg]:h-10";
  const sideButtonBaseClasses = "w-16 h-16 rounded-lg text-white flex items-center justify-center shadow-lg transition-all duration-200 ease-in-out transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:w-8 [&_svg]:h-8";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b-2 border-black/20 bg-[#D9D9D9]">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
            <h1 className="text-3xl font-black text-black tracking-tighter">
                LO-MODICS
            </h1>
            <div className="flex flex-col items-end">
                <h2 className="text-sm font-bold tracking-widest text-black/90">
                    FIELD VOCODER
                </h2>
                <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                </div>
            </div>
        </div>
      </header>
      
      <main className="bg-white p-4 flex-grow">
        <div className="w-full max-w-2xl mx-auto">
          <div className="w-full aspect-[4/1] bg-black rounded-md mb-4 overflow-hidden shadow-inner">
            <SpectrumVisualizer analyserNode={analyserNode} isPlaying={isPlaying} recordingState={recordingState} />
          </div>

          <div className="flex items-center justify-center gap-6 mb-6">
            <button
              onClick={resetRecording}
              disabled={!canReset && recordingState !== 'idle'}
              className={`${sideButtonBaseClasses} bg-blue-600 hover:bg-blue-500 disabled:hover:bg-blue-600`}
              aria-label="Clear recording"
            >
              <ResetIcon />
            </button>
            <button
              onClick={mainButton.action}
              disabled={mainButton.disabled}
              className={`${mainButtonBaseClasses} ${mainButton.className}`}
              aria-label={mainButton.aria}
            >
              {mainButton.icon}
            </button>
            <button
              onClick={handlePlaybackToggle}
              disabled={recordingState === 'recording'}
              className={`${mainButtonBaseClasses} ${playbackButton.className}`}
              aria-label={playbackButton.aria}
            >
                {playbackButton.icon}
            </button>
            <button
              onClick={randomizeParams}
              disabled={isRandomizing}
              style={{ backgroundColor: diceButtonColor }}
              className={`${sideButtonBaseClasses} transition-colors duration-100 ease-in-out hover:brightness-95`}
              aria-label="Randomize sound settings"
            >
              <DiceIcon />
            </button>
          </div>

          <div className="bg-black/10 p-4 rounded-lg shadow-inner">
            <div className="text-center mb-4">
                <h3 className="text-sm font-bold text-black uppercase tracking-widest">Voice Character</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <Slider
                  label="Pitch"
                  min={sliderRanges.pitch.min}
                  max={sliderRanges.pitch.max}
                  step={0.1}
                  value={params.pitch}
                  onChange={(value) => handleParamChange('pitch', value)}
                  color={sliderColors.pitch}
                />
                <Slider
                  label="Formant"
                  min={sliderRanges.size.min}
                  max={sliderRanges.size.max}
                  step={0.01}
                  value={params.size}
                  onChange={(value) => handleParamChange('size', value)}
                  color={sliderColors.size}
                />
                <Slider
                  label="Robot"
                  min={sliderRanges.carrierNoise.min}
                  max={sliderRanges.carrierNoise.max}
                  step={0.01}
                  value={params.carrierNoise}
                  onChange={(value) => handleParamChange('carrierNoise', value)}
                  color={sliderColors.carrierNoise}
                />
                <Slider
                  label="Speed"
                  min={sliderRanges.speed.min}
                  max={sliderRanges.speed.max}
                  step={0.01}
                  value={params.speed}
                  onChange={(value) => handleParamChange('speed', value)}
                  color={sliderColors.speed}
                />
            </div>
          </div>
          
          <div className="mt-6">
            <button
              onClick={handleDownload}
              disabled={!canReset || isRendering}
              className={`w-full h-12 rounded-md text-white flex items-center justify-center gap-2 font-bold tracking-wider shadow-md transition-all duration-200 ease-in-out transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 hover:bg-green-500 disabled:hover:bg-green-600`}
              aria-label="Download manipulated sound"
            >
              {isRendering ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Rendering...
                </>
              ) : (
                <>
                  <DownloadIcon />
                  Download Audio
                </>
              )}
            </button>
            <p className="text-center text-xs text-black/50 mt-2">
              App Design by Basic_Salad
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;