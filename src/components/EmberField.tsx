import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { useRitual } from '../ritual/RitualContext';

type EmberStyle = CSSProperties & {
  '--ember-x': string;
  '--ember-size': string;
  '--ember-duration': string;
  '--ember-delay': string;
  '--ember-drift': string;
  '--ember-opacity': string;
  '--ember-blur': string;
};

function seededValue(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export default function EmberField() {
  const { pathname } = useLocation();
  const { guttering } = useRitual();
  // Keep the landing page exactly as it was. Interior pages now use twice the embers.
  const count = pathname === '/' ? 72 : 144;
  const embers = useMemo(() => Array.from({ length: count }, (_, index) => {
    const x = seededValue(index + 1) * 100;
    const size = 1.1 + seededValue(index + 41) * 2.5;
    const duration = 10 + seededValue(index + 81) * 13;
    const delay = -(seededValue(index + 121) * duration);
    const drift = -55 + seededValue(index + 161) * 110;
    const opacity = 0.22 + seededValue(index + 201) * 0.48;
    const blur = seededValue(index + 241) > 0.72 ? 1.1 : 0;

    const style: EmberStyle = {
      '--ember-x': `${x.toFixed(2)}vw`,
      '--ember-size': `${size.toFixed(2)}px`,
      '--ember-duration': `${duration.toFixed(2)}s`,
      '--ember-delay': `${delay.toFixed(2)}s`,
      '--ember-drift': `${drift.toFixed(2)}px`,
      '--ember-opacity': opacity.toFixed(2),
      '--ember-blur': `${blur}px`,
    };

    return <i className="ambient-ember" style={style} key={index} />;
  }), [count]);

  return <div className={`ambient-embers${guttering ? ' is-guttering' : ''}`} aria-hidden="true">{embers}</div>;
}
