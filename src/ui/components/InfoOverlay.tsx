interface Props {
  tick: number;
  seed: number;
}

export function InfoOverlay({ tick, seed }: Props) {
  const yearProgress = (tick % 12000) / 12000;
  const solarAngle = Math.sin(yearProgress * 2 * Math.PI) * 0.8 + 0.5;
  const dayLength = (0.5 + 0.2 * Math.sin(yearProgress * 2 * Math.PI)) * 24;
  const temp = 20 + 15 * Math.sin(yearProgress * 2 * Math.PI - Math.PI / 4);

  return (
    <div className="info-overlay">
      <div className="info-item">
        <label>Temperature</label>
        <span>{temp.toFixed(1)}C</span>
      </div>
      <div className="info-item">
        <label>Solar Angle</label>
        <span>{(solarAngle * 90).toFixed(0)}&deg;</span>
      </div>
      <div className="info-item">
        <label>Day Length</label>
        <span>{dayLength.toFixed(1)}h</span>
      </div>
      <div className="info-item">
        <label>Year</label>
        <span>{Math.floor(tick / 12000) + 1}</span>
      </div>
    </div>
  );
}
