import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';

const MUSIC_KEY='hollow-veil-landing-music';

export default function Entrance(){
  const nav=useNavigate();
  const location=useLocation();
  const escaped=Boolean((location.state as {escaped?: boolean}|null)?.escaped);
  const audioRef=useRef<HTMLAudioElement>(null);
  const [leaving,setLeaving]=useState(false);
  const [warning,setWarning]=useState(escaped);
  const [musicEnabled,setMusicEnabled]=useState(()=>localStorage.getItem(MUSIC_KEY)!=='off');
  const [musicPlaying,setMusicPlaying]=useState(false);
  const LANDING_VOLUME=.85;

  useEffect(()=>{
    if(!escaped)return;
    window.history.replaceState({}, document.title);
    const timer=window.setTimeout(()=>setWarning(false),3600);
    return()=>window.clearTimeout(timer);
  },[escaped]);

  useEffect(()=>{
    const audio=audioRef.current;
    if(!audio)return;
    audio.muted=false;
    audio.defaultMuted=false;
    audio.volume=LANDING_VOLUME;

    const tryPlay=()=>{
      if(!musicEnabled)return;
      audio.muted=false;
      audio.volume=LANDING_VOLUME;
      void audio.play().then(()=>setMusicPlaying(true)).catch(()=>setMusicPlaying(false));
    };

    tryPlay();
    const unlock=()=>{
      tryPlay();
      window.removeEventListener('pointerdown',unlock);
      window.removeEventListener('keydown',unlock);
    };
    window.addEventListener('pointerdown',unlock,{once:true});
    window.addEventListener('keydown',unlock,{once:true});

    return()=>{
      window.removeEventListener('pointerdown',unlock);
      window.removeEventListener('keydown',unlock);
      audio.pause();
    };
  },[musicEnabled]);

  const toggleMusic=()=>{
    const audio=audioRef.current;
    if(!audio)return;

    // When autoplay was blocked, the first click must start the song instead of
    // flipping the saved preference to muted. Only an actively playing track
    // is treated as a request to turn the music off.
    if(audio.paused || audio.muted || audio.volume===0 || !musicPlaying){
      setMusicEnabled(true);
      localStorage.setItem(MUSIC_KEY,'on');
      audio.muted=false;
      audio.volume=LANDING_VOLUME;
      void audio.play().then(()=>setMusicPlaying(true)).catch(()=>setMusicPlaying(false));
      return;
    }

    setMusicEnabled(false);
    localStorage.setItem(MUSIC_KEY,'off');
    audio.pause();
    setMusicPlaying(false);
  };

  const enter=()=>{
    if(leaving)return;
    setLeaving(true);
    const audio=audioRef.current;
    if(audio && !audio.paused){
      const fade=window.setInterval(()=>{
        audio.volume=Math.max(0,audio.volume-.04);
        if(audio.volume<=0){window.clearInterval(fade);audio.pause();}
      },100);
    }
    window.setTimeout(()=>nav('/home'),2200);
  };

  return <main className={`entrance${leaving?' is-leaving':''}${warning?' has-warning':''}`} aria-label="Hollow Veil entrance">
    <audio
      ref={audioRef}
      src="/audio/hollow-veil-theme-preview.mp3"
      autoPlay
      loop
      playsInline
      muted={false}
      preload="auto"
      onPlay={()=>setMusicPlaying(true)}
      onPause={()=>setMusicPlaying(false)}
      onVolumeChange={()=>setMusicPlaying(Boolean(audioRef.current && !audioRef.current.paused && !audioRef.current.muted && audioRef.current.volume>0))}
      onError={()=>setMusicPlaying(false)}
    />

    <div className="entrance-atmosphere" aria-hidden="true">
      <span className="entrance-mist entrance-mist-a" />
      <span className="entrance-mist entrance-mist-b" />
      {Array.from({length:36},(_,i)=><i className={`ember ember-${(i%6)+1}`} key={i} />)}
    </div>

    <figure className="entrance-frame">
      <img src="/hollow-veil-entrance.png" alt="Hollow Veil Free Company story artwork" />
      <span className="frame-glow" aria-hidden="true" />
    </figure>

    <button className="enter-button" onClick={enter} disabled={leaving} aria-label="Walk not far where the shadows veil">
      <span>Walk not far where the shadows veil</span>
    </button>

    <button
      className={`landing-music-toggle${musicPlaying?' is-playing':''}`}
      type="button"
      onClick={toggleMusic}
      aria-label={musicPlaying?'Mute landing music':'Play landing music'}
      title={musicPlaying?'Mute music':'Play music'}
    >
      {musicPlaying?<Volume2 size={18}/>:<VolumeX size={18}/>}<span>{musicPlaying?'Music On':'Play Music'}</span>
    </button>

    {warning && <div className="no-escape-message" aria-live="polite">There is No Escape</div>}
  </main>;
}
