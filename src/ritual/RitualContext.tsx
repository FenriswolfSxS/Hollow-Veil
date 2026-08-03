import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useGlobalMusic } from '../components/GlobalMusic';

/* The litany. Read in order, it opens the way. Read out of order, the forest turns away. */
export const VEIL_LINES = [
  'They could never leave.',
  'Not by force.',
  'Not by will.',
  'Only death would set them free.',
] as const;

const WHISPER_SRC = '/audio/whisper-get-you.mp3';
const HEARTBEAT_SRC = '/audio/heartbeat-double.mp3';
const HIDDEN_SRC = '/audio/hollow-veil-hidden.mp3';

/* Beat 1 kills the embers for this long before they catch again. */
const GUTTER_MS = 2400;
const FLASH_MS = 1900;
const DIM_MS = 2600;
const FAIL_MS = 1500;
/* Absolute black, then eyes, then five full seconds of nothing at all. */
const PROCLAIM_AT_MS = 5000;
const SONG_AT_MS = 7300;
const RETURN_MS = 3400;

export type RitualPhase =
  | 'idle'
  | 'failing'
  | 'blackout'
  | 'proclaim'
  | 'song'
  | 'returning';

/* Ten movements across the hidden song's 4:58. Seconds are song time. */
export const MOVEMENTS: { at: number; id: string }[] = [
  { at: 0, id: 'awaken' },
  { at: 26, id: 'breath' },
  { at: 58, id: 'procession' },
  { at: 92, id: 'descent' },
  { at: 124, id: 'swarm' },
  { at: 156, id: 'fracture' },
  { at: 188, id: 'crimson' },
  { at: 218, id: 'hollow' },
  { at: 248, id: 'veil' },
  { at: 280, id: 'dissolve' },
];

type RitualValue = {
  phase: RitualPhase;
  /** How many lines have been read correctly so far (0–4). */
  progress: number;
  /** Index of the line that broke the sequence, while it flashes crimson. */
  wrongIndex: number | null;
  guttering: boolean;
  flashing: boolean;
  figures: boolean;
  fog: boolean;
  dimming: boolean;
  shaking: boolean;
  /** True from the blackout until the landing page comes back. */
  sealed: boolean;
  movement: string;
  select: (index: number) => void;
  abort: () => void;
};

