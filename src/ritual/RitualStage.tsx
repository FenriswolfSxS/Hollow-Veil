import { type CSSProperties } from 'react';
import { useRitual } from './RitualContext';

/* Deterministic scatter, so the dark is always the same dark. */
function noise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

/* Haunting eyes appear everywhere. */
const EYES = Array.from({ length: 58 }, (_, index) => ({
  left: 2 + noise(index + 11) * 96,
  top: 4 + noise(index + 53) * 92,
  scale: 0.45 + noise(index + 97) * 1.15,
  delay: noise(index + 149) * 3.2,
  blink: 3.4 + noise(index + 199) * 6.5,
  tilt: -14 + noise(index + 251) * 28,
  warm: noise(index + 307) > 0.68,
}));

/* Things that walk past during the song's procession. */
const MARCHERS = Array.from({ length: 9 }, (_, index) => ({
  height: 26 + noise(index + 13) * 42,
  bottom: -4 + noise(index + 61) * 20,
  duration: 26 + noise(index + 103) * 30,
  delay: -noise(index + 157) * 40,
  opacity: 0.18 + noise(index + 211) * 0.42,
  blur: noise(index + 263) * 3.2,
  flip: noise(index + 317) > 0.5,
}));

export default function RitualStage() {
  const { phase, progress, flashing, sealed, movement, shaking, abort } = useRitual();

  const className = [
    'veil-stage',
    sealed ? 'is-sealed' : '',
    flashing ? 'is-flashing' : '',
    shaking ? 'is-shaking' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      data-phase={phase}
      data-progress={progress}
      data-movement={movement}
      aria-hidden={!sealed}
    >
      {/* Each answered line pulls more light out of the room. */}
      <span className="vs-gloom" />
      <span className="vs-flash" />

      {/* Absolute black. Nothing behind this. */}
      <span className="vs-void" />

      <div className="vs-eyes">
        {EYES.map((eye, index) => (
          <span
            key={index}
            className={`vs-eye${eye.warm ? ' is-warm' : ''}`}
            style={{
              left: `${eye.left}%`,
              top: `${eye.top}%`,
              '--eye-scale': eye.scale,
              '--eye-delay': `${eye.delay}s`,
              '--eye-blink': `${eye.blink}s`,
              '--eye-tilt': `${eye.tilt}deg`,
            } as CSSProperties}
          />
        ))}
      </div>

      {/* Layers that only wake up once the hidden song is playing. */}
      <span className="vs-mist" />
      <span className="vs-tree" />
      <div className="vs-march">
        {MARCHERS.map((marcher, index) => (
          <img
            key={index}
            src="/ritual/shadow-figure.png"
            alt=""
            className="vs-marcher"
            style={{
              height: `${marcher.height}vh`,
              bottom: `${marcher.bottom}vh`,
              '--march-duration': `${marcher.duration}s`,
              '--march-delay': `${marcher.delay}s`,
              '--march-opacity': marcher.opacity,
              '--march-blur': `${marcher.blur}px`,
              '--march-flip': marcher.flip ? '-1' : '1',
            } as CSSProperties}
          />
        ))}
      </div>
      <span className="vs-crimson" />
      <span className="vs-scan" />
      <span className="vs-grain" />
      <p className="vs-proclaim">The forest has found the one it seeks.</p>

      <button type="button" className="vs-exit" onClick={abort}>
        Press Esc to leave the dark
      </button>
    </div>
  );
}
