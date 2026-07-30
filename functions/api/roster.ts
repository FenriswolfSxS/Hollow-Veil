import { json, type Env } from '../_shared';

type Member={
  id:string;name:string;rank:string;portrait:string;profileUrl:string;world?:string;
  job?:string;jobIcon?:string;level?:number;grandCompany?:string;schemaVersion:number;
};
type CachedRoster={payload:string;updated_at:number};

const BASE='https://na.finalfantasyxiv.com';
const FC_ID='9232379236109663864';
const MAX_PAGES=20;
const CACHE_TTL=30*60*1000;
const SCHEMA_VERSION=6;
const PROFILE_CONCURRENCY=5;

const FC_RANKS=['Warden','Veilkeeper','Watcher','Echo','Keeper','Wanderer','Slumber'] as const;

const JOB_NAMES=[
  'Paladin','Warrior','Dark Knight','Gunbreaker','White Mage','Scholar','Astrologian','Sage',
  'Monk','Dragoon','Ninja','Samurai','Reaper','Viper','Bard','Machinist','Dancer',
  'Black Mage','Summoner','Red Mage','Pictomancer','Blue Mage',
  'Gladiator','Marauder','Conjurer','Arcanist','Pugilist','Lancer','Rogue','Archer','Thaumaturge',
  'Carpenter','Blacksmith','Armorer','Goldsmith','Leatherworker','Weaver','Alchemist','Culinarian',
  'Miner','Botanist','Fisher'
] as const;

function decode(value:string){
  return value
    .replace(/&amp;/gi,'&').replace(/&#39;|&#x27;/gi,"'").replace(/&quot;/gi,'"')
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&nbsp;/gi,' ')
    .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}

