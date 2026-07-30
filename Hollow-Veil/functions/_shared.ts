export interface Env {
  DB: D1Database;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  SITE_URL: string;
  FC_MEMBERS_URL: string;
  DISCORD_INVITE_URL: string;
}
export type AppUser={id:string;discord_id:string;username:string;avatar:string|null;role:string;character_name:string|null};

const enc=new TextEncoder();
function b64url(input:ArrayBuffer|Uint8Array|string){const bytes=typeof input==='string'?enc.encode(input):input instanceof Uint8Array?input:new Uint8Array(input);let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export async function sign(value:string,secret:string){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return `${b64url(value)}.${b64url(await crypto.subtle.sign('HMAC',key,enc.encode(value)))}`;}
export async function verify(token:string,secret:string){const [payload,sig]=token.split('.');if(!payload||!sig)return null;const value=atob(payload.replace(/-/g,'+').replace(/_/g,'/'));const expected=await sign(value,secret);if(expected!==token)return null;return value;}
export function cookie(name:string,value:string,maxAge=604800){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;}
export function json(data:unknown,status=200,headers:HeadersInit={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}})}
export async function currentUser(req:Request,env:Env):Promise<AppUser|null>{const raw=req.headers.get('cookie')?.match(/(?:^|; )hv_session=([^;]+)/)?.[1];if(!raw)return null;const id=await verify(raw,env.SESSION_SECRET);if(!id)return null;return env.DB.prepare('SELECT id,discord_id,username,avatar,role,character_name FROM users WHERE id=?').bind(id).first<AppUser>();}
export function avatarUrl(discordId:string,avatar:string|null){return avatar?`https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=256`:`https://cdn.discordapp.com/embed/avatars/${Number(BigInt(discordId)%6n)}.png`;}
export function canCreate(role:string){return ['member','host','officer','admin','owner'].includes(role)}
