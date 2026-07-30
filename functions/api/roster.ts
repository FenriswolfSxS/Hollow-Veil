import { json, type Env } from '../_shared';

type Member={
  id:string;
  name:string;
  rank:string;
  portrait:string;
  profileUrl:string;
  world?:string;
  job?:string;
  jobIcon?:string;
  level?:number;
  grandCompany?:string;
  diagnostics?:{jobSource?:string;rawJobIcon?:string};
};
type CachedRoster={payload:string;updated_at:number};

const BASE='https://na.finalfantasyxiv.com';
const MAX_PAGES=20;
const CACHE_TTL=6*60*60*1000;
const CACHE_VERSION=7;

const JOB_BY_ID:Record<number,string>={
  1:'Gladiator',2:'Pugilist',3:'Marauder',4:'Lancer',5:'Archer',6:'Conjurer',7:'Thaumaturge',
  8:'Carpenter',9:'Blacksmith',10:'Armorer',11:'Goldsmith',12:'Leatherworker',13:'Weaver',14:'Alchemist',15:'Culinarian',
  16:'Miner',17:'Botanist',18:'Fisher',19:'Paladin',20:'Monk',21:'Warrior',22:'Dragoon',23:'Bard',24:'White Mage',
  25:'Black Mage',26:'Arcanist',27:'Summoner',28:'Scholar',29:'Rogue',30:'Ninja',31:'Machinist',32:'Dark Knight',
  33:'Astrologian',34:'Samurai',35:'Red Mage',36:'Blue Mage',37:'Gunbreaker',38:'Dancer',39:'Reaper',40:'Sage',
  41:'Viper',42:'Pictomancer'
};
const JOB_BY_CODE:Record<string,string>={
  gla:'Gladiator',pgl:'Pugilist',mrd:'Marauder',lnc:'Lancer',arc:'Archer',cnj:'Conjurer',thm:'Thaumaturge',
  crp:'Carpenter',bsm:'Blacksmith',arm:'Armorer',gsm:'Goldsmith',ltw:'Leatherworker',wvr:'Weaver',alc:'Alchemist',cul:'Culinarian',
  min:'Miner',btn:'Botanist',fsh:'Fisher',pld:'Paladin',mnk:'Monk',war:'Warrior',drg:'Dragoon',brd:'Bard',whm:'White Mage',
  blm:'Black Mage',acn:'Arcanist',smn:'Summoner',sch:'Scholar',rog:'Rogue',nin:'Ninja',mch:'Machinist',drk:'Dark Knight',
  ast:'Astrologian',sam:'Samurai',rdm:'Red Mage',blu:'Blue Mage',gnb:'Gunbreaker',dnc:'Dancer',rpr:'Reaper',sge:'Sage',
  vpr:'Viper',pct:'Pictomancer'
};
const JOB_NAMES=Object.values(JOB_BY_ID);

function decode(value:string){
  return value.replace(/&amp;/gi,'&').replace(/&#39;|&#x27;/gi,"'").replace(/&quot;/gi,'"')
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&nbsp;/gi,' ')
    .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}
