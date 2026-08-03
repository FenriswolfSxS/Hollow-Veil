export interface Env {
  DB: D1Database;
  SITE_URL?: string;
  FC_MEMBERS_URL?: string;
  DISCORD_INVITE_URL?: string;
  SESSION_SECRET?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
}

export type FcRank='Warden'|'Veilkeeper'|'Watcher'|'Echo'|'Keeper'|'Wanderer'|'Traveler'|'Slumber';
export type AppUser={id:string;discord_id:string;username:string;avatar:string|null;role:string;character_name:string|null};
export type RosterMember={id:string;name:string;rank:string;portrait?:string;profileUrl?:string;world?:string;job?:string;level?:number};

const FC_RANKS:FcRank[]=['Warden','Veilkeeper','Watcher','Echo','Keeper','Wanderer','Traveler','Slumber'];
const SESSION_MAX_AGE_SECONDS=60*60*24*90; // Keep trusted devices signed in for 90 days
const PBKDF2_ITERATIONS=100000; // Cloudflare Workers Web Crypto maximum

// Temporary testing override. Every authenticated FC member receives Warden-level
// site permissions while this is true. Their real FC rank is still stored.
export const TEST_ACCESS_MODE=false;
export function effectiveRank(rank:string):string{return TEST_ACCESS_MODE&&isFcRank(rank)?'Warden':rank;}

export function json(data:unknown,status=200,headers:HeadersInit={}){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
}
export function cookie(name:string,value:string,maxAge=SESSION_MAX_AGE_SECONDS){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;}
export function getCookie(req:Request,name:string){return req.headers.get('cookie')?.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1]||null;}

