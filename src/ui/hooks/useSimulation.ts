import { useEffect, useRef, useState, useCallback } from 'react';
import { GPUContext } from '../../gpu/device';
import { MainLoop } from '../../core/loop';
import { DEFAULT_CONFIG, SimulationConfig } from '../../config/defaults';
import { SpeedMultiplier } from '../../core/types';

export function useSimulation(gpu: GPUContext | null) {
  const loopRef = useRef<MainLoop | null>(null);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [fps, setFps] = useState(0);
  const [speed, setSpeed] = useState<SpeedMultiplier>(SpeedMultiplier.Normal);
  const [seed, setSeed] = useState(DEFAULT_CONFIG.seed);

  useEffect(() => {
    if (!gpu) return;

    const config: SimulationConfig = { ...DEFAULT_CONFIG, seed };
    const loop = new MainLoop(gpu, config);
    loopRef.current = loop;

    loop.init().then(() => {
      setReady(true);
      loop.start();
    });

    // UI tick to update React state
    const uiInterval = setInterval(() => {
      if (loopRef.current) {
        setTick(loopRef.current.currentTick);
        setFps(loopRef.current.fps);
      }
    }, 125); // ~8Hz

    return () => {
      clearInterval(uiInterval);
      loop.stop();
      loopRef.current = null;
    };
  }, [gpu, seed]);

  const changeSpeed = useCallback((s: SpeedMultiplier) => {
    setSpeed(s);
    loopRef.current?.setSpeed(s);
  }, []);

  const reseed = useCallback((newSeed: number) => {
    loopRef.current?.stop();
    loopRef.current = null;
    setReady(false);
    setSeed(newSeed);
  }, []);

  const resize = useCallback((width: number, height: number) => {
    loopRef.current?.resize(width, height);
  }, []);

  return { ready, tick, fps, speed, seed, changeSpeed, reseed, resize };
}
