import { json, type Env } from '../_shared';

type Member={id:string;name:string;rank:string;portrait:string;profileUrl:string;world?:string};

const BASE='https://na.finalfantasyxiv.com';
const MAX_PAGES=10;

function decode(value:string){
  return value
    .replace(/&amp;/g,'&').replace(/&#39;|&#x27;/g,"'").replace(/&quot;/g,'"')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
    .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}

function attr(tag:string,name:string){
  return tag.match(new RegExp(`${name}=["']([^"']+)["']`,'i'))?.[1]||'';
}

function parse(html:string):Member[]{
  const members:Member[]=[];
  const entries=html.match(/<li\b[^>]*class=["'][^"']*entry[^"']*["'][^>]*>[\s\S]*?<\/li>/gi)||[];

  for(const block of entries){
    const link=block.match(/<a\b[^>]*href=["'](\/lodestone\/character\/(\d+)\/?)['"][^>]*>/i);
    if(!link)continue;

    const id=link[2];
    const nameMatch=block.match(/class=["'][^"']*entry__name[^"']*["'][^>]*>([\s\S]*?)<\//i);
    const rankMatch=block.match(/class=["'][^"']*entry__freecompany__fc-member__rank[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
    const worldMatch=block.match(/class=["'][^"']*(?:entry__world|entry__freecompany__fc-member__world)[^"']*["'][^>]*>([\s\S]*?)<\//i);
    const imageTags=block.match(/<img\b[^>]*>/gi)||[];
    const portraitTag=imageTags.find(tag=>/img2\.finalfantasyxiv\.com|lds-img|js__image_popup/i.test(tag))||imageTags[0];
    const portrait=portraitTag?(attr(portraitTag,'data-src')||attr(portraitTag,'src')):'';
    const name=decode(nameMatch?.[1]||'');

    if(!name||!portrait)continue;
    members.push({
      id,
      name,
      rank:decode(rankMatch?.[1]||'Member'),
      world:decode(worldMatch?.[1]||'')||undefined,
      portrait:decode(portrait),
      profileUrl:`${BASE}${link[1]}`
    });
  }
  return members;
}

function totalPages(html:string){
  const links=[...html.matchAll(/[?&]page=(\d+)/gi)].map(m=>Number(m[1])).filter(Number.isFinite);
  return Math.min(MAX_PAGES,Math.max(1,...links));
}

async function fetchPage(url:string){
  const response=await fetch(url,{headers:{
    'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language':'en-US,en;q=0.9',
    'cache-control':'no-cache',
    'cookie':'ldst_touchstone=1'
  },redirect:'follow'});
  if(!response.ok)throw new Error(`Lodestone returned ${response.status}`);
  const html=await response.text();
  if(/unsupported_browser|browser not recommended/i.test(response.url+' '+html))throw new Error('Lodestone rejected the roster request');
  return html;
}

export const onRequestGet:PagesFunction<Env>=async({request,env})=>{
  const force=new URL(request.url).searchParams.get('refresh')==='1';
  const cached=await env.DB.prepare('SELECT payload,updated_at FROM roster_cache WHERE id=1').first<{payload:string;updated_at:number}>();
  const age=cached?Date.now()-cached.updated_at:Infinity;
  if(!force&&cached&&age<30*60*1000){
    return json({members:JSON.parse(cached.payload),cached:true,updatedAt:cached.updated_at});
  }

  try{
    const firstHtml=await fetchPage(env.FC_MEMBERS_URL);
    const pages=totalPages(firstHtml);
    const all=parse(firstHtml);

    for(let page=2;page<=pages;page++){
      const url=new URL(env.FC_MEMBERS_URL);
      url.searchParams.set('page',String(page));
      all.push(...parse(await fetchPage(url.toString())));
    }

    const unique=[...new Map(all.map(member=>[member.id,member])).values()];
    if(!unique.length)throw new Error('No roster members were found in the Lodestone response');

    await env.DB.prepare(`INSERT INTO roster_cache(id,payload,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`)
      .bind(JSON.stringify(unique),Date.now()).run();
    return json({members:unique,cached:false,updatedAt:Date.now(),pages});
  }catch(error){
    const warning=error instanceof Error?error.message:'Live roster unavailable';
    return json({members:cached?JSON.parse(cached.payload):[],cached:true,updatedAt:cached?.updated_at||null,warning},cached?200:503);
  }
};