export async function ensureCoreSchema(env:Env){
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      avatar TEXT,
      role TEXT NOT NULL DEFAULT 'Wanderer',
      character_name TEXT,
      password_hash TEXT,
      password_salt TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'members',
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(created_by) REFERENCES users(id)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS event_signups (
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'going' CHECK(status IN ('going','maybe')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(event_id,user_id),
      FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS roster_cache (
      id INTEGER PRIMARY KEY CHECK(id=1),
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS roster_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL UNIQUE,
      rank TEXT NOT NULL,
      portrait TEXT,
      profile_url TEXT,
      world TEXT,
      job TEXT,
      level INTEGER,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS home_message (
      id INTEGER PRIMARY KEY CHECK(id=1),
      content TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      updated_by TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS claim_requests (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      character_name TEXT NOT NULL,
      character_name_key TEXT NOT NULL UNIQUE,
      fc_rank TEXT NOT NULL,
      portrait TEXT,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      verification_code_hash TEXT NOT NULL,
      verification_code_hint TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      requested_at INTEGER NOT NULL,
      reviewed_at INTEGER,
      reviewed_by TEXT
    )`),
  ]);
  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_character_name_nocase ON users(lower(character_name))').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_event_signups_event ON event_signups(event_id,status)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_roster_members_rank ON roster_members(rank)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON claim_requests(status,requested_at)').run();
}

const enc=new TextEncoder();
function b64url(input:ArrayBuffer|Uint8Array){const bytes=input instanceof Uint8Array?input:new Uint8Array(input);let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function fromB64url(value:string){const normalized=value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=');const raw=atob(normalized);return Uint8Array.from(raw,c=>c.charCodeAt(0));}
export async function hashPassword(password:string,salt?:Uint8Array){
  const actualSalt=salt||crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:actualSalt,iterations:PBKDF2_ITERATIONS},key,256);
  return {hash:b64url(bits),salt:b64url(actualSalt)};
}
export async function passwordMatches(password:string,salt:string,expected:string){
  try{const result=await hashPassword(password,fromB64url(salt));if(result.hash.length!==expected.length)return false;let diff=0;for(let i=0;i<expected.length;i++)diff|=result.hash.charCodeAt(i)^expected.charCodeAt(i);return diff===0;}catch{return false;}
}
export async function hashVerificationCode(code:string){
  const digest=await crypto.subtle.digest('SHA-256',enc.encode(code.trim().toUpperCase()));
  return b64url(digest);
}
export function canReviewClaims(rank:string){return ['Warden','Veilkeeper','Watcher'].includes(rank);}

export async function createSession(env:Env,userId:string){
  await ensureCoreSchema(env);
  const token=`${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g,'')}`;
  const now=Date.now();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now).run();
  await env.DB.prepare('INSERT INTO sessions(token,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(token,userId,now+SESSION_MAX_AGE_SECONDS*1000,now).run();
  return token;
}
export async function destroySession(req:Request,env:Env){const token=getCookie(req,'hv_session');if(token){await ensureCoreSchema(env);await env.DB.prepare('DELETE FROM sessions WHERE token=?').bind(token).run();}}

export async function mirrorRosterMembers(env:Env,members:RosterMember[],updatedAt=Date.now()){
  await ensureCoreSchema(env);
  const valid=members.filter(member=>member?.id&&member?.name&&member?.rank);
  if(!valid.length)return;
  // This table is only an authentication/permissions mirror. The working roster page
  // continues to use the existing roster_cache payload and parser unchanged.
  await env.DB.prepare('DELETE FROM roster_members').run();
  for(let start=0;start<valid.length;start+=40){
    const statements=valid.slice(start,start+40).map(member=>env.DB.prepare(`INSERT INTO roster_members
      (id,name,name_key,rank,portrait,profile_url,world,job,level,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(
        member.id,member.name,member.name.trim().toLocaleLowerCase(),member.rank,
        member.portrait||null,member.profileUrl||null,member.world||null,member.job||null,
        member.level??null,updatedAt
      ));
    await env.DB.batch(statements);
  }
}

export async function rosterMembers(env:Env):Promise<RosterMember[]>{
  await ensureCoreSchema(env);
  try{
    const rows=await env.DB.prepare(`SELECT id,name,rank,portrait,profile_url AS profileUrl,world,job,level
      FROM roster_members ORDER BY name`).all<RosterMember>();
    if(rows.results.length)return rows.results;
  }catch{/* fall through to the unchanged roster cache */}
  try{
    const row=await env.DB.prepare('SELECT payload,updated_at FROM roster_cache WHERE id=1').first<{payload:string;updated_at:number}>();
    if(!row)return [];
    const members=JSON.parse(row.payload) as RosterMember[];
    if(members.length){try{await mirrorRosterMembers(env,members,row.updated_at);}catch{/* cache remains authoritative */}}
    return members;
  }catch{return [];}
}
export async function findRosterMember(env:Env,name:string){
  await ensureCoreSchema(env);
  const normalized=name.trim().toLocaleLowerCase();
  if(!normalized)return null;
  try{
    const member=await env.DB.prepare(`SELECT id,name,rank,portrait,profile_url AS profileUrl,world,job,level
      FROM roster_members WHERE name_key=? LIMIT 1`).bind(normalized).first<RosterMember>();
    if(member)return member;
  }catch{/* use the existing cache fallback */}
  return (await rosterMembers(env)).find(member=>member.name.trim().toLocaleLowerCase()===normalized)||null;
}
export function isFcRank(value:string):value is FcRank{return FC_RANKS.includes(value as FcRank);}
export function canEditNotice(rank:string){return TEST_ACCESS_MODE?isFcRank(rank):['Warden','Veilkeeper','Watcher'].includes(rank);}
export function canCreate(rank:string){return ['Warden','Veilkeeper','Watcher'].includes(rank);}
export function canManageEvents(rank:string){return ['Warden','Veilkeeper','Watcher'].includes(rank);}
export function isMemberRank(rank:string){return isFcRank(rank);}

export async function currentUser(req:Request,env:Env):Promise<AppUser|null>{
  await ensureCoreSchema(env);
  const token=getCookie(req,'hv_session');if(!token)return null;
  const now=Date.now();
  const user=await env.DB.prepare(`SELECT u.id,u.discord_id,u.username,u.avatar,u.role,u.character_name
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token=? AND s.expires_at>?`).bind(token,now).first<AppUser>();
  if(!user)return null;
  const member=await findRosterMember(env,user.character_name||user.username);

  // While site-wide testing mode is enabled, every valid signed-in account receives
  // Warden-level access even if the roster mirror is temporarily unavailable.
  // Registration still requires an exact FC roster match, so this does not open
  // account creation to the public.
  if(TEST_ACCESS_MODE){
    if(member&&isFcRank(member.rank)){
      if(user.username!==member.name||user.character_name!==member.name||user.role!==member.rank||user.avatar!==(member.portrait||null)){
        await env.DB.prepare('UPDATE users SET username=?,character_name=?,role=?,avatar=?,updated_at=? WHERE id=?').bind(member.name,member.name,member.rank,member.portrait||null,now,user.id).run();
        user.username=member.name;user.character_name=member.name;user.role=member.rank;user.avatar=member.portrait||null;
      }
    }
    return {...user,role:'Warden'};
  }

  if(!member||!isFcRank(member.rank))return null;
  // Sliding device session: a valid member's database session is renewed on activity.
  // Every request still re-checks the live roster mirror and current FC rank first.
  await env.DB.prepare('UPDATE sessions SET expires_at=? WHERE token=?').bind(now+SESSION_MAX_AGE_SECONDS*1000,token).run();
  if(user.username!==member.name||user.character_name!==member.name||user.role!==member.rank||user.avatar!==(member.portrait||null)){
    await env.DB.prepare('UPDATE users SET username=?,character_name=?,role=?,avatar=?,updated_at=? WHERE id=?').bind(member.name,member.name,member.rank,member.portrait||null,now,user.id).run();
    user.username=member.name;user.character_name=member.name;user.role=member.rank;user.avatar=member.portrait||null;
  }
  return {...user,role:effectiveRank(member.rank)};
}
export function avatarUrl(discordId:string,avatar:string|null){
  if(avatar?.startsWith('http'))return avatar;
  if(discordId.startsWith('local:'))return '/android-chrome-192x192.png';
  return avatar?`https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=256`:`https://cdn.discordapp.com/embed/avatars/0.png`;
}
