import { Search, ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Member={id:string;name:string;rank:string;portrait:string;profileUrl:string;world?:string};
type RosterResponse={members?:Member[];cached?:boolean;updatedAt?:number|null;warning?:string};

export default function Roster(){
  const [members,setMembers]=useState<Member[]>([]);
  const [q,setQ]=useState('');
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [status,setStatus]=useState<{cached?:boolean;updatedAt?:number|null;warning?:string}>({});

  const load=async(force=false)=>{
    force?setRefreshing(true):setLoading(true);
    try{
      const response=await fetch(`/api/roster${force?'?refresh=1':''}`);
      const data:RosterResponse=await response.json();
      setMembers(data.members||[]);
      setStatus({cached:data.cached,updatedAt:data.updatedAt,warning:data.warning});
    }catch{
      setStatus({warning:'The roster could not be reached. Please try again shortly.'});
    }finally{
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(()=>{void load();},[]);
  const shown=useMemo(()=>members.filter(m=>(m.name+' '+m.rank+' '+(m.world||'')).toLowerCase().includes(q.toLowerCase())),[members,q]);
  const updated=status.updatedAt?new Date(status.updatedAt).toLocaleString():null;

  return <section className="page">
    <header className="page-heading">
      <p className="eyebrow">The Forest Remembers</p>
      <h1>Free Company Roster</h1>
      <p>Automatically synchronized from the official Hollow Veil Lodestone roster.</p>
    </header>

    <div className="roster-meta ornamental">
      <div><strong>{members.length}</strong><span>Veilbound Members</span></div>
      <p>{status.cached?'Showing the latest saved roster':'Live roster synchronized'}{updated?` · Updated ${updated}`:''}</p>
    </div>

    <div className="toolbar">
      <label><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search names, ranks, or worlds"/></label>
      <button onClick={()=>void load(true)} disabled={refreshing}><RefreshCw size={17} className={refreshing?'spin':''}/>{refreshing?'Syncing…':'Sync now'}</button>
    </div>

    {status.warning&&<div className="roster-warning">{status.warning}{members.length?' The most recently saved roster is shown below.':''}</div>}
    {loading?<div className="loading-veil">Listening for names in the mist…</div>:<div className="roster-grid">{shown.map(m=><article className="member-card" key={m.id}>
      <div className="portrait-wrap"><img src={m.portrait} alt={m.name} loading="lazy"/><span className="rank-rune">{m.rank?.[0]||'•'}</span></div>
      <div><h2>{m.name}</h2><p>{m.rank}</p>{m.world&&<small>{m.world}</small>}</div>
      <a href={m.profileUrl} target="_blank" rel="noreferrer" aria-label={`Open ${m.name} on Lodestone`}><ExternalLink/></a>
    </article>)}</div>}
    {!loading&&!shown.length&&<div className="empty-state">No names answered the call.</div>}
  </section>;
}