function attr(tag:string,name:string){return decode(tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`,'i'))?.[1]||'');}
function absolute(source:string){if(!source)return '';if(source.startsWith('//'))return `https:${source}`;if(source.startsWith('/'))return `${BASE}${source}`;return source;}
function classText(block:string,classFragment:string){
  const match=block.match(new RegExp(`<([a-z0-9]+)[^>]*class=["'][^"']*${classFragment}[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,'i'));
  return decode(match?.[2]||'');
}
function classBlock(block:string,classFragment:string){
  return block.match(new RegExp(`<([a-z0-9]+)[^>]*class=["'][^"']*${classFragment}[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`,'i'))?.[0]||'';
}
function imageTags(block:string){return block.match(/<img\b[^>]*>/gi)||[];}
function styleImage(block:string){
  return absolute(block.match(/background(?:-image)?\s*:\s*url\(["']?([^"')]+)["']?\)/i)?.[1]||'');
}
function portrait(block:string){
  for(const tag of imageTags(block)){
    const source=attr(tag,'data-src')||attr(tag,'src');
    const hay=`${source} ${attr(tag,'class')} ${attr(tag,'alt')}`;
    if(/img2\.finalfantasyxiv\.com\/f\/|character.*face|face.*character|entry__chara__face/i.test(hay))return absolute(source);
  }
  return '';
}
function cleanJobName(value:string){
  const text=decode(value).replace(/^Class\s*\/\s*Job\s*[:\-]?\s*/i,'').replace(/\s+Lv\.?\s*\d{1,3}.*$/i,'').trim();
  return JOB_NAMES.find(name=>name.toLowerCase()===text.toLowerCase());
}
function jobFromToken(value:string){
  const decoded=decode(value);
  const direct=cleanJobName(decoded);if(direct)return direct;
  const code=decoded.match(/(?:classjob|class|job|cj)[_\-/]{1,3}([a-z]{3})(?:\b|[_\-/])/i)?.[1]?.toLowerCase();
  if(code&&JOB_BY_CODE[code])return JOB_BY_CODE[code];
  const candidates=[...decoded.matchAll(/(?:^|\D)(?:620)?0*(\d{1,2})(?:\D|$)/g)].map(m=>Number(m[1]));
  for(const id of candidates)if(JOB_BY_ID[id])return JOB_BY_ID[id];
  return undefined;
}
function parseJobArea(block:string){
  const fcArea=classBlock(block,'entry__freecompany__fc-member')||block;
  const rankArea=classBlock(fcArea,'fc-member__rank');
  const candidates=[
    classBlock(fcArea,'fc-member__class'),classBlock(fcArea,'fc-member__job'),classBlock(fcArea,'class_job'),fcArea
  ].filter(Boolean);
  for(const area of candidates){
    for(const tag of imageTags(area)){
      if(rankArea&&rankArea.includes(tag))continue;
      const source=attr(tag,'data-src')||attr(tag,'src');
      const metadata=[attr(tag,'alt'),attr(tag,'title'),attr(tag,'data-tooltip'),attr(tag,'aria-label'),attr(tag,'class'),source].join(' ');
      if(/grandcompany|freecompany\/crest|companycrest|character\/face|img2\.finalfantasyxiv\.com\/f\//i.test(metadata))continue;
      const job=jobFromToken(metadata);
      if(job)return {job,jobIcon:absolute(source),jobSource:'roster-image',rawJobIcon:source};
    }
    const cssUrl=styleImage(area);
    if(cssUrl){const job=jobFromToken(`${area} ${cssUrl}`);if(job)return {job,jobIcon:cssUrl,jobSource:'roster-css',rawJobIcon:cssUrl};}
    const job=jobFromToken(area);if(job)return {job,jobIcon:cssUrl||undefined,jobSource:'roster-markup',rawJobIcon:cssUrl||undefined};
  }
  return {};
}
function parseLevel(block:string){
  const exact=classText(block,'entry__freecompany__fc-member__level')||classText(block,'entry__freecompany__level');
  const exactNumber=Number(exact.match(/\b(100|[1-9]?\d)\b/)?.[1]);
  if(exactNumber>=1&&exactNumber<=100)return exactNumber;
  const fcArea=classBlock(block,'entry__freecompany__fc-member')||block;
  const numbers=[...decode(fcArea).matchAll(/\b(100|[1-9]?\d)\b/g)].map(m=>Number(m[1]));
  return numbers.reverse().find(value=>value>=1&&value<=100);
}
function parseRank(block:string){
  const values=[
    classText(block,'entry__freecompany__fc-member__rank'),
    classText(block,'entry__freecompany__rank'),
    classText(block,'fc-member__rank')
  ].filter(Boolean);
  return values[0]||'';
}
function memberBlock(html:string,start:number,next:number){
  const liStart=html.lastIndexOf('<li',start),liEnd=html.indexOf('</li>',start);
  if(liStart>=0&&liEnd>=0&&liEnd<next+12000)return html.slice(liStart,liEnd+5);
  return html.slice(start,Math.min(next,start+12000));
}

export function parseRosterHtml(html:string):Member[]{
  const links=[...html.matchAll(/<a\b[^>]*href=["'](\/lodestone\/character\/(\d+)\/?)['"][^>]*>/gi)];
  const out:Member[]=[];
  for(let i=0;i<links.length;i++){
    const link=links[i],start=link.index||0,next=links[i+1]?.index??html.length,block=memberBlock(html,start,next);
    const href=link[1],id=link[2];
    const name=classText(block,'entry__name')||attr(link[0],'title');
    const face=portrait(block);
    if(!name||!face)continue;
    const world=classText(block,'entry__world')||classText(block,'fc-member__world')||undefined;
    const rank=parseRank(block);
    const level=parseLevel(block);
    const found=parseJobArea(block);
    out.push({
      id,name,rank:rank||'Unranked',portrait:face,profileUrl:`${BASE}${href}`,world,
      job:found.job,jobIcon:found.jobIcon,level,
      grandCompany:classText(block,'fc-member__gc')||undefined,
      diagnostics:{jobSource:found.jobSource,rawJobIcon:found.rawJobIcon}
    });
  }
  return [...new Map(out.map(member=>[member.id,member])).values()];
}

function parseProfileCurrentJob(html:string){
  const likelyAreas=[
    classBlock(html,'character__class'),classBlock(html,'character__profile'),html.match(/<main[\s\S]*?<\/main>/i)?.[0]||html
  ];
  for(const area of likelyAreas){
    const textCandidates=[
      classText(area,'character__class__name'),classText(area,'character__class_name'),classText(area,'character__job'),
      attr(area.match(/<img\b[^>]*class=["'][^"']*(?:character__class|class_job)[^"']*["'][^>]*>/i)?.[0]||'','title'),
      attr(area.match(/<img\b[^>]*class=["'][^"']*(?:character__class|class_job)[^"']*["'][^>]*>/i)?.[0]||'','alt')
    ];
    for(const value of textCandidates){const job=cleanJobName(value);if(job)return {job,jobSource:'profile-text'};}
    for(const tag of imageTags(area)){
      const source=attr(tag,'data-src')||attr(tag,'src');
      const metadata=[attr(tag,'alt'),attr(tag,'title'),attr(tag,'data-tooltip'),attr(tag,'class'),source].join(' ');
      const job=jobFromToken(metadata);
      if(job&&/(character__class|class_job|classjob|620\d{2})/i.test(metadata))return {job,jobIcon:absolute(source),jobSource:'profile-image',rawJobIcon:source};
    }
  }
  return {};
}
function totalPages(html:string){
  const values=[...html.matchAll(/[?&](?:page|page_index)=(\d+)/gi),...html.matchAll(/Page\s+\d+\s+of\s+(\d+)/gi)].map(m=>Number(m[1]));
  return Math.min(MAX_PAGES,Math.max(1,...values.filter(Number.isFinite)));
}
async function fetchHtml(url:string){
  const response=await fetch(url,{headers:{
    'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language':'en-US,en;q=0.9','cache-control':'no-cache','pragma':'no-cache',
    'referer':`${BASE}/lodestone/`,'cookie':'ldst_touchstone=1; ldst_is_support_browser=1'
  },redirect:'follow'});
  if(!response.ok)throw new Error(`Lodestone returned ${response.status}`);
  const html=await response.text();
  if(/unsupported_browser|browser not recommended|access denied/i.test(response.url+' '+html))throw new Error('Lodestone rejected the request');
  return html;
}
async function enrichJob(member:Member){
  if(member.job)return member;
  for(const url of [member.profileUrl,`${member.profileUrl.replace(/\/$/,'')}/`]){
    try{
      const html=await fetchHtml(url);const found=parseProfileCurrentJob(html);
      if(found.job)return {...member,job:found.job,jobIcon:found.jobIcon||member.jobIcon,diagnostics:{jobSource:found.jobSource,rawJobIcon:found.rawJobIcon}};
    }catch{/* use roster data if profile is blocked */}
  }
  return member;
}
async function readCache(env:Env):Promise<CachedRoster|null>{try{return await env.DB.prepare('SELECT payload,updated_at FROM roster_cache WHERE id=1').first<CachedRoster>();}catch{return null;}}
async function saveCache(env:Env,members:Member[],updatedAt:number){try{await env.DB.prepare(`INSERT INTO roster_cache(id,payload,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`).bind(JSON.stringify({version:CACHE_VERSION,members}),updatedAt).run();}catch{/* optional cache */}}
function cachedMembers(cache:CachedRoster|null){
  if(!cache)return null;
  try{const parsed=JSON.parse(cache.payload);return parsed?.version===CACHE_VERSION&&Array.isArray(parsed.members)?parsed.members as Member[]:null;}catch{return null;}
}

export const onRequestGet:PagesFunction<Env>=async({request,env})=>{
  const force=new URL(request.url).searchParams.get('refresh')==='1';
  const cached=await readCache(env),saved=cachedMembers(cached),age=cached?Date.now()-cached.updated_at:Infinity;
  if(!force&&saved&&age<CACHE_TTL)return json({members:saved,cached:true,updatedAt:cached?.updated_at,cacheVersion:CACHE_VERSION});
  try{
    const rosterUrl=env.FC_MEMBERS_URL||`${BASE}/lodestone/freecompany/9232379236109663864/member/`;
    const first=await fetchHtml(rosterUrl),pages=totalPages(first),all=parseRosterHtml(first);
    for(let page=2;page<=pages;page++){const url=new URL(rosterUrl);url.searchParams.set('page',String(page));all.push(...parseRosterHtml(await fetchHtml(url.toString())));}
    let members=[...new Map(all.map(member=>[member.id,member])).values()];
    if(!members.length)throw new Error('The Lodestone page loaded, but no member cards could be read');
    members=await Promise.all(members.map(enrichJob));
    const incomplete=members.filter(member=>!member.rank||member.rank==='Unranked'||!member.level||!member.job);
    const updatedAt=Date.now();await saveCache(env,members,updatedAt);
    return json({members,cached:false,updatedAt,pages,cacheVersion:CACHE_VERSION,warning:incomplete.length?`${incomplete.length} member record${incomplete.length===1?' is':'s are'} missing a Lodestone job value.`:undefined});
  }catch(error){
    const warning=error instanceof Error?error.message:'Live roster unavailable';
    return json({members:saved||[],cached:Boolean(saved),updatedAt:cached?.updated_at||null,cacheVersion:CACHE_VERSION,warning},saved?200:502);
  }
};
