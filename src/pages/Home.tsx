import { CalendarDays, Edit3, Moon, Save, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

type Me = { authenticated: boolean; user?: { username: string; rank: string; role: string; testAccessMode?: boolean } };
type MessageResponse = { content: string; updatedAt: number | null; updatedBy: string | null };

const DEFAULT_MESSAGE = 'The Veil is quiet. No new decree has been written.';

export default function Home(){
  const [me,setMe]=useState<Me>({authenticated:false});
  const [message,setMessage]=useState(DEFAULT_MESSAGE);
  const [draft,setDraft]=useState(DEFAULT_MESSAGE);
  const [updatedAt,setUpdatedAt]=useState<number|null>(null);
  const [updatedBy,setUpdatedBy]=useState<string|null>(null);
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');

  const canEdit=Boolean(me.authenticated&&me.user&&['Warden','Veilkeeper','Watcher'].includes(me.user.rank||me.user.role));

  useEffect(()=>{
    Promise.all([
      fetch('/api/me').then(r=>r.json()).catch(()=>({authenticated:false})),
      fetch('/api/home-message').then(r=>r.ok?r.json():Promise.reject()).catch(()=>({content:DEFAULT_MESSAGE,updatedAt:null,updatedBy:null})),
    ]).then(([meData,messageData]:[Me,MessageResponse])=>{
      setMe(meData);
      const content=messageData.content?.trim()||DEFAULT_MESSAGE;
      setMessage(content);setDraft(content);setUpdatedAt(messageData.updatedAt);setUpdatedBy(messageData.updatedBy);
    });
  },[]);

  const save=async()=>{
    const clean=draft.trim();
    if(!clean){setError('The message cannot be empty.');return;}
    setSaving(true);setError('');
    try{
      const response=await fetch('/api/home-message',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({content:clean})});
      const data=await response.json() as MessageResponse&{error?:string};
      if(!response.ok)throw new Error(data.error||'The message could not be saved.');
      setMessage(data.content);setDraft(data.content);setUpdatedAt(data.updatedAt);setUpdatedBy(data.updatedBy);setEditing(false);
    }catch(err){setError(err instanceof Error?err.message:'The message could not be saved.');}
    finally{setSaving(false);}
  };

  return <section className="page home-page">
    <header className="hero-panel ornamental"><div className="moon-seal"><Moon/></div><p className="eyebrow">虚紗 · Hollow Veil Free Company</p><h1>The forest remembers.</h1><p>Beyond the last torii lies a home for the lost, the weary, and those searching for something they cannot name.</p></header>
    <section className="veil-message ornamental" aria-labelledby="veil-message-title">
      <div className="veil-message-heading">
        <div><p className="eyebrow">Words carried through the mist</p><h2 id="veil-message-title">The Warden's Notice</h2></div>
        {canEdit&&!editing&&<button className="veil-edit-button" type="button" onClick={()=>{setDraft(message);setEditing(true);setError('')}}><Edit3 size={17}/> Edit notice</button>}
      </div>
      {editing?<>
        <textarea className="veil-message-editor" value={draft} maxLength={2000} onChange={e=>setDraft(e.target.value)} aria-label="Edit the Warden's notice" />
        <div className="veil-message-actions">
          <span>{draft.length}/2000</span>
          <button type="button" onClick={()=>{setEditing(false);setDraft(message);setError('')}} disabled={saving}><X size={17}/> Cancel</button>
          <button className="gold-button" type="button" onClick={save} disabled={saving}><Save size={17}/> {saving?'Saving…':'Save notice'}</button>
        </div>
        {error&&<p className="veil-message-error" role="alert">{error}</p>}
      </>:<p className="veil-message-copy">{message}</p>}
      <footer className="veil-message-meta">
        {updatedAt?<span>Last written {new Date(updatedAt).toLocaleString()}{updatedBy?` by ${updatedBy}`:''}</span>:<span>Awaiting the first decree.</span>}
        {!canEdit&&<span className="veil-message-access">Sign in with any synchronized FC character to edit during access testing.</span>}
      </footer>
    </section>

    <div className="feature-grid">
      <Link className="feature-card" to="/roster"><Users/><h2>The Remembered</h2><p>Walk among the names claimed by the Veil.</p></Link>
      <Link className="feature-card" to="/events"><CalendarDays/><h2>Gatherings</h2><p>Plan ceremonies, raids, maps, and nights beneath the moon.</p></Link>
      <Link className="feature-card" to="/forum"><Moon/><h2>Whispers in the Veil</h2><p>Share stories, questions, guides, and words carried through the mist.</p></Link>
    </div>

    <section className="lore-strip"><span>“Together, we walk the path that never ends.”</span></section>
  </section>
}