const RitualContext = createContext<RitualValue | null>(null);

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function RitualProvider({ children }: { children: ReactNode }) {
  const { silenceForRitual, reviveAfterRitual, muffle, getAudioContext } = useGlobalMusic();

  const [phase, setPhase] = useState<RitualPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [wrongIndex, setWrongIndex] = useState<number | null>(null);
  const [guttering, setGuttering] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [figures, setFigures] = useState(false);
  const [fog, setFog] = useState(false);
  const [dimming, setDimming] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [movement, setMovement] = useState('awaken');

  const timers = useRef<number[]>([]);
  const whisperRef = useRef<HTMLAudioElement | null>(null);
  const heartRef = useRef<HTMLAudioElement | null>(null);
  const hiddenRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const busyUntil = useRef(0);

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);

  const stopClip = (ref: { current: HTMLAudioElement | null }) => {
    const clip = ref.current;
    if (!clip) return;
    clip.pause();
    clip.currentTime = 0;
  };

  const playClip = useCallback(
    (ref: { current: HTMLAudioElement | null }, src: string, volume: number) => {
      if (!ref.current) {
        const clip = new Audio(src);
        clip.preload = 'auto';
        ref.current = clip;
      }
      const clip = ref.current;
      clip.volume = volume;
      clip.currentTime = 0;
      void clip.play().catch(() => undefined);
    },
    [],
  );

  /* The hidden song is six megabytes. Start pulling it the moment the first line is read
     so there is no buffering stutter after the five seconds of silence. */
  const primeHiddenSong = useCallback(() => {
    if (hiddenRef.current) return;
    const clip = new Audio();
    clip.src = HIDDEN_SRC;
    clip.preload = 'auto';
    clip.volume = 1;
    hiddenRef.current = clip;
    clip.load();
  }, []);

  const stopBeatWatch = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    const root = document.documentElement.style;
    root.setProperty('--veil-beat', '0');
    root.setProperty('--veil-surge', '0');
  }, []);

  /* Drives --veil-beat and --veil-surge off the song's own low end, so every pulse,
     shudder and flare in the sequence lands on the music rather than near it. */
  const startBeatWatch = useCallback(() => {
    const clip = hiddenRef.current;
    if (!clip) return;

    let analyser = analyserRef.current;
    if (!analyser) {
      const ctx = getAudioContext();
      if (ctx) {
        try {
          const source = ctx.createMediaElementSource(clip);
          analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.72;
          source.connect(analyser);
          analyser.connect(ctx.destination);
          analyserRef.current = analyser;
        } catch {
          analyser = null;
        }
      }
    }

    const bins = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const root = document.documentElement.style;
    let beat = 0;
    let surge = 0;

    const tick = () => {
      frameRef.current = requestAnimationFrame(tick);

      let bass = 0;
      let body = 0;
      if (analyser && bins) {
        analyser.getByteFrequencyData(bins);
        let low = 0;
        for (let i = 1; i < 10; i += 1) low += bins[i];
        let mid = 0;
        for (let i = 10; i < 90; i += 1) mid += bins[i];
        bass = Math.min(1, low / 9 / 190);
        body = Math.min(1, mid / 80 / 150);
      } else {
        /* No analyser available — keep a slow synthetic swell so the visuals still breathe. */
        const t = clip.currentTime;
        bass = 0.35 + 0.35 * Math.sin(t * 2.6);
        body = 0.3 + 0.25 * Math.sin(t * 0.7);
      }

      beat += (bass - beat) * (bass > beat ? 0.55 : 0.09);
      surge += (body - surge) * 0.05;
      root.setProperty('--veil-beat', beat.toFixed(3));
      root.setProperty('--veil-surge', surge.toFixed(3));

      const nowAt = clip.currentTime;
      for (let i = MOVEMENTS.length - 1; i >= 0; i -= 1) {
        if (nowAt >= MOVEMENTS[i].at) {
          setMovement((current) => (current === MOVEMENTS[i].id ? current : MOVEMENTS[i].id));
          break;
        }
      }
    };

    frameRef.current = requestAnimationFrame(tick);
  }, [getAudioContext]);

  /* Everything goes back exactly as it was. The ritual can be walked again immediately. */
  const reset = useCallback(
    (revive: boolean) => {
      clearTimers();
      stopBeatWatch();
      stopClip(whisperRef);
      stopClip(hiddenRef);
      setPhase('idle');
      setProgress(0);
      setWrongIndex(null);
      setGuttering(false);
      setFlashing(false);
      setFigures(false);
      setFog(false);
      setDimming(false);
      setShaking(false);
      setMovement('awaken');
      busyUntil.current = 0;
      muffle(false);
      if (revive) reviveAfterRitual();
    },
    [clearTimers, muffle, reviveAfterRitual, stopBeatWatch],
  );

  const beginReturn = useCallback(() => {
    setPhase('returning');
    stopBeatWatch();
    after(RETURN_MS, () => reset(true));
  }, [after, reset, stopBeatWatch]);

  /* Fourth line. The forest stops pretending. */
  const descend = useCallback(() => {
    clearTimers();
    stopClip(whisperRef);
    setProgress(4);
    setPhase('blackout');
    setFlashing(false);
    setDimming(false);
    silenceForRitual();
    primeHiddenSong();

    after(PROCLAIM_AT_MS, () => setPhase('proclaim'));

    after(SONG_AT_MS, () => {
      const clip = hiddenRef.current;
      if (!clip) {
        beginReturn();
        return;
      }
      setPhase('song');
      clip.currentTime = 0;
      clip.onended = () => beginReturn();
      void clip.play().catch(() => beginReturn());
      startBeatWatch();
    });
  }, [after, beginReturn, clearTimers, primeHiddenSong, silenceForRitual, startBeatWatch]);

  const fail = useCallback(
    (index: number) => {
      clearTimers();
      stopClip(whisperRef);
      playClip(heartRef, HEARTBEAT_SRC, 0.85);
      setPhase('failing');
      setWrongIndex(index);
      setProgress(0);
      setGuttering(false);
      setFlashing(false);
      setFigures(false);
      setFog(false);
      setDimming(false);
      setShaking(!prefersReducedMotion());
      muffle(false);
      busyUntil.current = Date.now() + FAIL_MS;

      after(700, () => setShaking(false));
      after(FAIL_MS, () => {
        setWrongIndex(null);
        setPhase('idle');
      });
    },
    [after, clearTimers, muffle, playClip],
  );

  const advance = useCallback(
    (next: number) => {
      setProgress(next);

      if (next === 1) {
        /* The embers gutter out, and something small laughs in the dark. */
        primeHiddenSong();
        setGuttering(true);
        playClip(whisperRef, WHISPER_SRC, 1);
        busyUntil.current = Date.now() + 900;
        after(GUTTER_MS, () => setGuttering(false));
        return;
      }

      if (next === 2) {
        /* Light stutters. The thing from the treeline steps forward, and it is not alone. */
        setFlashing(true);
        setFigures(true);
        muffle(true);
        busyUntil.current = Date.now() + 1200;
        after(FLASH_MS, () => setFlashing(false));
        after(3000, () => muffle(false));
        return;
      }

      /* Cold comes up off the ground and the moon looks away. */
      setFog(true);
      setDimming(true);
      busyUntil.current = Date.now() + 1000;
      after(DIM_MS, () => setDimming(false));
    },
    [after, muffle, playClip, primeHiddenSong],
  );

  const select = useCallback(
    (index: number) => {
      if (phase !== 'idle') return;
      if (Date.now() < busyUntil.current) return;

      if (index !== progress) {
        fail(index);
        return;
      }

      const next = progress + 1;
      if (next === 4) descend();
      else advance(next);
    },
    [advance, descend, fail, phase, progress],
  );

  const abort = useCallback(() => {
    if (phase === 'idle' || phase === 'failing') return;
    reset(true);
  }, [phase, reset]);

  /* An escape hatch. Nobody should be trapped in a five minute blackout they can't leave. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') abort();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abort]);

  const sealed = phase === 'blackout' || phase === 'proclaim' || phase === 'song' || phase === 'returning';

  /* Global hooks so plain CSS can freeze the world without prop-drilling through every page. */
  useEffect(() => {
    const body = document.body;
    body.dataset.veilPhase = phase;
    body.dataset.veilProgress = String(progress);
    if (sealed) body.dataset.veilFrozen = '1';
    else delete body.dataset.veilFrozen;
    return () => {
      delete body.dataset.veilFrozen;
    };
  }, [phase, progress, sealed]);

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    stopClip(whisperRef);
    stopClip(hiddenRef);
  }, []);

  const value = useMemo<RitualValue>(
    () => ({
      phase,
      progress,
      wrongIndex,
      guttering,
      flashing,
      figures,
      fog,
      dimming,
      shaking,
      sealed,
      movement,
      select,
      abort,
    }),
    [
      abort, dimming, figures, flashing, fog, guttering, movement,
      phase, progress, sealed, select, shaking, wrongIndex,
    ],
  );

  return <RitualContext.Provider value={value}>{children}</RitualContext.Provider>;
}

export function useRitual() {
  const context = useContext(RitualContext);
  if (!context) throw new Error('useRitual must be used inside RitualProvider');
  return context;
}
