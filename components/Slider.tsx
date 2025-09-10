import React from 'react';

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  color: string;
}

/**
 * Darkens a hex color by a given percentage.
 * @param hex The hex color string (e.g., "#RRGGBB").
 * @param percent The percentage to darken by (0-100).
 * @returns The darkened hex color string.
 */
const darkenColor = (hex: string, percent: number): string => {
  let color = hex.startsWith('#') ? hex.slice(1) : hex;
  const num = parseInt(color, 16);
  
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;

  const factor = 1 - percent / 100;
  r = Math.round(r * factor);
  g = Math.round(g * factor);
  b = Math.round(b * factor);

  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));

  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};


export const Slider: React.FC<SliderProps> = ({ label, min, max, step, value, onChange, color }) => {
  const percentage = ((value - min) / (max - min)) * 100;
  const thumbColor = darkenColor(color, 15);

  return (
    <div
      className="w-full flex flex-col space-y-2 text-black select-none"
      style={{
        '--slider-color': color,
        '--slider-thumb-color': thumbColor,
      } as React.CSSProperties}
    >
      <div className="flex justify-between items-baseline">
        <label className="font-bold text-xs uppercase tracking-wider">{label}</label>
        <span className="text-sm font-mono bg-black/10 px-2 rounded">{value.toFixed(2)}</span>
      </div>
      <div className="relative w-full flex items-center h-8">
        <div
            className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              width: `calc(${percentage}% + ${(50 - percentage) * 0.22}px)`, // Thumb offset correction for 22px thumb
              backgroundColor: 'var(--slider-color)',
            }}
        ></div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="relative z-10 w-full h-2 bg-transparent appearance-none cursor-pointer custom-slider"
          aria-label={label}
        />
      </div>
      <style>{`
        .custom-slider {
          --thumb-size: 22px;
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
          background-color: var(--slider-thumb-color);
          border-radius: 9999px;
          border: 2px solid #1a1a1a;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          cursor: grab;
        }

        .custom-slider:active::-webkit-slider-thumb {
            cursor: grabbing;
        }

        .custom-slider::-moz-range-thumb {
          width: var(--thumb-size);
          height: var(--thumb-size);
          background-color: var(--slider-thumb-color);
          border-radius: 9999px;
          border: 2px solid #1a1a1a;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          cursor: grab;
        }
        
        .custom-slider:active::-moz-range-thumb {
            cursor: grabbing;
        }
      `}</style>
    </div>
  );
};