import React from 'react';

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

export const Slider: React.FC<SliderProps> = ({ label, min, max, step, value, onChange }) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="w-full flex flex-col space-y-2 text-black select-none">
      <div className="flex justify-between items-baseline">
        <label className="font-bold text-xs uppercase tracking-wider">{label}</label>
        <span className="text-sm font-mono bg-black/10 px-2 rounded">{value.toFixed(2)}</span>
      </div>
      <div className="relative w-full flex items-center h-8">
        <div 
            className="absolute top-1/2 left-0 h-2 -translate-y-1/2 bg-gray-800/50 rounded-full pointer-events-none"
            style={{ width: `calc(${percentage}% + ${(50 - percentage) * 0.16}px)`}} // Thumb offset correction
        ></div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-transparent appearance-none cursor-pointer custom-slider"
          aria-label={label}
        />
      </div>
      <style>{`
        .custom-slider {
          --thumb-size: 16px;
          --track-height: 8px;
        }

        .custom-slider::-webkit-slider-runnable-track {
          width: 100%;
          height: var(--track-height);
          background: rgba(0, 0, 0, 0.2);
          border-radius: 9999px;
        }

        .custom-slider::-moz-range-track {
          width: 100%;
          height: var(--track-height);
          background: rgba(0, 0, 0, 0.2);
          border-radius: 9999px;
        }

        .custom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          margin-top: calc((var(--track-height) - var(--thumb-size)) / 2);
          width: var(--thumb-size);
          height: var(--thumb-size);
          background-color: #2d2d2d;
          border-radius: 9999px;
          border: 1px solid #1a1a1a;
          box-shadow: 0 1px 2px rgba(0,0,0,0.5);
          cursor: grab;
        }

        .custom-slider:active::-webkit-slider-thumb {
            cursor: grabbing;
        }

        .custom-slider::-moz-range-thumb {
          width: var(--thumb-size);
          height: var(--thumb-size);
          background-color: #2d2d2d;
          border-radius: 9999px;
          border: 1px solid #1a1a1a;
          box-shadow: 0 1px 2px rgba(0,0,0,0.5);
          cursor: grab;
        }
        
        .custom-slider:active::-moz-range-thumb {
            cursor: grabbing;
        }
      `}</style>
    </div>
  );
};