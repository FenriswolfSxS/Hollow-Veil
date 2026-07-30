import type { Env } from '../_shared';
const ALLOWED_HOST='lds-img.finalfantasyxiv.com';
export const onRequestGet:PagesFunction<Env>=async({request})=>{
  const raw=new URL(request.url).searchParams.get('url');
  if(!raw)return new Response('Missing url',{status:400});
  let target:URL;try{target=new URL(raw);}catch{return new Response('Invalid url',{status:400});}
  if(target.protocol!=='https:'||target.hostname!==ALLOWED_HOST)return new Response('Unsupported icon host',{status:403});
  const response=await fetch(target.toString(),{headers:{'user-agent':'Mozilla/5.0','referer':'https://na.finalfantasyxiv.com/lodestone/'}});
  if(!response.ok)return new Response('Icon unavailable',{status:response.status});
  return new Response(response.body,{headers:{'content-type':response.headers.get('content-type')||'image/png','cache-control':'public, max-age=604800, immutable','access-control-allow-origin':'*'}});
};
