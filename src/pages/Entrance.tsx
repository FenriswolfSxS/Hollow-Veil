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

  useEffect(()=>{
    if(!escaped)return;
    window.history.replaceState({}, document.title);
    const timer=window.setTimeout(()=>setWarning(false),3600);
    return()=>window.clearTimeout(timer);
  },[escaped]);

  useEffect(()=>{
    const audio=audioRef.current;
    if(!audio)return;
    audio.volume=.32;

    const tryPlay=()=>{
      if(!musicEnabled)return;
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
    const next=!musicEnabled;
    setMusicEnabled(next);
    localStorage.setItem(MUSIC_KEY,next?'on':'off');
    if(next){
      void audio.play().then(()=>setMusicPlaying(true)).catch(()=>setMusicPlaying(false));
    }else{
      audio.pause();
      setMusicPlaying(false);
    }
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
      preload="auto"
      onPlay={()=>setMusicPlaying(true)}
      onPause={()=>setMusicPlaying(false)}
    />

    <div className="entrance-atmosphere" aria-hidden="true">
      <span className="entrance-mist entrance-mist-a" />
      <span className="entrance-mist entrance-mist-b" />
      {Array.from({length:18},(_,i)=><i className={`ember ember-${(i%6)+1}`} key={i} />)}
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
      aria-label={musicEnabled?'Mute landing music':'Play landing music'}
      title={musicEnabled?'Mute music':'Play music'}
    >
      {musicEnabled?<Volume2 size={18}/>:<VolumeX size={18}/>}<span>{musicEnabled?'Music':'Muted'}</span>
    </button>

    {warning && <div className="no-escape-message" aria-live="polite">There is No Escape</div>}
  </main>;
}
