import { useState, useEffect } from 'react';
import { useWebGPU } from './ui/hooks/useWebGPU';
import { useSimulation } from './ui/hooks/useSimulation';
import { ControlPanel } from './ui/components/ControlPanel';
import { InfoOverlay } from './ui/components/InfoOverlay';
import { DebugPanel } from './ui/components/DebugPanel';
import { DebugLayerId } from './core/types';

export function App() {
  const { canvasRef, gpu, error } = useWebGPU();
  const { ready, tick, fps, speed, seed, changeSpeed, reseed, resize } = useSimulation(gpu);
  const [debugLayer, setDebugLayer] = useState<DebugLayerId>(DebugLayerId.None);
  const [showDebug, setShowDebug] = useState(false);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      resize(canvas.width, canvas.height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'd') setShowDebug(v => !v);
      if (e.key === ' ') {
        e.preventDefault();
        changeSpeed(speed === 0 ? 1 : 0);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [speed, changeSpeed]);

  if (error) {
    return (
      <div className="unsupported">
        <h1>WebGPU Not Available</h1>
        <p>{error}</p>
        <p>This application requires a WebGPU-capable browser.</p>
        <p>Try Chrome 113+, Edge 113+, or Firefox Nightly with WebGPU enabled.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <canvas ref={canvasRef} className="main-canvas" />

      {ready && (
        <>
          <ControlPanel
            speed={speed}
            tick={tick}
            fps={fps}
            seed={seed}
            onSpeedChange={changeSpeed}
            onReseed={reseed}
          />
          <InfoOverlay tick={tick} seed={seed} />
          {showDebug && (
            <DebugPanel activeLayer={debugLayer} onLayerChange={setDebugLayer} />
          )}
          <div className="hint">Press D for debug | Space to pause</div>
        </>
      )}

      {!ready && !error && (
        <div className="loading">
          <p>Initializing simulation...</p>
        </div>
      )}
    </div>
  );
}

export default App;
