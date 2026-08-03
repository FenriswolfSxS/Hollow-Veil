import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const MUSIC_KEY = 'hollow-veil-landing-music';
const MUSIC_VOLUME = 0.85;

type MusicContextValue = {
  musicPlaying: boolean;
  musicEnabled: boolean;
  toggleMusic: () => void;
  requestPlay: () => void;
  /** Push the theme behind a wall — low-passed and quiet — then let it come back. */
  muffle: (on: boolean) => void;
  /** Cut the theme dead for the hidden sequence. */
  silenceForRitual: () => void;
  /** Bring the theme back once the forest lets go. */
  reviveAfterRitual: () => void;
  /** Shared context so the hidden song can be analysed for beat-synced visuals. */
  getAudioContext: () => AudioContext | null;
};

const MusicContext = createContext<MusicContextValue | null>(null);

export function GlobalMusicProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [musicEnabled, setMusicEnabled] = useState(() => localStorage.getItem(MUSIC_KEY) !== 'off');
  const [musicPlaying, setMusicPlaying] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const graphFailed = useRef(false);
  const suspendedByRitual = useRef(false);
  const fadeRef = useRef<number | null>(null);

  /* Built lazily, and only ever from inside a user gesture, so the context starts running. */
  const ensureGraph = useCallback(() => {
    if (ctxRef.current) {
      if (ctxRef.current.state === 'suspended') void ctxRef.current.resume();
      return ctxRef.current;
    }
    if (graphFailed.current) return null;
    const audio = audioRef.current;
    if (!audio) return null;

    try {
      const Ctor = window.AudioContext
        || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error('no AudioContext');

      const ctx = new Ctor();
      const source = ctx.createMediaElementSource(audio);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 22000;
      filter.Q.value = 0.55;
      const gain = ctx.createGain();
      gain.gain.value = 1;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      ctxRef.current = ctx;
      filterRef.current = filter;
      gainRef.current = gain;
      void ctx.resume();
      return ctx;
    } catch {
      graphFailed.current = true;
      return null;
    }
  }, []);

  const getAudioContext = useCallback(() => ensureGraph(), [ensureGraph]);

  const requestPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !musicEnabled || suspendedByRitual.current) return;
    audio.muted = false;
    audio.defaultMuted = false;
    audio.volume = MUSIC_VOLUME;
    void audio.play().then(() => setMusicPlaying(true)).catch(() => setMusicPlaying(false));
  }, [musicEnabled]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = false;
    audio.defaultMuted = false;
    audio.volume = MUSIC_VOLUME;

    if (musicEnabled) requestPlay();
    else {
      audio.pause();
      setMusicPlaying(false);
    }

    const unlock = () => {
      requestPlay();
      if (ctxRef.current?.state === 'suspended') void ctxRef.current.resume();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [musicEnabled, requestPlay]);

  const toggleMusic = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused || audio.muted || audio.volume === 0 || !musicPlaying) {
      setMusicEnabled(true);
      localStorage.setItem(MUSIC_KEY, 'on');
      suspendedByRitual.current = false;
      audio.muted = false;
      audio.volume = MUSIC_VOLUME;
      void audio.play().then(() => setMusicPlaying(true)).catch(() => setMusicPlaying(false));
      return;
    }

    setMusicEnabled(false);
    localStorage.setItem(MUSIC_KEY, 'off');
    audio.pause();
    setMusicPlaying(false);
  }, [musicPlaying]);

  /* Fallback for browsers where the Web Audio graph can't be built: just ride the volume. */
  const tweenVolume = useCallback((target: number, ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (fadeRef.current !== null) window.clearInterval(fadeRef.current);
    const from = audio.volume;
    const started = performance.now();
    fadeRef.current = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - started) / ms);
      audio.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      if (k >= 1 && fadeRef.current !== null) {
        window.clearInterval(fadeRef.current);
        fadeRef.current = null;
      }
    }, 40);
  }, []);

  const muffle = useCallback((on: boolean) => {
    const ctx = ensureGraph();
    const filter = filterRef.current;
    const gain = gainRef.current;

    if (ctx && filter && gain) {
      const now = ctx.currentTime;
      filter.frequency.cancelScheduledValues(now);
      gain.gain.cancelScheduledValues(now);
      filter.frequency.setTargetAtTime(on ? 320 : 22000, now, on ? 0.18 : 0.5);
      gain.gain.setTargetAtTime(on ? 0.42 : 1, now, on ? 0.18 : 0.5);
      return;
    }
    tweenVolume(on ? MUSIC_VOLUME * 0.28 : MUSIC_VOLUME, on ? 500 : 1400);
  }, [ensureGraph, tweenVolume]);

  const silenceForRitual = useCallback(() => {
    const audio = audioRef.current;
    suspendedByRitual.current = true;
    if (fadeRef.current !== null) {
      window.clearInterval(fadeRef.current);
      fadeRef.current = null;
    }
    const ctx = ctxRef.current;
    const filter = filterRef.current;
    const gain = gainRef.current;
    if (ctx && filter && gain) {
      filter.frequency.cancelScheduledValues(ctx.currentTime);
      gain.gain.cancelScheduledValues(ctx.currentTime);
      filter.frequency.value = 22000;
      gain.gain.value = 1;
    }
    if (!audio) return;
    audio.pause();
    audio.volume = MUSIC_VOLUME;
    setMusicPlaying(false);
  }, []);

  const reviveAfterRitual = useCallback(() => {
    suspendedByRitual.current = false;
    const audio = audioRef.current;
    if (!audio || !musicEnabled) return;
    audio.volume = MUSIC_VOLUME;
    audio.muted = false;
    void audio.play().then(() => setMusicPlaying(true)).catch(() => setMusicPlaying(false));
  }, [musicEnabled]);

  const value = useMemo(() => ({
    musicPlaying,
    musicEnabled,
    toggleMusic,
    requestPlay,
    muffle,
    silenceForRitual,
    reviveAfterRitual,
    getAudioContext,
  }), [
    musicPlaying, musicEnabled, toggleMusic, requestPlay,
    muffle, silenceForRitual, reviveAfterRitual, getAudioContext,
  ]);

  return (
    <MusicContext.Provider value={value}>
      <audio
        ref={audioRef}
        src="/audio/hollow-veil-theme-preview.mp3"
        autoPlay
        loop
        playsInline
        preload="auto"
        onPlay={() => setMusicPlaying(true)}
        onPause={() => setMusicPlaying(false)}
        onEnded={() => setMusicPlaying(false)}
        onError={() => setMusicPlaying(false)}
      />
      {children}
    </MusicContext.Provider>
  );
}

export function useGlobalMusic() {
  const context = useContext(MusicContext);
  if (!context) throw new Error('useGlobalMusic must be used inside GlobalMusicProvider');
  return context;
}
