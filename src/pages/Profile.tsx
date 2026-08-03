import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
type Me={authenticated:boolean;user?:{username:string;avatarUrl:string;rank:string;role:string;characterName?:string}};
export default function Profile(){
  const[me,setMe]=useState<Me>({authenticated:false}),[invite,setInvite]=useState('');
  useEffect(()=>{fetch('/api/me').then(r=>r.json()).then(setMe).catch(()=>setMe({authenticated:false}))},[]);
  const reveal=()=>fetch('/api/discord-invite').then(async r=>{if(r.ok)setInvite((await r.json()).url);else alert('The Discord entrance is visible only to current Hollow Veil members.');});
  return <section className="page"><header className="page-heading"><p className="eyebrow">Your Place in the Veil</p><h1>Member Profile</h1></header><div className="profile-panel ornamental">{!me.authenticated?<><h2>You have not entered yet.</h2><p>Sign in using the exact name of your Hollow Veil character.</p><Link className="gold-button" to="/login">Enter the Veil</Link></>:<><img className="profile-avatar" src={me.user?.avatarUrl} alt={me.user?.username}/><h2>{me.user?.username}</h2><p className="role-badge">{me.user?.rank}</p><p>Your permissions are synchronized from your current Free Company rank. If your rank changes, the website updates it from the roster automatically.</p>{invite?<a className="gold-button" href={invite} target="_blank" rel="noreferrer">Open Hollow Veil Discord</a>:<button className="gold-button" onClick={reveal}>Reveal member Discord</button>}</>}</div></section>
}
