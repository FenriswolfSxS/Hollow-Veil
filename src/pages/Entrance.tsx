import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Entrance(){
  const nav=useNavigate();
  const [leaving,setLeaving]=useState(false);

  const enter=()=>{
    if(leaving)return;
    setLeaving(true);
    window.setTimeout(()=>nav('/home'),900);
  };

  return <main className={`entrance${leaving?' is-leaving':''}`} aria-label="Hollow Veil entrance">
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
  </main>;
}
