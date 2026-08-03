import { useCallback, useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { VEIL_LINES, useRitual } from './RitualContext';

type ArtRect = { left: number; top: number; width: number; height: number };

/**
 * The litany is painted into the artwork, not written in HTML. These are the four lines
 * measured off the source file (1536x1024) and stored as fractions, so they stay locked to
 * the text at any render size.
 */
const PAINTED_LINES = [
  { l: 0.772135, t: 0.703613, w: 0.190755, h: 0.025391 },
  { l: 0.807292, t: 0.729004, w: 0.115234, h: 0.025391 },
  { l: 0.809896, t: 0.754883, w: 0.108073, h: 0.025391 },
  { l: 0.746094, t: 0.781738, w: 0.248047, h: 0.025391 },
];

/**
 * The artwork is letterboxed inside its element (object-fit: contain), so the painted
 * rectangle is rarely the element's own box. Measure it, and hang everything off that
 * instead of the viewport — the hotspots then sit on the words at every window size.
 */
function useArtRect(
  imageRef: RefObject<HTMLImageElement | null>,
  containerRef: RefObject<HTMLElement | null>,
) {
  const [rect, setRect] = useState<ArtRect | null>(null);

  const measure = useCallback(() => {
    const image = imageRef.current;
    const container = containerRef.current;
    if (!image || !container || !image.naturalWidth || !image.naturalHeight) return;

    const box = image.getBoundingClientRect();
    const frame = container.getBoundingClientRect();
    if (!box.width || !box.height) return;

    const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;

    setRect((current) => {
      const next = {
        left: box.left - frame.left + (box.width - width) / 2,
        top: box.top - frame.top + (box.height - height) / 2,
        width,
        height,
      };
      if (current
        && Math.abs(current.left - next.left) < 0.5
        && Math.abs(current.top - next.top) < 0.5
        && Math.abs(current.width - next.width) < 0.5
        && Math.abs(current.height - next.height) < 0.5) return current;
      return next;
    });
  }, [containerRef, imageRef]);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete) measure();
    else image?.addEventListener('load', measure, { once: true });

    const observer = new ResizeObserver(measure);
    if (image) observer.observe(image);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [containerRef, imageRef, measure]);

  return rect;
}

/* Deterministic scatter — the forest looks the same every time you come back to it. */
function noise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

/* One tall shape on the path, and lesser things behind it. All kept clear of the
   story column on the right so nothing ever sits on top of the litany. */
const WRAITHS = [
  { left: 46.5, bottom: 21, height: 31, opacity: 0.84, blur: 0, delay: 0.0, flip: false },
  { left: 20.0, bottom: 17, height: 20, opacity: 0.5, blur: 1.4, delay: 0.5, flip: true },
  { left: 63.0, bottom: 16, height: 17, opacity: 0.42, blur: 1.8, delay: 0.9, flip: false },
  { left: 8.5, bottom: 14, height: 13, opacity: 0.32, blur: 2.4, delay: 1.3, flip: false },
  { left: 35.0, bottom: 13, height: 12, opacity: 0.3, blur: 2.6, delay: 1.1, flip: true },
  { left: 71.0, bottom: 12, height: 11, opacity: 0.26, blur: 2.8, delay: 1.6, flip: false },
];

const WATCHERS = Array.from({ length: 12 }, (_, index) => ({
  left: 4 + noise(index + 3) * 68,
  bottom: 10 + noise(index + 47) * 28,
  scale: 0.55 + noise(index + 91) * 0.75,
  delay: 0.6 + noise(index + 133) * 2.4,
  blinkAt: 2 + noise(index + 177) * 7,
}));

type SceneProps = {
  imageRef: RefObject<HTMLImageElement | null>;
  containerRef: RefObject<HTMLElement | null>;
};