function getAttr(tag:string,name:string){
  return decode(tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`,'i'))?.[1]||'');
}

function absoluteUrl(source:string){
  if(!source)return '';
  if(source.startsWith('//'))return `https:${source}`;
  if(source.startsWith('/'))return `${BASE}${source}`;
  return source;
}

function assetKey(url:string){
  try{return new URL(absoluteUrl(url)).pathname.split('/').filter(Boolean).pop()?.toLowerCase()||'';}catch{return url.split('/').pop()?.split('?')[0]?.toLowerCase()||'';}
}

function firstClassText(block:string,className:string){
  const pattern=new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,'i');
  return decode(block.match(pattern)?.[1]||'');
}

function findBalancedElement(html:string,start:number,tagName:string){
  const openRe=new RegExp(`<${tagName}\\b[^>]*>`,'gi');
  const closeRe=new RegExp(`</${tagName}>`,'gi');
  openRe.lastIndex=start;
  const first=openRe.exec(html);
  if(!first||first.index!==start)return '';
  let depth=1;let cursor=openRe.lastIndex;
  while(depth>0){
    openRe.lastIndex=cursor;closeRe.lastIndex=cursor;
    const nextOpen=openRe.exec(html);const nextClose=closeRe.exec(html);
    if(!nextClose)return html.slice(start,Math.min(html.length,start+12000));
    if(nextOpen&&nextOpen.index<nextClose.index){depth++;cursor=openRe.lastIndex;}else{depth--;cursor=closeRe.lastIndex;}
  }
  return html.slice(start,cursor);
}

function memberAnchorBlocks(html:string){
  const result:{href:string;id:string;block:string}[]=[];
  const re=/<a\b[^>]*href=["'](\/lodestone\/character\/(\d+)\/?)['"][^>]*>/gi;
  for(const match of html.matchAll(re)){
    const start=match.index||0;
    const block=findBalancedElement(html,start,'a');
    if(block)result.push({href:match[1],id:match[2],block});
  }
  return result;
}

function imageTags(block:string){
  return [...block.matchAll(/<img\b[^>]*>/gi)].map(match=>({tag:match[0],index:match.index||0,src:absoluteUrl(getAttr(match[0],'data-src')||getAttr(match[0],'src'))})).filter(item=>item.src);
}

function findPortrait(block:string){
  const images=imageTags(block);
  for(const image of images){
    const width=Number(getAttr(image.tag,'width')||0),height=Number(getAttr(image.tag,'height')||0);
    const haystack=`${image.src} ${getAttr(image.tag,'class')} ${getAttr(image.tag,'alt')}`;
    if(/img2\.finalfantasyxiv\.com\/f\//i.test(image.src)||/face|portrait|entry__chara/i.test(haystack)||width>=64||height>=64)return image.src;
  }
  return '';
}

function findRank(block:string){
  const explicit=firstClassText(block,'entry__freecompany__fc-member__rank')||firstClassText(block,'entry__freecompany__rank');
  const exact=FC_RANKS.find(rank=>new RegExp(`^${rank}$`,'i').test(explicit));
  if(exact)return exact;
  const plain=decode(block);
  return FC_RANKS.find(rank=>new RegExp(`\\b${rank}\\b`,'i').test(plain))||'Unranked';
}

function findLevel(block:string,rank:string){
  const explicit=firstClassText(block,'entry__freecompany__fc-member__level')||firstClassText(block,'entry__freecompany__level');
  const direct=Number(explicit.match(/\b(100|[1-9]?\d)\b/)?.[1]);
  if(direct>=1&&direct<=100)return direct;

  const plain=decode(block);
  const rankPos=plain.toLowerCase().indexOf(rank.toLowerCase());
  const tail=rankPos>=0?plain.slice(rankPos+rank.length):plain;
  const values=[...tail.matchAll(/\b(100|[1-9]?\d)\b/g)].map(m=>Number(m[1])).filter(v=>v>=1&&v<=100);
  return values[0];
}

function findActiveJobIcon(block:string,rank:string,level:number|undefined){
  const images=imageTags(block);
  if(!images.length)return '';

  // In a Lodestone FC member row the order is portrait -> rank crest -> active class/job icon -> level -> GC crest.
  // We therefore choose the final small icon before the textual level, after the textual rank.
  const lower=block.toLowerCase();
  const rankIndex=lower.indexOf(rank.toLowerCase());
  const levelMatch=level?new RegExp(`>\\s*${level}\\s*<`,'i').exec(block.slice(Math.max(0,rankIndex))):null;
  const levelIndex=levelMatch?Math.max(0,rankIndex)+(levelMatch.index||0):-1;
  const small=images.filter(image=>{
    if(image.src===findPortrait(block))return false;
    const width=Number(getAttr(image.tag,'width')||0),height=Number(getAttr(image.tag,'height')||0);
    return (!width||width<=48)&&(!height||height<=48);
  });
  const between=small.filter(image=>image.index>rankIndex&&(levelIndex<0||image.index<levelIndex));
  if(between.length)return between[between.length-1].src;

  // Fallback: the job icon is usually the second small image in the row (after the FC-rank crest).
  return small[1]?.src||small[0]?.src||'';
}

function findWorld(block:string){
  return firstClassText(block,'entry__world')||decode(block.match(/([A-Za-z][A-Za-z' -]+\s*\[[A-Za-z]+\])/i)?.[1]||'')||undefined;
}

function findName(block:string){
  return firstClassText(block,'entry__name')||decode(block.match(/<p\b[^>]*class=["'][^"']*entry__name[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]||'');
}

function parseRosterPage(html:string):Member[]{
  const members:Member[]=[];
  for(const anchor of memberAnchorBlocks(html)){
    const name=findName(anchor.block);if(!name)continue;
    const rank=findRank(anchor.block);
    const level=findLevel(anchor.block,rank);
    const portrait=findPortrait(anchor.block);if(!portrait)continue;
    const jobIcon=findActiveJobIcon(anchor.block,rank,level);
    members.push({
      id:anchor.id,name,rank,level,jobIcon,portrait,
      profileUrl:`${BASE}${anchor.href}`,world:findWorld(anchor.block),schemaVersion:SCHEMA_VERSION
    });
  }
  return [...new Map(members.map(member=>[member.id,member])).values()];
}

function nearbyJobName(html:string,position:number){
  const before=decode(html.slice(Math.max(0,position-450),position));
  const after=decode(html.slice(position,Math.min(html.length,position+700)));
  const combined=`${after} ${before}`;
  return JOB_NAMES.find(name=>new RegExp(`\\b${name.replace(/ /g,'\\s+')}\\b`,'i').test(combined));
}

function classJobIconMap(html:string){
  const map=new Map<string,string>();
  for(const match of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=match[0];
    const src=absoluteUrl(getAttr(tag,'data-src')||getAttr(tag,'src'));
    if(!src)continue;
    const attrs=[getAttr(tag,'alt'),getAttr(tag,'title'),getAttr(tag,'data-tooltip'),getAttr(tag,'aria-label')].join(' ');
    let job=JOB_NAMES.find(name=>new RegExp(`\\b${name.replace(/ /g,'\\s+')}\\b`,'i').test(attrs));
    if(!job)job=nearbyJobName(html,match.index||0);
    if(job)map.set(assetKey(src),job);
  }
  return map;
}

function parseActiveProfile(html:string){
  const contentStart=html.search(/class=["'][^"']*character__content\s+selected/i);
  const region=contentStart>=0?html.slice(contentStart,contentStart+12000):html;
  const level=Number(decode(region).match(/\bLV\s*(100|[1-9]?\d)\b/i)?.[1]||0)||undefined;
  const images=imageTags(region);
  const active=images.find(image=>Number(getAttr(image.tag,'width'))===24&&Number(getAttr(image.tag,'height'))===24)
    ||images.find(image=>/character__class_icon|classjob/i.test(getAttr(image.tag,'class'))&& !/character__classjob$/i.test(getAttr(image.tag,'class')));
  return {level,jobIcon:active?.src||''};
}

async function fetchPage(url:string){
  const response=await fetch(url,{headers:{
    'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language':'en-US,en;q=0.9','cache-control':'no-cache','pragma':'no-cache',
    'referer':`${BASE}/lodestone/`,'cookie':'ldst_touchstone=1'
  },redirect:'follow'});
  if(!response.ok)throw new Error(`Lodestone returned ${response.status}`);
  const html=await response.text();
  if(/unsupported_browser|browser not recommended|access denied/i.test(response.url+' '+html))throw new Error('Lodestone rejected the request');
  return html;
}

async function enrichMember(member:Member):Promise<Member>{
  try{
    // The class/job page contains textual names beside every class/job icon. Matching the active
    // roster icon against that page is reliable and avoids guessing from an image hash.
    const classJobHtml=await fetchPage(`${member.profileUrl}class_job/`);
    const map=classJobIconMap(classJobHtml);
    let job=member.jobIcon?map.get(assetKey(member.jobIcon)):undefined;
    let level=member.level;
    let jobIcon=member.jobIcon;

    if(!job){
      // Profile header fallback: reads exactly the 24x24 active icon and LV value shown in the user's HTML.
      const profileHtml=await fetchPage(member.profileUrl);
      const active=parseActiveProfile(profileHtml);
      if(active.level)level=active.level;
      if(active.jobIcon){jobIcon=active.jobIcon;job=map.get(assetKey(active.jobIcon));}
    }

    return {...member,job,jobIcon,level,schemaVersion:SCHEMA_VERSION};
  }catch{return member;}
}

async function mapWithConcurrency<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>){
  const output=new Array<R>(items.length);let next=0;
  async function worker(){while(true){const index=next++;if(index>=items.length)return;output[index]=await fn(items[index]);}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>worker()));
  return output;
}

function totalPages(html:string){
  const pageNumbers=[...html.matchAll(/[?&](?:page|page_index)=(\d+)/gi)].map(match=>Number(match[1])).filter(Number.isFinite);
  const pageText=[...html.matchAll(/Page\s+\d+\s+of\s+(\d+)/gi)].map(match=>Number(match[1])).filter(Number.isFinite);
  return Math.min(MAX_PAGES,Math.max(1,...pageNumbers,...pageText));
}

async function readCache(env:Env):Promise<CachedRoster|null>{try{return await env.DB.prepare('SELECT payload,updated_at FROM roster_cache WHERE id=1').first<CachedRoster>();}catch{return null;}}
async function saveCache(env:Env,members:Member[],updatedAt:number){try{await env.DB.prepare(`INSERT INTO roster_cache(id,payload,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`).bind(JSON.stringify(members),updatedAt).run();}catch{/* optional cache */}}

function validCache(saved:Member[]){return saved.length>0&&saved.every(member=>member.schemaVersion===SCHEMA_VERSION&&member.rank&&member.rank!=='Unranked'&&member.jobIcon&&member.level);}

export const onRequestGet:PagesFunction<Env>=async({request,env})=>{
  const force=new URL(request.url).searchParams.get('refresh')==='1';
  const cached=await readCache(env);const age=cached?Date.now()-cached.updated_at:Infinity;
  if(!force&&cached&&age<CACHE_TTL){
    try{const saved=JSON.parse(cached.payload) as Member[];if(validCache(saved))return json({members:saved,cached:true,updatedAt:cached.updated_at});}catch{/* refresh */}
  }

  try{
    const rosterUrl=env.FC_MEMBERS_URL||`${BASE}/lodestone/freecompany/${FC_ID}/member/`;
    const firstHtml=await fetchPage(rosterUrl);const pages=totalPages(firstHtml);const all=parseRosterPage(firstHtml);
    for(let page=2;page<=pages;page++){const url=new URL(rosterUrl);url.searchParams.set('page',String(page));all.push(...parseRosterPage(await fetchPage(url.toString())));}
    const unique=[...new Map(all.map(member=>[member.id,member])).values()];
    if(!unique.length)throw new Error('The Lodestone page loaded, but no member rows could be read');

    const members=await mapWithConcurrency(unique,PROFILE_CONCURRENCY,enrichMember);
    const unresolved=members.filter(member=>!member.job||!member.level||member.rank==='Unranked');
    const updatedAt=Date.now();await saveCache(env,members,updatedAt);
    return json({members,cached:false,updatedAt,pages,warning:unresolved.length?`${unresolved.length} member record${unresolved.length===1?'':'s'} could not be fully resolved from Lodestone.`:undefined});
  }catch(error){
    const warning=error instanceof Error?error.message:'Live roster unavailable';
    let saved:Member[]=[];try{saved=cached?JSON.parse(cached.payload):[];}catch{/* empty */}
    return json({members:saved,cached:Boolean(saved.length),updatedAt:cached?.updated_at||null,warning},saved.length?200:502);
  }
};
