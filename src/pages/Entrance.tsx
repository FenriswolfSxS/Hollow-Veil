import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';
import { useGlobalMusic } from '../components/GlobalMusic';
import { useRitual } from '../ritual/RitualContext';
import RitualScene from '../ritual/RitualScene';

export default function Entrance(){
  const nav=useNavigate();
  const location=useLocation();
  const escaped=Boolean((location.state as {escaped?: boolean}|null)?.escaped);
  const [leaving,setLeaving]=useState(false);
  const [warning,setWarning]=useState(escaped);
  const { musicPlaying, toggleMusic, requestPlay } = useGlobalMusic();
  const { guttering, shaking, sealed } = useRitual();
  const entranceRef=useRef<HTMLElement>(null);
  const artRef=useRef<HTMLImageElement>(null);

  useEffect(()=>{
    if(!escaped)return;
    window.history.replaceState({}, document.title);
    const timer=window.setTimeout(()=>setWarning(false),3600);
    return()=>window.clearTimeout(timer);
  },[escaped]);


  useEffect(()=>{ requestPlay(); },[requestPlay]);

  const enter=()=>{
    if(leaving||sealed)return;
    setLeaving(true);
    window.setTimeout(()=>nav('/home'),2200);
  };

  const classes=['entrance'];
  if(leaving)classes.push('is-leaving');
  if(warning)classes.push('has-warning');
  if(guttering)classes.push('is-guttering');
  if(shaking)classes.push('is-shaking');
  if(sealed)classes.push('is-sealed');

  return <main ref={entranceRef} className={classes.join(' ')} aria-label="Hollow Veil entrance">

    <div className="entrance-atmosphere" aria-hidden="true">
      <span className="entrance-mist entrance-mist-a" />
      <span className="entrance-mist entrance-mist-b" />
      {Array.from({length:36},(_,i)=><i className={`ember ember-${(i%6)+1}`} key={i} />)}
    </div>

    <figure className="entrance-frame">
      <img ref={artRef} src="/hollow-veil-entrance.png" alt="Hollow Veil Free Company story artwork" />
      <span className="frame-glow" aria-hidden="true" />
    </figure>

    {/* The litany, and everything that answers it. */}
    <RitualScene imageRef={artRef} containerRef={entranceRef} />

    <button className="enter-button" onClick={enter} disabled={leaving||sealed} aria-label="Walk not far where the shadows veil">
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
