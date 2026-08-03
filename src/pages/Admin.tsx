import { Check, RefreshCw, ShieldCheck, UserCheck, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Claim={id:string;character_name:string;fc_rank:string;portrait:string|null;verification_code_hint:string;requested_at:number};
type RegisteredMember={id:string;characterName:string;rank:string;portrait:string;registeredAt:number};
type Me={authenticated:boolean;user?:{rank:string}};

export default function Admin(){
  const [me,setMe]=useState<Me|null>(null);
  const [claims,setClaims]=useState<Claim[]>([]);
  const [members,setMembers]=useState<RegisteredMember[]>([]);
  const [codes,setCodes]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const load=useCallback(async()=>{
    setError('');
    try{
      const [meResponse,claimsResponse,membersResponse]=await Promise.all([
        fetch('/api/me'),
        fetch('/api/admin/claims'),
        fetch('/api/admin/members'),
      ]);
      const meData=await meResponse.json() as Me;
      setMe(meData);
      const claimsData=await claimsResponse.json() as {requests?:Claim[];error?:string};
      const membersData=await membersResponse.json() as {members?:RegisteredMember[];error?:string};
      if(!claimsResponse.ok)throw new Error(claimsData.error||'Unable to open the claim ledger.');
      if(!membersResponse.ok)throw new Error(membersData.error||'Unable to open the registered-member ledger.');
      setClaims(claimsData.requests||[]);
      setMembers(membersData.members||[]);
    }catch(e){
      setError(e instanceof Error?e.message:'Unable to open the sealed ledger.');
    }
  },[]);

  useEffect(()=>{load();},[load]);

  const act=async(claim:Claim,action:'approve'|'reject')=>{
    setBusy(claim.id);setError('');setNotice('');
    try{
      const response=await fetch('/api/admin/claims',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({requestId:claim.id,action,code:codes[claim.id]||''}),
      });
      const data=await response.json() as {error?:string;characterName?:string};
      if(!response.ok)throw new Error(data.error||'The request could not be reviewed.');
      setCodes(value=>{const next={...value};delete next[claim.id];return next;});
      setNotice(action==='approve'?`${claim.character_name} has been welcomed into the Veil.`:`${claim.character_name}'s request was rejected.`);
      await load();
    }catch(e){
      setError(e instanceof Error?e.message:'The request could not be reviewed.');
    }finally{
      setBusy(null);
    }
  };

  if(me&&!me.authenticated)return <section className="page"><header className="page-heading"><p className="eyebrow">Officer ledger</p><h1>Admin</h1><p>Sign in to enter the sealed chamber.</p></header></section>;

  return <section className="page admin-page">
    <header className="page-heading admin-heading"><div><p className="eyebrow">The sealed ledger</p><h1>Admin</h1><p>Approve character claims after the member sends their generated code in-game.</p></div><button className="ghost-button" onClick={load}><RefreshCw size={17}/> Refresh</button></header>
    {error&&<p className="auth-error" role="alert">{error}</p>}{notice&&<p className="admin-success">{notice}</p>}

    <div className="admin-panel ornamental"><div className="admin-panel-title"><ShieldCheck/><div><h2>Pending Character Claims</h2><p>{claims.length} request{claims.length===1?'':'s'} awaiting review</p></div></div>
      {!claims.length?<div className="admin-empty"><h3>The ledger is quiet.</h3><p>No character claims are waiting for approval.</p></div>:<div className="claim-list">{claims.map(claim=><article className="claim-card" key={claim.id}>
        <div className="claim-identity">{claim.portrait?<img src={claim.portrait} alt=""/>:<div className="claim-avatar-fallback"/>}<div><h3>{claim.character_name}</h3><p>{claim.fc_rank} · requested {new Date(claim.requested_at).toLocaleString()}</p><small>Code ends in {claim.verification_code_hint}</small></div></div>
        <label>Verification code<input value={codes[claim.id]||''} onChange={e=>setCodes(v=>({...v,[claim.id]:e.target.value.toUpperCase()}))} placeholder="HV-XXXXXX" autoComplete="off"/></label>
        <div className="claim-actions"><button className="danger-button" disabled={busy===claim.id} onClick={()=>act(claim,'reject')}><X size={16}/> Reject</button><button className="gold-button" disabled={busy===claim.id||!(codes[claim.id]||'').trim()} onClick={()=>act(claim,'approve')}><Check size={16}/> Approve</button></div>
      </article>)}</div>}
    </div>

    <div className="admin-panel ornamental registered-panel"><div className="admin-panel-title"><UserCheck/><div><h2>Registered Members</h2><p>{members.length} approved account{members.length===1?'':'s'}</p></div></div>
      {!members.length?<div className="admin-empty"><h3>No names have been sealed.</h3><p>Approved character accounts will appear here.</p></div>:<div className="registered-list">{members.map(member=><article className="registered-card" key={member.id}>
        <img src={member.portrait} alt=""/>
        <div><h3>{member.characterName}</h3><p>{member.rank}</p><small>Registered {new Date(member.registeredAt).toLocaleString()}</small></div>
      </article>)}</div>}
    </div>
  </section>;
}
