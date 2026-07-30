import { useNavigate } from 'react-router-dom';
export default function Entrance(){
  const nav=useNavigate();
  return <main className="entrance" aria-label="Hollow Veil entrance">
    <img src="/hollow-veil-entrance.png" alt="Hollow Veil Free Company story artwork" />
    <button className="enter-button" onClick={()=>nav('/home')}><span>Enter</span></button>
  </main>;
}
