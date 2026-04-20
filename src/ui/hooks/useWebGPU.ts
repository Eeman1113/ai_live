import { useEffect, useRef, useState } from 'react';
import { GPUContext, initWebGPU } from '../../gpu/device';

export function useWebGPU() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gpu, setGpu] = useState<GPUContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;

    initWebGPU(canvas).then((ctx) => {
      if (ctx) {
        setGpu(ctx);
      } else {
        setError('WebGPU is not supported in this browser. Please use Chrome 113+ or Edge 113+.');
      }
    }).catch((e) => {
      setError(`Failed to initialize WebGPU: ${e.message}`);
    });
  }, []);

  return { canvasRef, gpu, error };
}
