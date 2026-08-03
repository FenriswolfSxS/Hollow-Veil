export type RitualPhase = 'idle'|'omen'|'apparition'|'fog'|'blackout'|'song'|'ending';

type EyeKind = 'wolf'|'demon'|'pale';
type EyePair = { x:number; y:number; scale:number; angle:number; alpha:number; phase:number; blink:number; kind:EyeKind; drift:number };
type FogWisp = { x:number; y:number; radius:number; speed:number; alpha:number; phase:number; depth:number };
type Ash = { x:number; y:number; vx:number; vy:number; size:number; alpha:number; life:number };
type Root = { points:{x:number;y:number}[]; alpha:number; width:number; growth:number };

const TAU = Math.PI * 2;
const clamp = (v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp = (a:number,b:number,t:number)=>a+(b-a)*t;
const rand = (a:number,b:number)=>a+Math.random()*(b-a);

export class ForestEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private width = 0;
  private height = 0;
  private raf = 0;
  private startedAt = performance.now();
  private phase: RitualPhase = 'idle';
  private phaseAt = performance.now();
  private girl = new Image();
  private girlReady = false;
  private girlOpacity = 0;
  private girlTarget = 0;
  private girlPulse = 0;
  private flash = 0;
  private vignette = 0;
  private darkness = 0;
  private fogStrength = 0;
  private shake = 0;
  private rootsStrength = 0;
  private pointer = {x:0.5,y:0.5};
  private eyes: EyePair[] = [];
  private fog: FogWisp[] = [];
  private ash: Ash[] = [];
  private roots: Root[] = [];
  private audio?: HTMLAudioElement;
  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private frequency?: Uint8Array<ArrayBuffer>;
  private bass = 0;
  private mids = 0;
  private highs = 0;
  private onSongEnded?: () => void;

  constructor(canvas: HTMLCanvasElement, girlSrc: string) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    this.girl.src = girlSrc;
    this.girl.onload = () => { this.girlReady = true; };
    this.resize();
    this.seed();
    this.canvas.addEventListener('pointermove', this.onPointer);
    window.addEventListener('resize', this.resize);
    this.raf = requestAnimationFrame(this.render);
  }

  destroy = () => {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointermove', this.onPointer);
    window.removeEventListener('resize', this.resize);
    this.audio?.pause();
    void this.audioCtx?.close();
  };

  setPhase = (phase: RitualPhase) => {
    this.phase = phase;
    this.phaseAt = performance.now();
    if (phase === 'omen') { this.darkness = Math.max(this.darkness, .05); }
    if (phase === 'apparition') { this.girlTarget = .6; this.flash = 1; this.darkness = .18; }
    if (phase === 'fog') { this.fogStrength = .9; this.darkness = .32; this.girlTarget = .36; }
    if (phase === 'blackout') { this.darkness = 1; this.vignette = 1; this.fogStrength = .15; this.girlTarget = 0; this.rootsStrength = 1; }
    if (phase === 'song') { this.darkness = .78; this.fogStrength = .95; this.girlTarget = .22; this.rootsStrength = .55; }
    if (phase === 'ending') { this.darkness = 1; this.girlTarget = 0; this.fogStrength = 0; }
    if (phase === 'idle') { this.darkness = 0; this.vignette = 0; this.fogStrength = 0; this.girlTarget = 0; this.rootsStrength = 0; this.flash = 0; }
  };

  pulseFlash = (strength = 1) => { this.flash = Math.max(this.flash, strength); this.shake = Math.max(this.shake, strength * 8); };
  revealGirl = (opacity = .7) => { this.girlTarget = opacity; this.girlPulse = 1; };
  setFog = (strength:number) => { this.fogStrength = clamp(strength); };
  setDarkness = (strength:number) => { this.darkness = clamp(strength); };

  playHiddenSong = async (src: string, onEnded: () => void) => {
    this.onSongEnded = onEnded;
    this.audio = new Audio(src);
    this.audio.preload = 'auto';
    this.audio.volume = .92;
    this.audio.addEventListener('ended', () => this.onSongEnded?.(), { once:true });
    try {
      this.audioCtx = new AudioContext();
      const source = this.audioCtx.createMediaElementSource(this.audio);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = .82;
      this.frequency = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      source.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      await this.audioCtx.resume();
    } catch { /* playback remains available without analysis */ }
    await this.audio.play();
  };

  stopSong = () => {
    if (this.audio) { this.audio.pause(); this.audio.currentTime = 0; }
    void this.audioCtx?.close();
    this.audio = undefined; this.audioCtx = undefined; this.analyser = undefined; this.frequency = undefined;
  };

  private resize = () => {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
  };

  private onPointer = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = clamp((event.clientX - rect.left) / rect.width);
    this.pointer.y = clamp((event.clientY - rect.top) / rect.height);
  };

  private seed = () => {
    this.eyes = Array.from({length:42},(_,i)=>({
      x: rand(.05,.95), y: rand(.08,.9), scale: rand(.42,1.35), angle: rand(-.22,.22), alpha: rand(.35,.9),
      phase: rand(0,TAU), blink: rand(2.5,8), kind: i%5===0?'demon':i%3===0?'pale':'wolf', drift: rand(.4,1.4)
    }));
    this.fog = Array.from({length:48},()=>({ x:rand(-.2,1.2),y:rand(.48,1.1),radius:rand(.12,.34),speed:rand(.004,.018),alpha:rand(.03,.12),phase:rand(0,TAU),depth:rand(.4,1.3) }));
    this.ash = Array.from({length:100},()=>({ x:Math.random(),y:Math.random(),vx:rand(-.0002,.0002),vy:rand(-.0011,-.00025),size:rand(.5,2.2),alpha:rand(.15,.65),life:Math.random() }));
    this.roots = Array.from({length:18},(_,i)=>{
      const fromLeft=i%2===0; let x=fromLeft?-0.05:1.05; let y=rand(.05,.95); const pts=[{x,y}];
      for(let p=0;p<8;p++){ x += (fromLeft?1:-1)*rand(.035,.09); y += rand(-.075,.075); pts.push({x,y}); }
      return {points:pts,alpha:rand(.22,.55),width:rand(1.2,3.8),growth:rand(.65,1)};
    });
  };

  private analyseAudio = () => {
    if (!this.analyser || !this.frequency) { this.bass*=.94; this.mids*=.94; this.highs*=.94; return; }
    this.analyser.getByteFrequencyData(this.frequency);
    const avg=(a:number,b:number)=>{let s=0;for(let i=a;i<b;i++)s+=this.frequency![i]||0;return s/Math.max(1,b-a)/255;};
    this.bass=lerp(this.bass,avg(0,16),.22);
    this.mids=lerp(this.mids,avg(16,90),.18);
    this.highs=lerp(this.highs,avg(90,190),.16);
  };

  private render = (now:number) => {
    const t=(now-this.startedAt)/1000; const phaseTime=(now-this.phaseAt)/1000;
    this.analyseAudio();
    const ctx=this.ctx; ctx.setTransform(this.dpr,0,0,this.dpr,0,0); ctx.clearRect(0,0,this.width,this.height);
    this.flash*=.88; this.shake*=.86; this.girlPulse*=.92;
    this.girlOpacity=lerp(this.girlOpacity,this.girlTarget,.035);
    if(this.phase==='song'){
      this.darkness=clamp(.68 + this.bass*.24);
      this.fogStrength=clamp(.65 + this.mids*.45);
      this.shake=Math.max(this.shake,Math.max(0,this.bass-.56)*30);
      if(this.highs>.52 && Math.sin(t*13)> .9) this.girlPulse=.8;
    }
    const sx=rand(-this.shake,this.shake), sy=rand(-this.shake,this.shake);
    ctx.save(); ctx.translate(sx,sy);
    this.drawDarkness(ctx,t);
    this.drawFog(ctx,t);
    this.drawRoots(ctx,t,phaseTime);
    this.drawGirl(ctx,t,phaseTime);
    this.drawAsh(ctx,t);
    this.drawEyes(ctx,t,phaseTime);
    this.drawFilm(ctx,t);
    ctx.restore();
    if(this.flash>.01){ctx.fillStyle=`rgba(185,18,22,${this.flash*.36})`;ctx.fillRect(0,0,this.width,this.height);}
    this.raf=requestAnimationFrame(this.render);
  };

  private drawDarkness(ctx:CanvasRenderingContext2D,t:number){
    if(this.darkness<=.001)return;
    const breath=this.phase==='song'?(Math.sin(t*1.1)*.025+this.bass*.08):0;
    ctx.fillStyle=`rgba(0,2,3,${clamp(this.darkness+breath)})`;ctx.fillRect(0,0,this.width,this.height);
    const g=ctx.createRadialGradient(this.width*.5,this.height*.48,0,this.width*.5,this.height*.48,Math.max(this.width,this.height)*.72);
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.58,`rgba(0,0,0,${.16+this.vignette*.18})`);g.addColorStop(1,`rgba(0,0,0,${.72+this.vignette*.26})`);
    ctx.fillStyle=g;ctx.fillRect(0,0,this.width,this.height);
  }

  private drawFog(ctx:CanvasRenderingContext2D,t:number){
    if(this.fogStrength<=.01)return;
    ctx.save();ctx.globalCompositeOperation='screen';ctx.filter='blur(24px)';
    for(const w of this.fog){
      w.x += w.speed*(.35+this.fogStrength+w.depth*.4); if(w.x>1.25)w.x=-.25;
      const x=w.x*this.width, y=(w.y+Math.sin(t*.18*w.depth+w.phase)*.045)*this.height;
      const r=w.radius*Math.max(this.width,this.height); const grad=ctx.createRadialGradient(x,y,0,x,y,r);
      grad.addColorStop(0,`rgba(115,140,145,${w.alpha*this.fogStrength*(.8+this.mids)})`);
      grad.addColorStop(.48,`rgba(63,85,91,${w.alpha*.58*this.fogStrength})`);grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(x,y,r*1.7,r*.55,Math.sin(w.phase)*.25,0,TAU);ctx.fill();
    }
    ctx.restore();
  }

  private drawRoots(ctx:CanvasRenderingContext2D,t:number,phaseTime:number){
    if(this.rootsStrength<=.01)return;
    const visible=clamp(phaseTime/4.5)*this.rootsStrength;
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.lineCap='round';ctx.lineJoin='round';
    for(const root of this.roots){
      const count=Math.max(2,Math.floor(root.points.length*visible*root.growth));
      ctx.beginPath(); const p0=root.points[0];ctx.moveTo(p0.x*this.width,p0.y*this.height);
      for(let i=1;i<count;i++){const p=root.points[i],prev=root.points[i-1];const wobble=Math.sin(t*.25+i+root.alpha)*5;ctx.quadraticCurveTo((prev.x+p.x)*.5*this.width,(prev.y+p.y)*.5*this.height+wobble,p.x*this.width,p.y*this.height);}
      ctx.strokeStyle=`rgba(18,5,5,${root.alpha*visible})`;ctx.lineWidth=root.width*(1+this.bass*.5);ctx.shadowColor='rgba(90,0,0,.35)';ctx.shadowBlur=8;ctx.stroke();
    }
    ctx.restore();
  }

  private drawGirl(ctx:CanvasRenderingContext2D,t:number,phaseTime:number){
    if(!this.girlReady || this.girlOpacity<.005)return;
    const pulse=this.girlPulse*.55 + (this.phase==='song'?Math.max(0,this.mids-.35)*.8:0);
    const alpha=clamp(this.girlOpacity+pulse);
    const h=this.height*(this.phase==='apparition'?.96:.88);const w=h*(this.girl.width/this.girl.height);
    const slowShift=Math.sin(t*.19)*this.width*.006;
    const x=this.width*(this.phase==='apparition'?.55:.59)-w*.5+slowShift; const y=this.height-h;
    ctx.save();ctx.globalAlpha=alpha;ctx.globalCompositeOperation='multiply';ctx.filter=`contrast(${1.45+this.mids*.35}) brightness(${.55+this.highs*.22}) sepia(.18)`;
    ctx.drawImage(this.girl,x,y,w,h);
    ctx.globalCompositeOperation='screen';ctx.filter='blur(10px)';
    const eyeY=y+h*.505; const eyeX=x+w*.49; const glow=ctx.createRadialGradient(eyeX,eyeY,0,eyeX,eyeY,28+pulse*18);glow.addColorStop(0,`rgba(255,255,255,${.75*alpha})`);glow.addColorStop(.2,`rgba(180,210,220,${.32*alpha})`);glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(eyeX-50,eyeY-50,100,100);
    ctx.restore();
  }

  private drawEyeShape(ctx:CanvasRenderingContext2D,x:number,y:number,s:number,angle:number,kind:EyeKind,alpha:number,blink:number){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(1,Math.max(.05,blink));ctx.globalAlpha=alpha;
    const width=52*s,height=18*s;
    ctx.shadowBlur=22*s;ctx.shadowColor=kind==='wolf'?'rgba(205,45,25,.85)':kind==='demon'?'rgba(255,0,0,.9)':'rgba(220,235,240,.65)';
    ctx.beginPath();ctx.moveTo(-width/2,0);ctx.quadraticCurveTo(0,-height,width/2,0);ctx.quadraticCurveTo(0,height,-width/2,0);ctx.closePath();
    const sclera=ctx.createLinearGradient(0,-height,0,height);sclera.addColorStop(0,kind==='pale'?'#d7e0df':'#5b0708');sclera.addColorStop(.5,kind==='wolf'?'#ff432b':kind==='demon'?'#ca0000':'#edf6f4');sclera.addColorStop(1,'#150000');ctx.fillStyle=sclera;ctx.fill();
    const iris=ctx.createRadialGradient(0,0,0,0,0,height*.75);iris.addColorStop(0,kind==='pale'?'#ffffff':'#ffd6a0');iris.addColorStop(.25,kind==='wolf'?'#ff9c22':kind==='demon'?'#ff1300':'#b8d9dc');iris.addColorStop(1,'#130000');ctx.fillStyle=iris;ctx.beginPath();ctx.ellipse(0,0,height*.68,height*.82,0,0,TAU);ctx.fill();
    ctx.fillStyle='#020000';ctx.beginPath();ctx.ellipse(0,0,Math.max(1,2.1*s),height*.72,0,0,TAU);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.85)';ctx.beginPath();ctx.arc(-height*.18,-height*.25,Math.max(1,1.8*s),0,TAU);ctx.fill();ctx.restore();
  }

  private drawEyes(ctx:CanvasRenderingContext2D,t:number,phaseTime:number){
    const visible=this.phase==='blackout'?clamp((phaseTime-.9)/3.3):this.phase==='song'?clamp(.25+this.highs*.95):0;
    if(visible<=.001)return;
    for(let i=0;i<this.eyes.length;i++){
      const e=this.eyes[i]; const reveal=clamp((visible*1.25)-i/this.eyes.length*.55); if(reveal<=0)continue;
      const dx=(this.pointer.x-e.x)*8*e.scale,dy=(this.pointer.y-e.y)*4*e.scale;
      const blinkCycle=(t+e.phase)%e.blink;const blink=blinkCycle<.12?Math.max(.05,blinkCycle/.12):blinkCycle>.16&&blinkCycle<.24?Math.max(.05,(blinkCycle-.16)/.08):1;
      const drift=Math.sin(t*.23*e.drift+e.phase)*4;
      this.drawEyeShape(ctx,e.x*this.width+dx+drift,e.y*this.height+dy,e.scale,e.angle,e.kind,e.alpha*reveal*(.65+this.highs*.5),blink);
      if(e.kind!=='pale') this.drawEyeShape(ctx,e.x*this.width+dx+drift+65*e.scale,e.y*this.height+dy,e.scale,e.angle*-1,e.kind,e.alpha*reveal*(.65+this.highs*.5),blink);
    }
  }

  private drawAsh(ctx:CanvasRenderingContext2D,t:number){
    if(this.phase==='idle')return;
    ctx.save();ctx.globalCompositeOperation='screen';
    for(const a of this.ash){a.x+=a.vx*(1+this.highs*3);a.y+=a.vy*(1+this.mids*2);a.life+=.002;if(a.y<-.05||a.x<-.05||a.x>1.05){a.x=Math.random();a.y=1.05;a.life=0;}
      const flick=.55+Math.sin(t*4+a.life*12)*.45;ctx.fillStyle=`rgba(216,72,24,${a.alpha*flick*(.25+this.highs)})`;ctx.beginPath();ctx.arc(a.x*this.width,a.y*this.height,a.size*(1+this.highs),0,TAU);ctx.fill();}
    ctx.restore();
  }

  private drawFilm(ctx:CanvasRenderingContext2D,t:number){
    if(this.phase==='idle')return;
    ctx.save();ctx.globalAlpha=.08+this.highs*.06;ctx.globalCompositeOperation='overlay';
    for(let i=0;i<70;i++){const x=Math.random()*this.width,y=Math.random()*this.height,s=Math.random()*1.5;ctx.fillStyle=Math.random()>.5?'white':'black';ctx.fillRect(x,y,s,s);}
    ctx.globalAlpha=.05;ctx.fillStyle=`rgba(130,0,0,${.3+this.bass})`;ctx.fillRect(0,(Math.sin(t*1.7)*.5+.5)*this.height,this.width,1);ctx.restore();
  }
}
