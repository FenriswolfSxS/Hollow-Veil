import { json, type Env } from '../_shared';

type Member={
  id:string;name:string;rank:string;portrait:string;profileUrl:string;world?:string;
  job?:string;jobIcon?:string;level?:number;grandCompany?:string;
};
type CachedRoster={payload:string;updated_at:number};

const BASE='https://na.finalfantasyxiv.com';
const MAX_PAGES=20;
const CACHE_TTL=30*60*1000;

function decode(value:string){
  return value
    .replace(/&amp;/gi,'&').replace(/&#39;|&#x27;/gi,"'").replace(/&quot;/gi,'"')
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&nbsp;/gi,' ')
    .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}

function getAttr(tag:string,name:string){
  return decode(tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`,'i'))?.[1]||'');
}

function firstClassText(block:string,className:string){
  const pattern=new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,'i');
  return decode(block.match(pattern)?.[1]||'');
}

function firstClassBlock(block:string,className:string){
  const pattern=new RegExp(`<([a-z0-9]+)[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,'i');
  return block.match(pattern)?.[0]||'';
}

function absoluteUrl(source:string){
  if(!source)return '';
  if(source.startsWith('//'))return `https:${source}`;
  if(source.startsWith('/'))return `${BASE}${source}`;
  return source;
}

function findPortrait(block:string){
  const images=block.match(/<img\b[^>]*>/gi)||[];
  for(const tag of images){
    const source=getAttr(tag,'data-src')||getAttr(tag,'src');
    if(!source)continue;
    if(/img2\.finalfantasyxiv\.com\/f\//i.test(source))return absoluteUrl(source);
    if(/character|face|chara/i.test(getAttr(tag,'class')+' '+getAttr(tag,'alt')))return absoluteUrl(source);
  }
  return '';
}

function findJob(block:string){
  const classBlock=firstClassBlock(block,'entry__freecompany__fc-member__class')
    ||firstClassBlock(block,'entry__freecompany__class')
    ||block;
  const images=classBlock.match(/<img\b[^>]*>/gi)||[];
  for(const tag of images){
    const source=getAttr(tag,'data-src')||getAttr(tag,'src');
    const label=getAttr(tag,'title')||getAttr(tag,'alt')||getAttr(tag,'data-tooltip');
    if(label&&!/character|portrait|face/i.test(label)){
      return {job:label.replace(/^Class\/Job\s*[:\-]?\s*/i,''),jobIcon:absoluteUrl(source)};
    }
  }
  const text=decode(classBlock);
  const withoutLevel=text.replace(/\b(?:Lv\.?\s*)?\d{1,3}\b/gi,'').trim();
  return {job:withoutLevel||undefined,jobIcon:undefined};
}

function findLevel(block:string){
  const explicit=firstClassText(block,'entry__freecompany__fc-member__level')
    ||firstClassText(block,'entry__freecompany__level')
    ||firstClassText(block,'class__level');
  const match=(explicit||decode(firstClassBlock(block,'entry__freecompany__fc-member__class')))
    .match(/(?:Lv\.?\s*)?(\d{1,3})\b/i);
  const level=match?Number(match[1]):undefined;
  return level&&level<=100?level:undefined;
}

function parse(html:string):Member[]{
  const members:Member[]=[];
  const links=[...html.matchAll(/<a\b[^>]*href=["'](\/lodestone\/character\/(\d+)\/?)['"][^>]*>/gi)];

  for(let i=0;i<links.length;i++){
    const match=links[i];
    const start=match.index||0;
    const next=links[i+1]?.index??Math.min(html.length,start+9000);
    const block=html.slice(start,Math.min(next,start+9000));
    const href=match[1];
    const id=match[2];

    const name=firstClassText(block,'entry__name')
      ||decode(getAttr(match[0],'title'))
      ||decode(block.match(/<p\b[^>]*class=["'][^"']*entry__name[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]||'');
    if(!name)continue;

    const rank=firstClassText(block,'entry__freecompany__fc-member__rank')
      ||firstClassText(block,'entry__freecompany__rank')
      ||'Member';
    const world=firstClassText(block,'entry__world')
      ||firstClassText(block,'entry__freecompany__fc-member__world')
      ||undefined;
    const grandCompany=firstClassText(block,'entry__freecompany__fc-member__gc')
      ||firstClassText(block,'entry__freecompany__grandcompany')
      ||undefined;
    const portrait=findPortrait(block);
    if(!portrait)continue;
    const {job,jobIcon}=findJob(block);
    const level=findLevel(block);

    members.push({id,name,rank,world,portrait,profileUrl:`${BASE}${href}`,job,jobIcon,level,grandCompany});
  }

  return [...new Map(members.map(member=>[member.id,member])).values()];
}

function totalPages(html:string){
  const pageNumbers=[...html.matchAll(/[?&](?:page|page_index)=(\d+)/gi)]
    .map(match=>Number(match[1])).filter(Number.isFinite);
  const pageText=[...html.matchAll(/Page\s+\d+\s+of\s+(\d+)/gi)]
    .map(match=>Number(match[1])).filter(Number.isFinite);
  return Math.min(MAX_PAGES,Math.max(1,...pageNumbers,...pageText));
}

async function fetchPage(url:string){
  const response=await fetch(url,{headers:{
    'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language':'en-US,en;q=0.9','cache-control':'no-cache','pragma':'no-cache',
    'referer':'https://na.finalfantasyxiv.com/lodestone/freecompany/','cookie':'ldst_touchstone=1'
  },redirect:'follow'});
  if(!response.ok)throw new Error(`Lodestone returned ${response.status}`);
  const html=await response.text();
  if(/unsupported_browser|browser not recommended|access denied/i.test(response.url+' '+html))throw new Error('Lodestone rejected the roster request');
  return html;
}

async function readCache(env:Env):Promise<CachedRoster|null>{try{return await env.DB.prepare('SELECT payload,updated_at FROM roster_cache WHERE id=1').first<CachedRoster>();}catch{return null;}}
async function saveCache(env:Env,members:Member[],updatedAt:number){try{await env.DB.prepare(`INSERT INTO roster_cache(id,payload,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`).bind(JSON.stringify(members),updatedAt).run();}catch{/* optional cache */}}

export const onRequestGet:PagesFunction<Env>=async({request,env})=>{
  const force=new URL(request.url).searchParams.get('refresh')==='1';
  const cached=await readCache(env); const age=cached?Date.now()-cached.updated_at:Infinity;
  if(!force&&cached&&age<CACHE_TTL)return json({members:JSON.parse(cached.payload),cached:true,updatedAt:cached.updated_at});
  try{
    const rosterUrl=env.FC_MEMBERS_URL||`${BASE}/lodestone/freecompany/9232379236109663864/member/`;
    const firstHtml=await fetchPage(rosterUrl); const pages=totalPages(firstHtml); const all=parse(firstHtml);
    for(let page=2;page<=pages;page++){const url=new URL(rosterUrl);url.searchParams.set('page',String(page));all.push(...parse(await fetchPage(url.toString())));}
    const unique=[...new Map(all.map(member=>[member.id,member])).values()];
    if(!unique.length)throw new Error('The Lodestone page loaded, but no member cards could be read');
    const updatedAt=Date.now();await saveCache(env,unique,updatedAt);
    return json({members:unique,cached:false,updatedAt,pages});
  }catch(error){
    const warning=error instanceof Error?error.message:'Live roster unavailable';
    return json({members:cached?JSON.parse(cached.payload):[],cached:Boolean(cached),updatedAt:cached?.updated_at||null,warning},cached?200:502);
  }
};
