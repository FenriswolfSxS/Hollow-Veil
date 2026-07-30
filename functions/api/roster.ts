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

const JOB_NAMES=[
  'Paladin','Warrior','Dark Knight','Gunbreaker','White Mage','Scholar','Astrologian','Sage',
  'Monk','Dragoon','Ninja','Samurai','Reaper','Viper','Bard','Machinist','Dancer',
  'Black Mage','Summoner','Red Mage','Pictomancer','Blue Mage',
  'Gladiator','Marauder','Conjurer','Arcanist','Pugilist','Lancer','Rogue','Archer','Thaumaturge',
  'Carpenter','Blacksmith','Armorer','Goldsmith','Leatherworker','Weaver','Alchemist','Culinarian',
  'Miner','Botanist','Fisher'
];

const JOB_BY_ICON_ID:Record<number,string>={
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

function cleanJobLabel(value:string){
  const cleaned=decode(value).replace(/^Class\s*\/\s*Job\s*[:\-]?\s*/i,'').replace(/\s+Lv\.?\s*\d{1,3}.*$/i,'').trim();
  return JOB_NAMES.find(name=>new RegExp(`^${name.replace(' ','\\s+')}$`,'i').test(cleaned))||'';
}

function iconJob(tag:string,source:string){
  const haystack=`${source} ${getAttr(tag,'class')} ${getAttr(tag,'data-tooltip')} ${getAttr(tag,'title')} ${getAttr(tag,'alt')}`;
  const iconNumber=haystack.match(/(?:620|classjob(?:__icon)?(?:--|[-_]))0*(\d{1,2})(?:\D|$)/i)?.[1];
  if(iconNumber&&JOB_BY_ICON_ID[Number(iconNumber)])return JOB_BY_ICON_ID[Number(iconNumber)];
  const compact=haystack.match(/classjob[^0-9]{0,8}(\d{1,2})(?:\D|$)/i)?.[1];
  if(compact&&JOB_BY_ICON_ID[Number(compact)])return JOB_BY_ICON_ID[Number(compact)];
  const code=haystack.match(/(?:classjob|class|job)[-_]{1,2}([a-z]{3})(?:\b|[-_])/i)?.[1]?.toLowerCase();
  return code?JOB_BY_CODE[code]:undefined;
}

function findJob(block:string){
  const images=block.match(/<img\b[^>]*>/gi)||[];
  for(const tag of images){
    const source=getAttr(tag,'data-src')||getAttr(tag,'src');
    if(/img2\.finalfantasyxiv\.com\/f\//i.test(source))continue;
    const labels=[getAttr(tag,'title'),getAttr(tag,'alt'),getAttr(tag,'data-tooltip'),getAttr(tag,'aria-label')];
    for(const label of labels){
      const job=cleanJobLabel(label);
      if(job)return {job,jobIcon:absoluteUrl(source)};
    }
    const job=iconJob(tag,source);
    if(job)return {job,jobIcon:absoluteUrl(source)};
  }

  const attributeText=[...block.matchAll(/(?:title|alt|data-tooltip|aria-label)=["']([^"']+)["']/gi)].map(match=>decode(match[1]));
  for(const label of attributeText){const job=cleanJobLabel(label);if(job)return {job,jobIcon:undefined};}

  const plain=decode(block);
  for(const name of JOB_NAMES){
    if(new RegExp(`\\b${name.replace(' ','\\s+')}\\b`,'i').test(plain))return {job:name,jobIcon:undefined};
  }
  return {job:undefined,jobIcon:undefined};
}

function findLevel(block:string){
  const explicit=firstClassText(block,'entry__freecompany__fc-member__level')
    ||firstClassText(block,'entry__freecompany__level')
    ||firstClassText(block,'class__level');
  const candidates=(explicit?decode(explicit):decode(block)).match(/\b(?:Lv\.?\s*)?(100|[1-9]?\d)\b/gi)||[];
  for(let i=candidates.length-1;i>=0;i--){
    const value=Number(candidates[i].match(/\d+/)?.[0]);
    if(value>=1&&value<=100)return value;
  }
  return undefined;
}

function memberBlock(html:string,anchorIndex:number,nextAnchorIndex:number){
  const before=html.lastIndexOf('<li',anchorIndex);
  if(before>=0){
    const after=html.indexOf('</li>',anchorIndex);
    if(after>=0&&after<nextAnchorIndex+9000)return html.slice(before,after+5);
  }
  return html.slice(anchorIndex,Math.min(html.length,nextAnchorIndex,anchorIndex+9000));
}

function fallbackRank(block:string,name:string,world:string|undefined,level:number|undefined){
  let plain=decode(block);
  for(const value of [name,world])if(value)plain=plain.replace(value,' ');
  plain=plain.replace(/Page\s+\d+\s+of\s+\d+/gi,' ').replace(/\b(?:Lv\.?\s*)?\d{1,3}\b/gi,' ');
  for(const jobName of JOB_NAMES)plain=plain.replace(new RegExp(`\\b${jobName.replace(' ','\\s+')}\\b`,'gi'),' ');
  plain=plain.replace(/(?:View|Profile|Image|Character|Grand Company)/gi,' ').replace(/\s+/g,' ').trim();
  const candidates=plain.split(/\s{2,}|[|•·]/).map(value=>value.trim()).filter(Boolean);
  const known=plain.match(/\b(Warden|Veilkeeper|Watcher|Echo|Keeper|Wanderer|Slumber)\b/i)?.[1]
    ||candidates.find(value=>/^(Warden|Veilkeeper|Watcher|Echo|Keeper|Wanderer|Slumber)$/i.test(value));
  if(known)return known;
  const tail=plain.match(/([A-Za-z][A-Za-z' -]{1,30})$/)?.[1]?.trim();
  return tail||'Member';
}

function parse(html:string):Member[]{
  const members:Member[]=[];
  const links=[...html.matchAll(/<a\b[^>]*href=["'](\/lodestone\/character\/(\d+)\/?)['"][^>]*>/gi)];

  for(let i=0;i<links.length;i++){
    const match=links[i];
    const start=match.index||0;
    const next=links[i+1]?.index??Math.min(html.length,start+9000);
    const block=memberBlock(html,start,next);
    const href=match[1];
    const id=match[2];

    const name=firstClassText(block,'entry__name')
      ||decode(getAttr(match[0],'title'))
      ||decode(block.match(/<p\b[^>]*class=["'][^"']*entry__name[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]||'');
    if(!name)continue;

    const world=firstClassText(block,'entry__world')
      ||firstClassText(block,'entry__freecompany__fc-member__world')
      ||decode(block.match(/([A-Za-z][A-Za-z' -]+\s*\[[A-Za-z]+\])/i)?.[1]||'')
      ||undefined;
    const grandCompany=firstClassText(block,'entry__freecompany__fc-member__gc')
      ||firstClassText(block,'entry__freecompany__grandcompany')
      ||undefined;
    const portrait=findPortrait(block);
    if(!portrait)continue;
    const {job,jobIcon}=findJob(block);
    const level=findLevel(block);
    const rank=firstClassText(block,'entry__freecompany__fc-member__rank')
      ||firstClassText(block,'entry__freecompany__rank')
      ||firstClassText(block,'entry__freecompany__fc-member__name')
      ||fallbackRank(block,name,world,level);

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
  if(!force&&cached&&age<CACHE_TTL){
    const saved=JSON.parse(cached.payload) as Member[];
    const complete=saved.length>0&&saved.every(member=>Boolean(member.rank&&member.rank!=='Member'&&member.job&&member.level));
    if(complete)return json({members:saved,cached:true,updatedAt:cached.updated_at});
  }
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
