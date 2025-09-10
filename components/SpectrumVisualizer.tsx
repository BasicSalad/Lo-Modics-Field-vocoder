import React, { useRef, useEffect } from 'react';

interface SpectrumVisualizerProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const SpectrumVisualizer: React.FC<SpectrumVisualizerProps> = ({ analyserNode, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mRef = useRef(2); // Chladni parameter m
  const nRef = useRef(3); // Chladni parameter n
  const lastActiveTimeRef = useRef(Date.now());
  const rotationRef = useRef(0); // For continuous rotation

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) return;

    // Use a higher resolution for the canvas for crisp lines, maintaining a 4:1 ratio
    const width = 512;
    const height = 128; // 512 / 4
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      const now = Date.now();
      if (isPlaying) {
        lastActiveTimeRef.current = now;
      }
      
      const timeSinceActive = now - lastActiveTimeRef.current;
      const decay = Math.max(0, 1 - timeSinceActive / 800); // Fade out over 800ms

      analyserNode.getByteFrequencyData(dataArray);

      // Map audio data to Chladni parameters (m, n)
      const lowSlice = dataArray.slice(1, Math.floor(bufferLength * 0.1));
      const highSlice = dataArray.slice(Math.floor(bufferLength * 0.1), Math.floor(bufferLength * 0.4));
      
      const lowAvg = lowSlice.length > 0 ? lowSlice.reduce((s, v) => s + v, 0) / lowSlice.length : 0;
      const highAvg = highSlice.length > 0 ? highSlice.reduce((s, v) => s + v, 0) / highSlice.length : 0;
      
      const targetM = 1 + (lowAvg / 255) * 7;
      const targetN = 1 + (highAvg / 255) * 7;

      // Increased lerp factor for faster transitions
      mRef.current = lerp(mRef.current, targetM, 0.1);
      nRef.current = lerp(nRef.current, targetN, 0.1);

      const m = mRef.current;
      const n = nRef.current;
      
      const amplitude = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

      // Update rotation based on amplitude
      const rotationSpeed = (amplitude / 255) * 0.02;
      rotationRef.current += rotationSpeed;
      const angle = rotationRef.current;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      
      const imageData = ctx.getImageData(0, 0, width, height);
      const pixelData = imageData.data;

      const threshold = 0.025; // Controls line thickness

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const nx_base = (x / (width - 1)) * 2 - 1;
          const ny_base = (y / (height - 1)) * 2 - 1;
          const index = (y * width + x) * 4;

          // Apply rotation to coordinates
          const nx = nx_base * cosA - ny_base * sinA;
          const ny = nx_base * sinA + ny_base * cosA;

          const baseBrightness = Math.min(255, (amplitude * 2.5) * decay);
          
          // Calculate a single Chladni value for a monochrome pattern
          const val = Math.cos(n * Math.PI * nx) * Math.cos(m * Math.PI * ny) -
                      Math.cos(m * Math.PI * nx) * Math.cos(n * Math.PI * ny);

          let r = 0, g = 0, b = 0;

          // If the value is within the threshold, set all color channels to the brightness
          if (Math.abs(val) < threshold) {
              r = baseBrightness;
              g = baseBrightness;
              b = baseBrightness;
          }

          pixelData[index]     = r;
          pixelData[index + 1] = g;
          pixelData[index + 2] = b;
          pixelData[index + 3] = 255; // Alpha
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isPlaying]);

  return (
    <canvas ref={canvasRef} className="w-full h-full" />
  );
};