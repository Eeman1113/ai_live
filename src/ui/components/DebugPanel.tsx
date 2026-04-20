import { DebugLayerId } from '../../core/types';

interface Props {
  activeLayer: DebugLayerId;
  onLayerChange: (layer: DebugLayerId) => void;
}

const LAYERS = [
  { id: DebugLayerId.None, label: 'None' },
  { id: DebugLayerId.SoilMoisture, label: 'Soil Moisture' },
  { id: DebugLayerId.Temperature, label: 'Temperature' },
  { id: DebugLayerId.CloudDensity, label: 'Clouds' },
  { id: DebugLayerId.WindVectors, label: 'Wind' },
  { id: DebugLayerId.LightAvailability, label: 'Light' },
  { id: DebugLayerId.Nutrients, label: 'Nutrients' },
];

export function DebugPanel({ activeLayer, onLayerChange }: Props) {
  return (
    <div className="debug-panel">
      <h4>Debug Layers</h4>
      <div className="debug-buttons">
        {LAYERS.map(l => (
          <button
            key={l.id}
            className={`debug-btn ${activeLayer === l.id ? 'active' : ''}`}
            onClick={() => onLayerChange(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
