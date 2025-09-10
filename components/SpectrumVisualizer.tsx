import React, { useRef, useEffect } from 'react';
import type { RecordingState } from '../types';

interface SpectrumVisualizerProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
  recordingState: RecordingState;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const SpectrumVisualizer: React.FC<SpectrumVisualizerProps> = ({ analyserNode, isPlaying, recordingState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mRef = useRef(2); // Chladni parameter m
  const nRef = useRef(3); // Chladni parameter n
  const rotationRef = useRef(0); // For continuous rotation

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use a higher resolution for the canvas for crisp lines, maintaining a 4:1 ratio
    const width = 512;
    const height = 128; // 512 / 4
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 0;
    const dataArray = analyserNode ? new Uint8Array(bufferLength) : new Uint8Array(0);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      const now = Date.now();

      // Base drawing: always start with a black background
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);

      if (recordingState === 'recording') {
        if (analyserNode) {
            analyserNode.getByteFrequencyData(dataArray);

            const volume = dataArray.reduce((s, v) => s + v, 0) / bufferLength;

            const centerX = width / 2;
            const centerY = height / 2;
            const numDots = 4;
            const dotSpacing = 30;
            const totalWidth = (numDots - 1) * dotSpacing;
            const startX = centerX - totalWidth / 2;

            for (let i = 0; i < numDots; i++) {
                const x = startX + i * dotSpacing;

                const baseRadius = 5;
                const maxRadiusIncrease = 7;
                // Make animation more sensitive to sound
                const radius = baseRadius + (volume / 200) * maxRadiusIncrease;
                
                // Add a subtle individual pulse
                const pulse = (Math.sin((now / 250) + i) + 1) / 2;
                const finalRadius = lerp(radius * 0.8, radius, pulse);

                const opacity = 0.5 + (volume / 255) * 0.5;

                ctx.fillStyle = `rgba(220, 38, 38, ${opacity})`; // Tailwind red-600 like color
                ctx.beginPath();
                ctx.arc(x, centerY, finalRadius, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
      } else if (analyserNode && isPlaying) {
        analyserNode.getByteFrequencyData(dataArray);

        // Map audio data to Chladni parameters (m, n)
        const lowSlice = dataArray.slice(1, Math.floor(bufferLength * 0.1));
        const highSlice = dataArray.slice(Math.floor(bufferLength * 0.1), Math.floor(bufferLength * 0.4));
        
        const lowAvg = lowSlice.length > 0 ? lowSlice.reduce((s, v) => s + v, 0) / lowSlice.length : 0;
        const highAvg = highSlice.length > 0 ? highSlice.reduce((s, v) => s + v, 0) / highSlice.length : 0;
        
        const targetM = 1 + (lowAvg / 255) * 7;
        const targetN = 1 + (highAvg / 255) * 7;

        mRef.current = lerp(mRef.current, targetM, 0.1);
        nRef.current = lerp(nRef.current, targetN, 0.1);

        const m = mRef.current;
        const n = nRef.current;
        
        const amplitude = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

        const rotationSpeed = (amplitude / 255) * 0.02;
        rotationRef.current += rotationSpeed;
        const angle = rotationRef.current;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        
        const imageData = ctx.createImageData(width, height);
        const pixelData = imageData.data;

        const threshold = 0.025; // Controls line thickness
        
        const baseBrightness = Math.min(255, amplitude * 2.5);

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const nx_base = (x / (width - 1)) * 2 - 1;
            const ny_base = (y / (height - 1)) * 2 - 1;
            const index = (y * width + x) * 4;

            const nx = nx_base * cosA - ny_base * sinA;
            const ny = nx_base * sinA + ny_base * cosA;

            const val = Math.cos(n * Math.PI * nx) * Math.cos(m * Math.PI * ny) -
                        Math.cos(m * Math.PI * nx) * Math.cos(n * Math.PI * ny);

            let r = 0, g = 0, b = 0;

            if (Math.abs(val) < threshold) {
                g = baseBrightness; // Set to green for a "scan screen" look
            }

            pixelData[index]     = r;
            pixelData[index + 1] = g;
            pixelData[index + 2] = b;
            pixelData[index + 3] = 255;
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
      }

      // Draw grid overlay on top of everything
      const gridSize = 20;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Vertical lines
      for (let x = 0; x <= width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      // Horizontal lines
      for (let y = 0; y <= height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isPlaying, recordingState]);

  return (
    <canvas ref={canvasRef} className="w-full h-full" />
  );
};
