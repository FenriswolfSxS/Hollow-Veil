import { LogIn, UserPlus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login(){
  const navigate=useNavigate();
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [claim,setClaim]=useState<{characterName:string;verificationCode:string;message:string}|null>(null);
  const submit=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError('');
    try{
      const response=await fetch(`/api/auth/${mode}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});
      const contentType=response.headers.get('content-type')||'';
      const data=contentType.includes('application/json')?await response.json() as {error?:string;pending?:boolean;characterName?:string;verificationCode?:string;message?:string}:null;
      if(!response.ok)throw new Error(data?.error||`The Veil did not recognize you. (${response.status})`);
      if(mode==='register'&&data?.pending&&data.characterName&&data.verificationCode){setClaim({characterName:data.characterName,verificationCode:data.verificationCode,message:data.message||'Send this code to an officer in-game.'});return;}
      navigate('/profile',{replace:true});window.location.reload();
    }catch(err){setError(err instanceof Error?err.message:'The Veil did not recognize you.');}
    finally{setBusy(false);}
  };
  if(claim)return <section className="page auth-page"><header className="page-heading"><p className="eyebrow">A name awaits judgment</p><h1>Claim Submitted</h1><p>Your password is secured, but the account will remain sealed until an officer verifies your character.</p></header><div className="auth-panel ornamental claim-code-panel"><p className="auth-help">Send this code in-game from <strong>{claim.characterName}</strong> to a Warden, Veilkeeper, or Watcher.</p><div className="claim-code">{claim.verificationCode}</div><p>{claim.message}</p><button className="gold-button" type="button" onClick={()=>{setClaim(null);setMode('login');}}>Return to Sign In</button></div></section>;
  return <section className="page auth-page">
    <header className="page-heading"><p className="eyebrow">Names remembered by the forest</p><h1>Enter the Veil</h1><p>Your site username must exactly match your current Hollow Veil character name.</p></header>
    <div className="auth-panel ornamental">
      <div className="auth-tabs">
        <button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('')}} type="button"><LogIn size={17}/> Sign In</button>
        <button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('')}} type="button"><UserPlus size={17}/> Claim Character</button>
      </div>
      <form onSubmit={submit} className="auth-form">
        <label>Character name<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Firstname Lastname" autoComplete="username" required/></label>
        <label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete={mode==='register'?'new-password':'current-password'} minLength={10} required/></label>
        {mode==='register'&&<p className="auth-help">The character must already appear on the synchronized FC roster. Each character can claim only one account.</p>}
        {error&&<p className="auth-error" role="alert">{error}</p>}
        <button className="gold-button" disabled={busy} type="submit">{busy?'Listening…':mode==='login'?'Sign In':'Claim Character'}</button>
      </form>
    </div>
  </section>;
}
