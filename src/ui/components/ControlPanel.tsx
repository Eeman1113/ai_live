import { SpeedMultiplier } from '../../core/types';

interface Props {
  speed: SpeedMultiplier;
  tick: number;
  fps: number;
  seed: number;
  onSpeedChange: (s: SpeedMultiplier) => void;
  onReseed: (seed: number) => void;
}

const SPEEDS = [
  { label: '⏸', value: SpeedMultiplier.Paused },
  { label: '0.25x', value: SpeedMultiplier.Quarter },
  { label: '1x', value: SpeedMultiplier.Normal },
  { label: '4x', value: SpeedMultiplier.Fast },
  { label: '16x', value: SpeedMultiplier.Ultra },
];

export function ControlPanel({ speed, tick, fps, seed, onSpeedChange, onReseed }: Props) {
  const yearProgress = (tick % 12000) / 12000;
  const season = yearProgress < 0.25 ? 'Spring' : yearProgress < 0.5 ? 'Summer' : yearProgress < 0.75 ? 'Autumn' : 'Winter';
  const day = Math.floor((tick / 12000) * 365) % 365;

  return (
    <div className="control-panel">
      <div className="controls-row">
        {SPEEDS.map(s => (
          <button
            key={s.value}
            className={`speed-btn ${speed === s.value ? 'active' : ''}`}
            onClick={() => onSpeedChange(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="info-row">
        <span>Tick: {tick}</span>
        <span>Day {day} | {season}</span>
        <span>{fps} FPS</span>
      </div>
      <div className="seed-row">
        <span>Seed: {seed}</span>
        <button onClick={() => onReseed(Math.floor(Math.random() * 999999))}>
          Reseed
        </button>
      </div>
    </div>
  );
}
