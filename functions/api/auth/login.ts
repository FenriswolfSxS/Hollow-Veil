import { cookie, createSession, ensureCoreSchema, findRosterMember, isFcRank, json, passwordMatches, type Env } from '../../_shared';
type Body={username?:unknown;password?:unknown};
export const onRequestPost:PagesFunction<Env>=async({request,env})=>{
  try{
    await ensureCoreSchema(env);
    let body:Body;try{body=await request.json();}catch{return json({error:'Invalid request.'},400);}
    if(typeof body.username!=='string'||typeof body.password!=='string')return json({error:'Character name and password are required.'},400);
    let member=await findRosterMember(env,body.username);
    if(!member){
      try{await fetch(new URL('/api/roster',request.url),{headers:{accept:'application/json'}});}catch{/* return the normal roster message below */}
      member=await findRosterMember(env,body.username);
    }
    if(!member||!isFcRank(member.rank))return json({error:'This character is not currently on the Hollow Veil roster.'},403);
    const user=await env.DB.prepare('SELECT id,password_hash,password_salt FROM users WHERE lower(character_name)=lower(?)').bind(member.name).first<{id:string;password_hash:string|null;password_salt:string|null}>();
    if(!user?.password_hash||!user.password_salt){
      const pending=await env.DB.prepare(`SELECT status FROM claim_requests WHERE character_name_key=? ORDER BY requested_at DESC LIMIT 1`).bind(member.name.trim().toLocaleLowerCase()).first<{status:string}>();
      if(pending?.status==='pending')return json({error:'Your character claim is waiting for officer approval.'},403);
      return json({error:'No approved site account exists for this character yet.'},404);
    }
    if(!(await passwordMatches(body.password,user.password_salt,user.password_hash)))return json({error:'The password is incorrect.'},401);
    await env.DB.prepare('UPDATE users SET username=?,avatar=?,role=?,character_name=?,updated_at=? WHERE id=?').bind(member.name,member.portrait||null,member.rank,member.name,Date.now(),user.id).run();
    const token=await createSession(env,user.id);
    return json({ok:true,user:{username:member.name,rank:member.rank}},200,{'set-cookie':cookie('hv_session',token)});
  }catch(error){console.error('login failed',error);return json({error:error instanceof Error?`Sign in failed: ${error.message}`:'Sign in failed.'},500);}
};
