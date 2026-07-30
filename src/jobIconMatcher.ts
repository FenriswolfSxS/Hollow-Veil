export type JobDefinition={name:string;role:string;icon:string};

type Fingerprint={pixels:Float32Array;edge:Float32Array};
const SIZE=24;
const mappingCacheKey='hollow-veil-job-icon-map-v1';
let definitionsPromise:Promise<JobDefinition[]>|null=null;
let fingerprintsPromise:Promise<Map<string,Fingerprint>>|null=null;

export function loadJobDefinitions(){
  if(!definitionsPromise)definitionsPromise=fetch('/job-icons/manifest.json').then(r=>{if(!r.ok)throw new Error('Job icon manifest unavailable');return r.json() as Promise<JobDefinition[]>;});
  return definitionsPromise;
}

function loadImage(src:string){
  return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(`Could not load ${src}`));img.src=src;});
}

function fingerprintFromImage(img:HTMLImageElement):Fingerprint{
  const canvas=document.createElement('canvas');canvas.width=SIZE;canvas.height=SIZE;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Canvas unavailable');
  ctx.clearRect(0,0,SIZE,SIZE);ctx.drawImage(img,0,0,SIZE,SIZE);
  const data=ctx.getImageData(0,0,SIZE,SIZE).data;
  const pixels=new Float32Array(SIZE*SIZE),edge=new Float32Array(SIZE*SIZE);
  for(let i=0;i<SIZE*SIZE;i++){
    const a=data[i*4+3]/255,r=data[i*4],g=data[i*4+1],b=data[i*4+2];
    pixels[i]=a<.08?0:((r*.299+g*.587+b*.114)/255)*a;
  }
  for(let y=1;y<SIZE-1;y++)for(let x=1;x<SIZE-1;x++){
    const i=y*SIZE+x;const gx=pixels[i+1]-pixels[i-1],gy=pixels[i+SIZE]-pixels[i-SIZE];edge[i]=Math.min(1,Math.hypot(gx,gy));
  }
  const norm=(arr:Float32Array)=>{let mean=0;for(const v of arr)mean+=v;mean/=arr.length;let d=0;for(let i=0;i<arr.length;i++){arr[i]-=mean;d+=arr[i]*arr[i];}d=Math.sqrt(d)||1;for(let i=0;i<arr.length;i++)arr[i]/=d;};
  norm(pixels);norm(edge);return {pixels,edge};
}

async function localFingerprints(){
  if(!fingerprintsPromise)fingerprintsPromise=(async()=>{const defs=await loadJobDefinitions();const map=new Map<string,Fingerprint>();await Promise.all(defs.map(async d=>{map.set(d.name,fingerprintFromImage(await loadImage(d.icon)));}));return map;})();
  return fingerprintsPromise;
}
function similarity(a:Float32Array,b:Float32Array){let sum=0;for(let i=0;i<a.length;i++)sum+=a[i]*b[i];return sum;}
function remoteKey(url:string){try{return new URL(url).pathname.split('/').pop()||url;}catch{return url;}}
function readSaved(){try{return JSON.parse(localStorage.getItem(mappingCacheKey)||'{}') as Record<string,string>;}catch{return {};}}
function saveMatch(key:string,name:string){const saved=readSaved();saved[key]=name;localStorage.setItem(mappingCacheKey,JSON.stringify(saved));}

export async function identifyJob(remoteUrl:string):Promise<JobDefinition|undefined>{
  if(!remoteUrl)return undefined;
  const defs=await loadJobDefinitions();const key=remoteKey(remoteUrl);const saved=readSaved()[key];if(saved)return defs.find(d=>d.name===saved);
  const proxy=`/api/job-icon?url=${encodeURIComponent(remoteUrl)}`;
  const target=fingerprintFromImage(await loadImage(proxy));const locals=await localFingerprints();
  let best:JobDefinition|undefined,bestScore=-Infinity,second=-Infinity;
  for(const def of defs){const fp=locals.get(def.name);if(!fp)continue;const score=similarity(target.pixels,fp.pixels)*.35+similarity(target.edge,fp.edge)*.65;if(score>bestScore){second=bestScore;bestScore=score;best=def;}else if(score>second)second=score;}
  // Conservative threshold and separation prevent confidently assigning the wrong job.
  if(best&&bestScore>.55&&bestScore-second>.025){saveMatch(key,best.name);return best;}
  return undefined;
}
