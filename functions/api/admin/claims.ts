import { canReviewClaims, currentUser, ensureCoreSchema, hashVerificationCode, json, type Env } from '../../_shared';
type ClaimRow={id:string;character_id:string;character_name:string;fc_rank:string;portrait:string|null;verification_code_hint:string;requested_at:number};
export const onRequestGet:PagesFunction<Env>=async({request,env})=>{
  await ensureCoreSchema(env);
  const user=await currentUser(request,env);
  if(!user)return json({error:'Sign in required.'},401);
  if(!canReviewClaims(user.role))return json({error:'Officer access required.'},403);
  const rows=await env.DB.prepare(`SELECT id,character_id,character_name,fc_rank,portrait,verification_code_hint,requested_at
    FROM claim_requests WHERE status='pending' ORDER BY requested_at ASC`).all<ClaimRow>();
  return json({requests:rows.results});
};
type Body={action?:unknown;requestId?:unknown;code?:unknown};
export const onRequestPost:PagesFunction<Env>=async({request,env})=>{
  try{
    await ensureCoreSchema(env);
    const officer=await currentUser(request,env);
    if(!officer)return json({error:'Sign in required.'},401);
    if(!canReviewClaims(officer.role))return json({error:'Officer access required.'},403);
    let body:Body;try{body=await request.json();}catch{return json({error:'Invalid request.'},400);}
    if(typeof body.requestId!=='string'||!body.requestId)return json({error:'A claim request is required.'},400);
    const claim=await env.DB.prepare(`SELECT * FROM claim_requests WHERE id=? AND status='pending'`).bind(body.requestId).first<any>();
    if(!claim)return json({error:'That request is no longer pending.'},404);
    if(body.action==='reject'){
      await env.DB.prepare(`UPDATE claim_requests SET status='rejected',reviewed_at=?,reviewed_by=? WHERE id=?`).bind(Date.now(),officer.id,claim.id).run();
      return json({ok:true,status:'rejected'});
    }
    if(body.action!=='approve')return json({error:'Unknown action.'},400);
    if(typeof body.code!=='string'||!body.code.trim())return json({error:'Enter the verification code supplied by the member.'},400);
    const provided=await hashVerificationCode(body.code);
    if(provided!==claim.verification_code_hash)return json({error:'That verification code does not match this request.'},403);
    const now=Date.now();
    const existing=await env.DB.prepare(`SELECT id FROM users WHERE lower(character_name)=lower(?) OR lower(username)=lower(?)`).bind(claim.character_name,claim.character_name).first<{id:string}>();
    const id=existing?.id||crypto.randomUUID();
    if(existing){
      await env.DB.prepare(`UPDATE users SET discord_id=?,username=?,avatar=?,role=?,character_name=?,password_hash=?,password_salt=?,updated_at=? WHERE id=?`).bind(
        `local:${id}`,claim.character_name,claim.portrait,claim.fc_rank,claim.character_name,claim.password_hash,claim.password_salt,now,id).run();
    }else{
      await env.DB.prepare(`INSERT INTO users(id,discord_id,username,avatar,role,character_name,password_hash,password_salt,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id,`local:${id}`,claim.character_name,claim.portrait,claim.fc_rank,claim.character_name,claim.password_hash,claim.password_salt,now,now).run();
    }
    await env.DB.prepare(`UPDATE claim_requests SET status='approved',reviewed_at=?,reviewed_by=? WHERE id=?`).bind(now,officer.id,claim.id).run();
    return json({ok:true,status:'approved',characterName:claim.character_name});
  }catch(error){console.error('claim review failed',error);return json({error:error instanceof Error?error.message:'Claim review failed.'},500);}
};
