import { Search, ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
type Member={id:string;name:string;rank:string;portrait:string;profileUrl:string;world?:string};
export default function Roster(){
 const [members,setMembers]=useState<Member[]>([]),[q,setQ]=useState(''),[loading,setLoading]=useState(true);
 const load=()=>{setLoading(true);fetch('/api/roster').then(r=>r.json()).then(d=>setMembers(d.members||[])).finally(()=>setLoading(false));};
 useEffect(load,[]); const shown=useMemo(()=>members.filter(m=>(m.name+' '+m.rank).toLowerCase().includes(q.toLowerCase())),[members,q]);
 return <section className="page"><header className="page-heading"><p className="eyebrow">The Forest Remembers</p><h1>Free Company Roster</h1><p>Automatically synchronized from the official Lodestone roster.</p></header>
 <div className="toolbar"><label><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search names or ranks"/></label><button onClick={load}><RefreshCw size={17}/>Refresh</button></div>
 {loading?<div className="loading-veil">Listening for names in the mist…</div>:<div className="roster-grid">{shown.map(m=><article className="member-card" key={m.id}>
  <div className="portrait-wrap"><img src={m.portrait} alt={m.name}/><span className="rank-rune">{m.rank?.[0]||'•'}</span></div>
  <div><h2>{m.name}</h2><p>{m.rank}</p>{m.world&&<small>{m.world}</small>}</div><a href={m.profileUrl} target="_blank" rel="noreferrer" aria-label="Open Lodestone"><ExternalLink/></a>
 </article>)}</div>}
 {!loading&&!shown.length&&<div className="empty-state">No names answered the call.</div>}
 </section>;
}