export default function RitualScene({ imageRef, containerRef }: SceneProps) {
  const { progress, wrongIndex, phase, sealed, figures, fog, dimming, select } = useRitual();
  const rect = useArtRect(imageRef, containerRef);

  if (!rect) return null;

  const style = {
    '--art-l': `${rect.left}px`,
    '--art-t': `${rect.top}px`,
    '--art-w': `${rect.width}px`,
    '--art-h': `${rect.height}px`,
  } as CSSProperties;

  const className = [
    'veil-scene',
    sealed ? 'is-sealed' : '',
    figures ? 'has-figures' : '',
    fog ? 'has-fog' : '',
    dimming ? 'is-dimming' : '',
  ].filter(Boolean).join(' ');

  const lineVars = (index: number) => ({
    '--l': PAINTED_LINES[index].l,
    '--t': PAINTED_LINES[index].t,
    '--w': PAINTED_LINES[index].w,
    '--h': PAINTED_LINES[index].h,
  } as CSSProperties);

  return (
    <div className={className} style={style}>
      {/* The moon looks away on the third line. */}
      <span className="veil-moonshroud" aria-hidden="true" />

      <div className="veil-wraiths" aria-hidden="true">
        {WRAITHS.map((wraith, index) => (
          <img
            key={index}
            src="/ritual/shadow-figure.png"
            alt=""
            className="veil-wraith"
            style={{
              left: `${wraith.left}%`,
              bottom: `${wraith.bottom}%`,
              height: `${wraith.height}%`,
              '--wraith-opacity': wraith.opacity,
              '--wraith-blur': `${wraith.blur}px`,
              '--wraith-delay': `${wraith.delay}s`,
              '--wraith-flip': wraith.flip ? '-1' : '1',
            } as CSSProperties}
          />
        ))}
        {WATCHERS.map((watcher, index) => (
          <span
            key={`w${index}`}
            className="veil-watcher"
            style={{
              left: `${watcher.left}%`,
              bottom: `${watcher.bottom}%`,
              '--watcher-scale': watcher.scale,
              '--watcher-delay': `${watcher.delay}s`,
              '--watcher-blink': `${watcher.blinkAt}s`,
            } as CSSProperties}
          />
        ))}
      </div>

      {/* Cold off the ground on the third line. */}
      <div className="veil-fog" aria-hidden="true">
        <span className="veil-fog-bank veil-fog-a" />
        <span className="veil-fog-bank veil-fog-b" />
        <span className="veil-fog-bank veil-fog-c" />
      </div>

      {/* Relights the painted words by screening the artwork back over itself.
          The halo is a separate span so the glow's feathering mask can't clip it. */}
      <div className="veil-glows" aria-hidden="true">
        {VEIL_LINES.map((line, index) => {
          const state = [
            index < progress ? 'is-lit' : '',
            wrongIndex === index ? 'is-wrong' : '',
          ].filter(Boolean).join(' ');
          return (
            <span key={line} className="veil-glow-pair">
              <span className={`veil-bloom ${state}`.trim()} style={lineVars(index)} />
              <span className={`veil-glow ${state}`.trim()} style={lineVars(index)} />
            </span>
          );
        })}
      </div>

      {/* Invisible targets sitting exactly on the painted lines. */}
      <div className="veil-hits">
        {VEIL_LINES.map((line, index) => (
          <button
            key={line}
            type="button"
            className="veil-hit"
            style={lineVars(index)}
            onClick={() => select(index)}
            disabled={phase !== 'idle'}
          >
            <span className="veil-hit-label">{line}</span>
          </button>
        ))}
      </div>

      {/* Phones render the artwork too small to read, let alone tap. Below 760px the
          litany is repeated underneath it in the artwork's own voice. */}
      <ol className="veil-small-lines">
        {VEIL_LINES.map((line, index) => (
          <li key={line}>
            <button
              type="button"
              className={[
                'veil-small-line',
                index < progress ? 'is-lit' : '',
                wrongIndex === index ? 'is-wrong' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => select(index)}
              disabled={phase !== 'idle'}
            >
              {line}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
