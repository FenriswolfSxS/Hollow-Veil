import { Search, ExternalLink, RefreshCw, SlidersHorizontal, Shield, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Member={id:string;name:string;rank:string;portrait:string;profileUrl:string;world?:string;job?:string;jobIcon?:string;level?:number;grandCompany?:string};
type RosterResponse={members?:Member[];cached?:boolean;updatedAt?:number|null;warning?:string};
type SortKey='rank'|'name'|'level'|'job';

export default function Roster(){
  const [members,setMembers]=useState<Member[]>([]),[q,setQ]=useState(''),[rank,setRank]=useState('All ranks'),[job,setJob]=useState('All jobs'),[sort,setSort]=useState<SortKey>('rank');
  const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
  const [status,setStatus]=useState<{cached?:boolean;updatedAt?:number|null;warning?:string}>({});

  const load=async(force=false)=>{force?setRefreshing(true):setLoading(true);try{const response=await fetch(`/api/roster${force?'?refresh=1':''}`);const data:RosterResponse=await response.json();setMembers(data.members||[]);setStatus({cached:data.cached,updatedAt:data.updatedAt,warning:data.warning});}catch{setStatus({warning:'The roster could not be reached. Please try again shortly.'});}finally{setLoading(false);setRefreshing(false);}};
  useEffect(()=>{void load();},[]);

  const ranks=useMemo(()=>[...new Set(members.map(m=>m.rank).filter(Boolean))], [members]);
  const jobs=useMemo(()=>[...new Set(members.map(m=>m.job).filter((value):value is string=>Boolean(value)))].sort(),[members]);
  const rankOrder=useMemo(()=>new Map(ranks.map((value,index)=>[value,index])),[ranks]);
  const shown=useMemo(()=>{
    const filtered=[...members].filter(m=>{
    const needle=q.trim().toLowerCase();
    const matchesText=!needle||[m.name,m.rank,m.world,m.job,m.level?.toString(),m.grandCompany].filter(Boolean).join(' ').toLowerCase().includes(needle);
      return matchesText&&(rank==='All ranks'||m.rank===rank)&&(job==='All jobs'||m.job===job);
    });
    const collator=new Intl.Collator(undefined,{sensitivity:'base',numeric:true});
    return filtered.sort((a,b)=>{
      if(sort==='name')return collator.compare(a.name,b.name);
      if(sort==='level')return (b.level??-1)-(a.level??-1)||collator.compare(a.name,b.name);
      if(sort==='job')return collator.compare(a.job||'ZZZ',b.job||'ZZZ')||collator.compare(a.name,b.name);
      return (rankOrder.get(a.rank)??999)-(rankOrder.get(b.rank)??999)||collator.compare(a.name,b.name);
    });
  },[members,q,rank,job,sort,rankOrder]);
  const updated=status.updatedAt?new Date(status.updatedAt).toLocaleString():null;

  return <section className="page roster-page">
    <header className="page-heading"><p className="eyebrow">The Forest Remembers</p><h1>Free Company Roster</h1><p>Ranks, current jobs, levels, and profiles synchronized from the official Hollow Veil Lodestone roster.</p></header>
    <div className="roster-meta ornamental"><div><strong>{members.length}</strong><span>Veilbound Members</span></div><p>{status.cached?'Showing the latest saved roster':'Live roster synchronized'}{updated?` · Updated ${updated}`:''}</p></div>

    <div className="roster-controls ornamental">
      <label className="roster-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search names, ranks, jobs, levels, or worlds"/></label>
      <div className="roster-filters"><SlidersHorizontal size={17}/><select value={rank} onChange={e=>setRank(e.target.value)}><option>All ranks</option>{ranks.map(value=><option key={value}>{value}</option>)}</select><select value={job} onChange={e=>setJob(e.target.value)}><option>All jobs</option>{jobs.map(value=><option key={value}>{value}</option>)}</select><select value={sort} onChange={e=>setSort(e.target.value as SortKey)} aria-label="Sort roster"><option value="rank">Rank order</option><option value="name">Name</option><option value="level">Highest level</option><option value="job">Job</option></select></div>
      <button className="sync-button" onClick={()=>void load(true)} disabled={refreshing}><RefreshCw size={17} className={refreshing?'spin':''}/>{refreshing?'Syncing…':'Sync now'}</button>
    </div>

    {status.warning&&<div className="roster-warning">{status.warning}{members.length?' The most recently saved roster is shown below.':''}</div>}
    {loading?<div className="loading-veil">Listening for names in the mist…</div>:<div className="roster-grid expanded-roster">{shown.map(m=><article className="member-card expanded-card" key={m.id}>
      <div className="portrait-wrap"><img src={m.portrait} alt={m.name} loading="lazy"/><span className="rank-rune">{m.rank?.[0]||'•'}</span></div>
      <div className="member-details"><div className="member-title"><h2>{m.name}</h2><a href={m.profileUrl} target="_blank" rel="noreferrer" aria-label={`Open ${m.name} on Lodestone`}><ExternalLink size={18}/></a></div>
        <p className="member-world">{m.world||'World hidden in the mist'}</p>
        <div className="member-stat-grid">
          <div><span><Shield size={14}/>FC Rank</span><strong>{m.rank}</strong></div>
          <div><span><Sparkles size={14}/>Current Job</span><strong className="job-value">{m.jobIcon&&<img src={m.jobIcon} alt=""/>}{m.job||'Not shown'}</strong></div>
          <div><span>Level</span><strong className="level-value">{m.level??'—'}</strong></div>
        </div>
      </div>
    </article>)}</div>}
    {!loading&&!shown.length&&<div className="empty-state">No names answered the call.</div>}
  </section>;
}
