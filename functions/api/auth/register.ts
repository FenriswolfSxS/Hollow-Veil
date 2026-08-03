import { ensureCoreSchema, findRosterMember, hashPassword, hashVerificationCode, isFcRank, json, type Env } from '../../_shared';
type Body={username?:unknown;password?:unknown};
function makeCode(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes=crypto.getRandomValues(new Uint8Array(6));
  return `HV-${Array.from(bytes,b=>alphabet[b%alphabet.length]).join('')}`;
}
export const onRequestPost:PagesFunction<Env>=async({request,env})=>{
  try{
    await ensureCoreSchema(env);
    let body:Body;try{body=await request.json();}catch{return json({error:'Invalid request.'},400);}
    if(typeof body.username!=='string'||typeof body.password!=='string')return json({error:'Character name and password are required.'},400);
    const requested=body.username.trim(),password=body.password;
    if(password.length<10)return json({error:'Use a password with at least 10 characters.'},400);
    if(password.length>128)return json({error:'Password is too long.'},400);
    let member=await findRosterMember(env,requested);
    if(!member){try{await fetch(new URL('/api/roster',request.url),{headers:{accept:'application/json'}});}catch{}member=await findRosterMember(env,requested);}
    if(!member||!isFcRank(member.rank))return json({error:'That exact character name is not on the synchronized Hollow Veil roster. Open the roster and press Sync now first.'},403);
    const existing=await env.DB.prepare('SELECT id,password_hash FROM users WHERE lower(username)=lower(?) OR lower(character_name)=lower(?)').bind(member.name,member.name).first<{id:string;password_hash:string|null}>();
    if(existing?.password_hash)return json({error:'That character has already claimed an account. Use Sign In.'},409);
    const {hash,salt}=await hashPassword(password);
    const code=makeCode(),codeHash=await hashVerificationCode(code),now=Date.now(),id=crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO claim_requests
      (id,character_id,character_name,character_name_key,fc_rank,portrait,password_hash,password_salt,verification_code_hash,verification_code_hint,status,requested_at,reviewed_at,reviewed_by)
      VALUES(?,?,?,?,?,?,?,?,?,?, 'pending', ?,NULL,NULL)
      ON CONFLICT(character_name_key) DO UPDATE SET
        id=excluded.id,character_id=excluded.character_id,character_name=excluded.character_name,fc_rank=excluded.fc_rank,portrait=excluded.portrait,
        password_hash=excluded.password_hash,password_salt=excluded.password_salt,verification_code_hash=excluded.verification_code_hash,
        verification_code_hint=excluded.verification_code_hint,status='pending',requested_at=excluded.requested_at,reviewed_at=NULL,reviewed_by=NULL`).bind(
          id,member.id,member.name,member.name.trim().toLocaleLowerCase(),member.rank,member.portrait||null,hash,salt,codeHash,code.slice(-3),now
        ).run();
    return json({ok:true,pending:true,characterName:member.name,rank:member.rank,verificationCode:code,message:'Send this code in-game to a Warden, Veilkeeper, or Watcher. They will enter it in the Admin panel to approve your account.'},202);
  }catch(error){console.error('register failed',error);return json({error:error instanceof Error?`Claim request failed: ${error.message}`:'Claim request failed.'},500);}
};
