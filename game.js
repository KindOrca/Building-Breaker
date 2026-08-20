(() => {
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const GROUND = 630;
const keys = new Set();
const pressed = new Set();

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const randi=(a,b)=>Math.floor(rand(a,b+1));
const easeOut=(t)=>1-Math.pow(1-t,3);

let state='menu';
let menuIndex=0;
let time=0;
let last=performance.now();
let freeze=0;
let slowMo=1;
let flash=0;
let shake=0;
let zoom=1;
let zoomKick=0;
let dangerPulse=0;
let tutorial=0;
let gameOverTimer=0;
let stage=1;
let highScore=Number(localStorage.getItem('buildingBreakerHighScore')||0);

const mouse={x:0,y:0,clicked:false};
canvas.addEventListener('pointermove',e=>{
  const r=canvas.getBoundingClientRect();
  mouse.x=(e.clientX-r.left)/r.width*W; mouse.y=(e.clientY-r.top)/r.height*H;
});
canvas.addEventListener('pointerdown',()=>{mouse.clicked=true; audio.unlock();});

addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyZ','KeyX','Enter','Escape'].includes(e.code)) e.preventDefault();
  if(!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code); audio.unlock();
});
addEventListener('keyup',e=>keys.delete(e.code));

const audio={
  ac:null, master:null,
  unlock(){
    if(!this.ac){
      try{this.ac=new (window.AudioContext||window.webkitAudioContext)(); this.master=this.ac.createGain(); this.master.gain.value=.25; this.master.connect(this.ac.destination);}catch(_){return;}
    }
    if(this.ac.state==='suspended') this.ac.resume();
  },
  tone(freq=120,dur=.08,type='square',vol=.12,slide=0){
    if(!this.ac)return; const now=this.ac.currentTime;
    const o=this.ac.createOscillator(), g=this.ac.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,now); if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide),now+dur);
    g.gain.setValueAtTime(vol,now); g.gain.exponentialRampToValueAtTime(.0001,now+dur);
    o.connect(g);g.connect(this.master);o.start(now);o.stop(now+dur);
  },
  noise(dur=.08,vol=.09){
    if(!this.ac)return; const n=Math.max(1,Math.floor(this.ac.sampleRate*dur)); const b=this.ac.createBuffer(1,n,this.ac.sampleRate); const d=b.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const s=this.ac.createBufferSource(),g=this.ac.createGain(),f=this.ac.createBiquadFilter(); s.buffer=b; f.type='lowpass'; f.frequency.value=1800; g.gain.value=vol; s.connect(f);f.connect(g);g.connect(this.master);s.start();
  },
  hit(power=1){this.tone(115-power*12,.07,'square',.11+power*.02,-45);this.tone(52,.11,'sine',.15+power*.025,-18);this.noise(.06+power*.018,.05+power*.02)},
  break(power=1){this.hit(power);this.noise(.18,.11);this.tone(72,.2,'sawtooth',.11,-35)},
  jump(){this.tone(210,.07,'square',.055,80)},
  guard(){this.tone(520,.05,'triangle',.07,-140)},
  perfect(){this.tone(780,.08,'square',.09,340);this.tone(390,.13,'triangle',.08,220)},
  ultimate(){this.tone(65,.45,'sawtooth',.16,120);setTimeout(()=>this.noise(.35,.16),100)}
};

class Particle{
  constructor(x,y,opt={}){Object.assign(this,{x,y,vx:rand(-120,120),vy:rand(-280,-60),g:720,life:1,max:1,size:8,rot:rand(0,6.28),vr:rand(-5,5),kind:'debris',alpha:1},opt);this.max=this.life}
  update(dt){this.life-=dt;this.vy+=this.g*dt;this.x+=this.vx*dt;this.y+=this.vy*dt;this.rot+=this.vr*dt;if(this.y>GROUND&&this.kind==='debris'){this.y=GROUND;this.vy*=-.28;this.vx*=.76}}
  draw(c){const a=clamp(this.life/this.max,0,1)*this.alpha;c.save();c.globalAlpha=a;c.translate(this.x,this.y);c.rotate(this.rot);
    if(this.kind==='spark'){c.fillStyle='#fff3a6';c.fillRect(-this.size*.45,-1,this.size,2)}
    else if(this.kind==='dust'){c.fillStyle='rgba(194,183,165,.8)';c.beginPath();c.arc(0,0,this.size*(1-a*.35),0,6.28);c.fill()}
    else{c.fillStyle=this.color||'#b8aa95';c.strokeStyle='#2a241f';c.lineWidth=2;c.fillRect(-this.size/2,-this.size/2,this.size,this.size*.72);c.strokeRect(-this.size/2,-this.size/2,this.size,this.size*.72)}c.restore()}
}
const particles=[];
function burst(x,y,count=12,power=1,color='#b8aa95'){
  for(let i=0;i<count;i++) particles.push(new Particle(x,y,{vx:rand(-230,230)*power,vy:rand(-350,-80)*power,size:rand(5,14),life:rand(.5,1.2),color}));
  for(let i=0;i<Math.min(10,count);i++) particles.push(new Particle(x,y,{kind:'spark',vx:rand(-420,420),vy:rand(-180,180),g:0,size:rand(14,34),life:rand(.12,.25)}));
  for(let i=0;i<Math.min(8,count);i++) particles.push(new Particle(x+rand(-30,30),y+rand(-15,15),{kind:'dust',vx:rand(-70,70),vy:rand(-100,-20),g:-8,size:rand(10,24),life:rand(.35,.8)}));
}

const popups=[];
function popup(text,x,y,opt={}){popups.push({text,x,y,life:opt.life||.7,max:opt.life||.7,size:opt.size||32,color:opt.color||'#fff',stroke:opt.stroke||'#101010',vy:opt.vy??-50,scale:opt.scale||1,kind:opt.kind||'normal'});}

const waves=[];
function wave(x,y,size=80,life=.22){waves.push({x,y,size,life,max:life});}

const impactRays=[];
function impactBurst(x,y,power=1){
  const count=Math.floor(10+power*6);
  for(let i=0;i<count;i++){
    const a=rand(0,Math.PI*2), inner=rand(10,24)*power, outer=rand(48,105)*power;
    impactRays.push({x,y,a,inner,outer,life:rand(.09,.18),max:0,width:rand(2,5)*power});
    impactRays[impactRays.length-1].max=impactRays[impactRays.length-1].life;
  }
}

const hazards=[];
function spawnHazard(){
  if(!building.floors.length||state!=='play')return;
  const x=rand(building.x+30,building.x+building.w-30), y=building.bottom()-5;
  hazards.push({x,y,vx:rand(-55,55),vy:rand(120,190),r:12,rot:0,vr:rand(-6,6),dead:false});
}

const player={
  x:310,y:GROUND-56,w:44,h:56,vx:0,vy:0,facing:1,onGround:true,guard:false,guardMeter:100,guardBroken:0,hearts:3,invuln:0,
  attackCd:0,attackAnim:0,attackStep:0,lastAttack:0,dash:0,hitGlow:0,perfectWindow:0,
  reset(){Object.assign(this,{x:310,y:GROUND-56,vx:0,vy:0,facing:1,onGround:true,guard:false,guardMeter:100,guardBroken:0,hearts:3,invuln:0,attackCd:0,attackAnim:0,attackStep:0,lastAttack:0,dash:0,hitGlow:0,perfectWindow:0})},
  rect(){return{x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}},
  update(dt){
    this.invuln=Math.max(0,this.invuln-dt);this.attackCd=Math.max(0,this.attackCd-dt);this.attackAnim=Math.max(0,this.attackAnim-dt);this.guardBroken=Math.max(0,this.guardBroken-dt);this.hitGlow=Math.max(0,this.hitGlow-dt);
    const left=keys.has('ArrowLeft'),right=keys.has('ArrowRight');
    this.guard=keys.has('ArrowDown')&&this.guardBroken<=0&&this.onGround;
    if(this.guard){this.vx*=Math.pow(.001,dt);this.guardMeter-=30*dt;if(this.guardMeter<=0){this.guardMeter=0;this.guard=false;this.guardBroken=1.4;popup('GUARD BREAK!',this.x,this.y-72,{color:'#ff6b5e',size:28});audio.break(.5)}}else this.guardMeter=clamp(this.guardMeter+18*dt,0,100);
    if(!this.guard){
      const accel=this.onGround?2100:1200,max=this.onGround?340:275;
      if(left){this.vx-=accel*dt;this.facing=-1} if(right){this.vx+=accel*dt;this.facing=1}
      if(!left&&!right)this.vx*=Math.pow(this.onGround?.0004:.09,dt);
      this.vx=clamp(this.vx,-max,max);
    }
    if(pressed.has('ArrowUp')&&this.onGround&&!this.guard){this.vy=-660;this.onGround=false;audio.jump();}
    if(pressed.has('KeyZ')&&!this.guard) this.attack();
    if(pressed.has('KeyX')) useUltimate();
    // Z 공격은 옆으로 돌진하지 않고 위쪽으로 파고드는 어퍼컷/상향 공격이다.
    if(this.dash>0){this.dash-=dt;this.vy=Math.min(this.vy,-300);this.vx*=Math.pow(.06,dt)}
    const prevX=this.x;
    this.vy+=1700*dt;this.x+=this.vx*dt;this.y+=this.vy*dt;
    this.x=clamp(this.x,42,W-42);
    if(this.y+this.h/2>=GROUND){this.y=GROUND-this.h/2;this.vy=0;this.onGround=true}else this.onGround=false;
    // 건물은 실제 벽처럼 충돌한다. 접촉 자체로는 HP가 줄지 않는다.
    building.resolvePlayerCollision(this,prevX);
  },
  attack(){
    if(this.attackCd>0)return;
    const now=time;if(now-this.lastAttack<.48)this.attackStep=(this.attackStep+1)%3;else this.attackStep=0;this.lastAttack=now;
    this.attackCd=this.onGround?.15:.19;this.attackAnim=.14;
    if(!this.onGround)this.dash=.07;
    audio.tone(this.onGround?180:220,.05,'square',.045,95);
    // 공격 판정의 중심을 캐릭터 바로 위로 옮겨, Z가 항상 상향 공격이 되도록 한다.
    const reach=this.onGround?100:118;
    const ax=this.x, ay=this.y-this.h/2-reach*.48;
    const hit=building.tryHit(ax,ay,reach,125,!this.onGround,this.attackStep);
    if(!hit){wave(ax,ay,34,.13);impactBurst(ax,ay,.35);}
  },
  damage(unblockable=false){
    if(this.invuln>0)return;
    if(!unblockable&&this.guard&&this.guardMeter>0){
      const perfect=pressed.has('ArrowDown') || this.perfectWindow>.0;
      this.guardMeter=clamp(this.guardMeter-11,0,100);audio.guard();shake=Math.max(shake,4);wave(this.x,this.y,55,.16);
      if(perfect){stats.perfectGuards++;gauge=clamp(gauge+8,0,100);popup('PERFECT GUARD!',this.x,this.y-82,{color:'#70e8ff',size:32});audio.perfect();freeze=Math.max(freeze,.055);this.perfectWindow=.0;return}
      popup('BLOCK',this.x,this.y-60,{color:'#b7efff',size:24});return;
    }
    this.hearts--;this.invuln=1.05;this.vy=-320;this.vx=-this.facing*230;shake=Math.max(shake,12);flash=Math.max(flash,.32);audio.break(1);popup('-1 HP',this.x,this.y-72,{color:'#ff675c',size:30});
    if(this.hearts<=0) endGame();
  },
  draw(c){
    c.save();c.translate(this.x,this.y);if(this.invuln>0&&Math.floor(time*18)%2===0)c.globalAlpha=.38;
    if(this.guard){
      // 가드는 공격과 같은 방향인 '위쪽'으로 펼쳐지는 돔형 실드다.
      c.save();
      const pulse=.86+.10*Math.sin(time*12);
      c.globalCompositeOperation='screen';
      c.strokeStyle=`rgba(122,235,255,${.82*pulse})`;c.lineWidth=7;c.lineCap='round';
      c.shadowColor='#70e8ff';c.shadowBlur=18;
      c.beginPath();c.arc(0,-61,48,Math.PI,Math.PI*2);c.stroke();
      c.strokeStyle='rgba(255,255,255,.72)';c.lineWidth=2;
      c.beginPath();c.arc(0,-61,39,Math.PI+.12,Math.PI*2-.12);c.stroke();
      c.globalAlpha=.18;c.fillStyle='#79eaff';c.beginPath();c.arc(0,-61,47,Math.PI,Math.PI*2);c.closePath();c.fill();
      c.restore();
    }
    if(this.attackAnim>0){
      c.save();
      const k=clamp(this.attackAnim/.14,0,1);
      const grad=c.createLinearGradient(0,-92,0,-10);grad.addColorStop(0,'rgba(255,255,255,0)');grad.addColorStop(.42,this.hitGlow>0?'#fff9b8':'#ffe25a');grad.addColorStop(1,'rgba(255,185,55,.15)');
      c.strokeStyle=grad;c.lineWidth=14;c.lineCap='round';c.beginPath();c.moveTo(-8,-18);c.quadraticCurveTo(0,-60,6,-91);c.stroke();
      c.strokeStyle='rgba(255,255,255,.78)';c.lineWidth=4;c.beginPath();c.moveTo(12,-25);c.lineTo(22,-72);c.stroke();
      c.globalAlpha=.55*k;c.fillStyle='#fff3a4';c.beginPath();c.arc(2,-70,18*(1-k*.25),0,6.28);c.fill();
      c.restore();
    }
    c.scale(this.facing,1);
    c.fillStyle='#171b2d';c.strokeStyle='#06070b';c.lineWidth=4;c.beginPath();c.roundRect(-20,-18,40,48,10);c.fill();c.stroke();
    c.fillStyle='#ffcc8f';c.beginPath();c.arc(0,-27,17,0,6.28);c.fill();c.stroke();
    c.fillStyle='#ef3340';c.fillRect(-19,-45,38,11);c.fillStyle='#ffdf4d';c.fillRect(6,-43,10,6);
    c.fillStyle='#58c8ff';c.fillRect(-17,-11,34,8);
    c.strokeStyle='#0a0c12';c.lineWidth=8;c.beginPath();c.moveTo(-10,28);c.lineTo(-13,43);c.moveTo(10,28);c.lineTo(16,43);c.stroke();
    c.strokeStyle='#f2b76d';c.lineWidth=8;c.beginPath();c.moveTo(18,-7);c.lineTo(31,-2);c.stroke();
    c.restore();
  }
};

const building={
  x:410,w:460,floorH:34,baseY:82,descent:0,descentSpeed:9.5,floors:[],buildingId:0,style:0,weakFloor:0,weakX:0,weakPulse:0,collapseKick:0,
  waitingNext:false,nextBuildingTimer:0,guardBounceCd:0,liftVy:0,groundImpactCd:0,crushCd:0,
  reset(){this.buildingId=1;this.style=0;this.waitingNext=false;this.nextBuildingTimer=0;this.guardBounceCd=0;this.liftVy=0;this.groundImpactCd=0;this.crushCd=0;this.spawn()},
  spawn(){
    this.waitingNext=false;this.nextBuildingTimer=0;this.guardBounceCd=0;this.liftVy=0;this.groundImpactCd=.18;this.crushCd=.20;
    this.floors=[];this.descent=stage===1?0:-25;this.descentSpeed=9.2+stage*1.15;this.style=(this.buildingId-1)%4;
    const count=clamp(12+Math.floor(stage*.7),12,18);const baseHp=70+stage*11;
    for(let i=0;i<count;i++) this.floors.push({hp:baseHp*(1+i*.015),max:baseHp*(1+i*.015),crack:0});
    this.pickWeak();popup(`BUILDING ${this.buildingId}`,W/2,112,{size:34,color:'#ffd45a',life:1.25});
  },
  queueNext(delay=.52){
    if(this.waitingNext)return;
    this.waitingNext=true;this.nextBuildingTimer=delay;this.liftVy=0;
    popup(`NEXT BUILDING ${this.buildingId}`,W/2,128,{size:34,color:'#7fe8ff',life:delay+.35});
  },
  updateTransition(dt){
    if(!this.waitingNext)return;
    this.nextBuildingTimer=Math.max(0,this.nextBuildingTimer-dt);
    if(this.nextBuildingTimer<=0&&state==='play')this.spawn();
  },
  pickWeak(){if(!this.floors.length)return;this.weakFloor=Math.max(0,this.floors.length-1-randi(0,Math.min(2,this.floors.length-1)));this.weakX=rand(this.x+75,this.x+this.w-75);this.weakPulse=rand(0,6.28)},
  top(){return this.baseY+this.descent},
  bottom(){return this.top()+this.floors.length*this.floorH},
  floorRect(i){return{x:this.x,y:this.top()+i*this.floorH,w:this.w,h:this.floorH}},
  shieldTouchesBuilding(p){
    if(!this.floors.length||!p.guard||!p.onGround)return false;
    const btm=this.bottom()+this.collapseKick;
    const shieldTop=p.y-p.h/2-66,shieldBottom=p.y-p.h/2+10,half=54;
    const horizontal=p.x+half>this.x&&p.x-half<this.x+this.w;
    return horizontal&&btm>=shieldTop&&btm<=shieldBottom+10;
  },
  applyGuardLift(p){
    // 실드 판정은 유지하되, 연출/물리 반동은 쿨다운마다 한 번만 준다.
    if(this.guardBounceCd>0)return;
    this.guardBounceCd=.20;
    this.liftVy=Math.min(this.liftVy,-88);
    this.descent-=4.5;
    p.guardMeter=clamp(p.guardMeter-7,0,100);
    const sy=p.y-p.h/2-62;
    wave(p.x,sy,94,.24);impactBurst(p.x,sy,.75);burst(p.x,sy,5,.55,'#8fefff');
    freeze=Math.max(freeze,.038);shake=Math.max(shake,5);zoomKick=Math.max(zoomKick,.018);flash=Math.max(flash,.07);audio.guard();
    popup('GUARD LIFT!',p.x,sy-28,{size:24,color:'#8ff1ff',life:.42});
    if(p.guardMeter<=0){p.guard=false;p.guardBroken=1.4;popup('GUARD BREAK!',p.x,p.y-92,{color:'#ff6b5e',size:28});audio.break(.6)}
  },
  groundedCrushContact(p,bottom){
    // 캐릭터의 발은 지면에 있고, 건물 하단이 머리 위로 내려와 실제로 맞닿을 때만 '끼임 피해' 판정.
    if(!this.floors.length||!p.onGround)return false;
    const pr=p.rect(),left=this.x,right=this.x+this.w;
    const horizontal=pr.x+pr.w>left+4&&pr.x<right-4;
    const hitsHead=bottom>=pr.y-4&&bottom<=pr.y+18;
    return horizontal&&hitsHead;
  },
  applyCrushDamage(p){
    if(this.crushCd>0||p.invuln>0)return;
    this.crushCd=.82;
    this.descent-=23;this.liftVy=Math.min(this.liftVy,-48);
    shake=Math.max(shake,18);flash=Math.max(flash,.30);zoomKick=Math.max(zoomKick,.06);freeze=Math.max(freeze,.07);
    wave(p.x,p.y-p.h/2,148,.31);impactBurst(p.x,p.y-p.h/2,1.4);audio.break(2);
    popup('CRUSH!',p.x,p.y-102,{size:38,color:'#ff5b52',life:.62});
    p.damage(true);
  },
  resolvePlayerCollision(p,prevX){
    if(!this.floors.length)return;
    // 위쪽 실드가 건물 하단을 받치고 있으면 몸 충돌보다 실드 판정을 우선한다.
    if(this.shieldTouchesBuilding(p)){this.applyGuardLift(p);return;}
    const pr=p.rect(), top=this.top()+this.collapseKick, bottom=this.bottom()+this.collapseKick;
    // 건물이 머리 위로 내려오고 캐릭터가 땅에 서 있으면, '건물 + 캐릭터 + 지면' 끼임으로 HP가 감소한다.
    if(this.groundedCrushContact(p,bottom))this.applyCrushDamage(p);
    // 세로로 실제 건물과 겹칠 때만 좌우 벽 충돌을 적용한다. 건물 아래 공간에서는 자유롭게 이동 가능하다.
    if(pr.y+pr.h<=top+2 || pr.y>=bottom-2)return;
    const left=this.x,right=this.x+this.w;
    if(pr.x+pr.w<=left || pr.x>=right)return;
    const prevLeft=prevX-p.w/2,prevRight=prevX+p.w/2;
    if(prevRight<=left+3){p.x=left-p.w/2-1;if(p.vx>0)p.vx=0;}
    else if(prevLeft>=right-3){p.x=right+p.w/2+1;if(p.vx<0)p.vx=0;}
    else{
      // 접촉만으로 피해를 주지 않는다. 건물과 지면이 동시에 캐릭터를 누를 때만 update()에서 피해를 준다.
      const toLeft=Math.abs((pr.x+pr.w)-left),toRight=Math.abs(right-pr.x);
      if(toLeft<=toRight){p.x=left-p.w/2-1;if(p.vx>0)p.vx=0;}
      else{p.x=right+p.w/2+1;if(p.vx<0)p.vx=0;}
    }
    p.x=clamp(p.x,42,W-42);
  },
  update(dt){
    this.guardBounceCd=Math.max(0,this.guardBounceCd-dt);this.groundImpactCd=Math.max(0,this.groundImpactCd-dt);this.crushCd=Math.max(0,this.crushCd-dt);
    this.descent+=this.descentSpeed*dt;
    if(this.liftVy<0){this.descent+=this.liftVy*dt;this.liftVy=Math.min(0,this.liftVy+360*dt);}
    this.weakPulse+=dt*4.5;this.collapseKick=Math.max(0,this.collapseKick-dt*60);
    // 건물 하단이 위쪽 실드에 닿으면 살짝 떠오른다.
    if(this.shieldTouchesBuilding(player))this.applyGuardLift(player);
    if(Math.random()<dt*(.22+stage*.025))spawnHazard();
    const btm=this.bottom()+this.collapseKick;
    if(btm>GROUND-38)dangerPulse+=dt*8;
    if(btm>=GROUND-1&&this.groundImpactCd<=0){
      // 건물 자체가 지면에 닿는 충격은 연출만 발생한다. 캐릭터 피해는 위의 '지면에 선 상태에서 머리가 건물에 눌리는 순간'에만 발생한다.
      this.groundImpactCd=.52;
      this.descent-=42;this.liftVy=Math.min(this.liftVy,-36);
      shake=Math.max(shake,12);flash=Math.max(flash,.16);zoomKick=Math.max(zoomKick,.032);
      wave(W/2,GROUND-8,110,.30);audio.break(1.25);
      popup('GROUND IMPACT!',W/2,122,{size:30,color:'#ff9b5b',life:.62});
    }
  },
  tryHit(ax,ay,range,h,isAir,step){
    if(!this.floors.length)return false;
    let target=-1,distBest=1e9;
    for(let i=Math.max(0,this.floors.length-5);i<this.floors.length;i++){
      const r=this.floorRect(i); const cx=clamp(ax,r.x,r.x+r.w),cy=clamp(ay,r.y,r.y+r.h); const dx=ax-cx,dy=ay-cy; const d=dx*dx+dy*dy;
      if(d<range*range&&Math.abs(ay-(r.y+r.h/2))<h&&d<distBest){distBest=d;target=i}
    }
    if(target<0)return false;
    const r=this.floorRect(target);const wx=this.weakX,wy=r.y+r.h/2;
    const critical=(target===this.weakFloor&&Math.abs(ax-wx)<82);
    const ideal=Math.abs(Math.sin(this.weakPulse))<.24;
    const perfect=isAir&&critical&&ideal;
    let dmg=34+step*8+(isAir?15:0); if(critical)dmg*=1.65;if(perfect)dmg*=2;
    this.damageFloor(target,dmg,{x:clamp(ax,r.x+10,r.x+r.w-10),y:clamp(ay,r.y+5,r.y+r.h-5),critical,perfect,isAir});
    return true;
  },
  damageFloor(i,dmg,meta){
    const f=this.floors[i]; if(!f)return; f.hp-=dmg;f.crack=1-f.hp/f.max;
    let comboAdd=1; combo++;comboTimer=2.8;gauge=clamp(gauge+2.2+(meta.perfect?7:0),0,100);score+=Math.floor(dmg*(1+comboMultiplier()));
    stats.maxCombo=Math.max(stats.maxCombo,combo);
    player.hitGlow=.10;freeze=Math.max(freeze,meta.perfect?.13:.052);shake=Math.max(shake,meta.perfect?18:5.5);zoomKick=Math.max(zoomKick,meta.perfect?.085:.03);flash=Math.max(flash,meta.perfect?.27:.09);
    wave(meta.x,meta.y,meta.perfect?145:78,meta.perfect?.34:.22);wave(meta.x,meta.y,meta.perfect?92:48,meta.perfect?.22:.15);impactBurst(meta.x,meta.y,meta.perfect?1.55:.85);burst(meta.x,meta.y,meta.perfect?24:11,meta.perfect?1.45:.95,this.style===0?'#ba9f7b':'#aab3bb');audio.hit(meta.perfect?2.5:1.35);
    if(meta.isAir){player.vy=Math.min(player.vy,-105);player.vx*=.35;}
    popup(`${Math.floor(dmg)}`,meta.x+rand(-12,12),meta.y-10,{size:meta.perfect?35:24,color:meta.perfect?'#fff062':'#ffffff'});
    if(meta.critical){popup('CRITICAL!',meta.x,meta.y-40,{size:27,color:'#ffb62f'});}
    if(meta.perfect){stats.perfectSmashes++;popup('PERFECT SMASH!',W/2,238,{size:46,color:'#fff06a',life:.85});audio.perfect();combo+=3;comboTimer=2.8;}
    if(f.hp<=0) this.destroyFloor(i,meta);
    checkComboCallout();
  },
  destroyFloor(i,meta){
    const r=this.floorRect(i);const wasBottom=i===this.floors.length-1;
    this.floors.splice(i,1);stats.destroyedFloors++;combo+=2;comboTimer=2.8;gauge=clamp(gauge+6,0,100);score+=Math.floor(480*(1+comboMultiplier()));
    freeze=Math.max(freeze,.115);shake=Math.max(shake,14);zoomKick=Math.max(zoomKick,.065);flash=Math.max(flash,.23);audio.break(1.8);impactBurst(r.x+r.w/2,r.y+r.h/2,1.6);wave(r.x+r.w/2,r.y+r.h/2,150,.32);burst(r.x+r.w/2,r.y+r.h/2,24,1.25,this.style===0?'#c7a57a':'#adb4bb');
    popup('1 BREAK!',r.x+r.w*.66,r.y+r.h/2,{size:37,color:'#ffda4f',life:.85});
    if(wasBottom||i>=this.floors.length-2)this.descent+=this.floorH*.72;
    this.collapseKick=10;this.pickWeak();
    if(!this.floors.length){score+=2500*stage;gauge=clamp(gauge+15,0,100);this.buildingId++;stage++;freeze=Math.max(freeze,.14);shake=20;flash=.5;popup('TOTAL BREAK!',W/2,280,{size:58,color:'#fff37a',life:1.2});this.queueNext(.52)}
  },
  ultimateBreak(count){
    if(!this.floors.length)return; count=Math.min(count,this.floors.length);let destroyed=0;
    for(let n=0;n<count;n++){
      const idx=this.floors.length-1; if(idx<0)break;const r=this.floorRect(idx);this.floors.pop();destroyed++;stats.destroyedFloors++;combo+=1;score+=900*(1+stage*.08);
      burst(r.x+rand(60,r.w-60),r.y+r.h/2,8,1.25,this.style===0?'#c7a57a':'#adb4bb');
    }
    combo+=destroyed;comboTimer=3.1;stats.maxCombo=Math.max(stats.maxCombo,combo);this.descent+=this.floorH*destroyed*.55;
    popup(`${destroyed} BREAK!`,W/2,300,{size:66,color:'#fff06a',life:1.25});popup('ULTIMATE BREAK!',W/2,214,{size:40,color:'#ff5f58',life:1.2});
    shake=31;flash=.9;zoomKick=.13;freeze=.18;audio.break(2.8);impactBurst(W/2,this.bottom()-30,2.4);wave(W/2,this.bottom()-30,260,.45);this.pickWeak();
    if(!this.floors.length){this.buildingId++;stage++;this.queueNext(.58)}
  },
  draw(c){
    if(!this.floors.length)return; const top=this.top()+this.collapseKick;
    c.save();
    c.fillStyle='rgba(0,0,0,.26)';c.fillRect(this.x+12,top+10,this.w,this.floors.length*this.floorH+18);
    for(let i=0;i<this.floors.length;i++){
      const f=this.floors[i],y=top+i*this.floorH;
      const grad=c.createLinearGradient(this.x,y,this.x+this.w,y);
      if(this.style===0){grad.addColorStop(0,'#6e4f3a');grad.addColorStop(.5,'#9a6b48');grad.addColorStop(1,'#5d4133')}
      else if(this.style===1){grad.addColorStop(0,'#727a83');grad.addColorStop(.5,'#a6adb2');grad.addColorStop(1,'#5a626b')}
      else if(this.style===2){grad.addColorStop(0,'#65596c');grad.addColorStop(.5,'#8a7d90');grad.addColorStop(1,'#4d4653')}
      else{grad.addColorStop(0,'#75601f');grad.addColorStop(.5,'#b29332');grad.addColorStop(1,'#604d18')}
      c.fillStyle=grad;c.strokeStyle='#221d1a';c.lineWidth=3;c.fillRect(this.x,y,this.w,this.floorH);c.strokeRect(this.x,y,this.w,this.floorH);
      for(let wx=this.x+28;wx<this.x+this.w-20;wx+=52){c.fillStyle=f.crack>.45?'#20252b':'#79b4c7';c.fillRect(wx,y+8,26,13);c.fillStyle='rgba(255,255,255,.25)';c.fillRect(wx+3,y+9,5,3)}
      if(f.crack>.15){c.strokeStyle='#2c2522';c.lineWidth=2;const k=Math.floor(f.crack*5);for(let j=0;j<k;j++){const sx=this.x+60+((i*73+j*91)%340);c.beginPath();c.moveTo(sx,y+3);c.lineTo(sx+rand(-14,12),y+14);c.lineTo(sx+rand(-8,18),y+29);c.stroke()}}
      if(f.crack>.65){c.fillStyle='rgba(32,24,20,.35)';c.fillRect(this.x,y,this.w,this.floorH)}
    }
    c.fillStyle='#2b2520';c.fillRect(this.x-12,top-18,this.w+24,22);c.fillStyle='#d9483f';c.fillRect(this.x+this.w*.35,top-16,this.w*.3,8);
    if(this.weakFloor<this.floors.length){const r=this.floorRect(this.weakFloor),wy=r.y+r.h/2+this.collapseKick;const pulse=(Math.sin(this.weakPulse)+1)/2;
      c.save();c.globalAlpha=.55+.35*pulse;c.strokeStyle=pulse<.08?'#ffffff':'#ffcc3e';c.lineWidth=4;c.beginPath();c.arc(this.weakX,wy,13+5*pulse,0,6.28);c.stroke();c.fillStyle='rgba(255,218,71,.16)';c.beginPath();c.arc(this.weakX,wy,27+8*pulse,0,6.28);c.fill();c.restore();
    }
    c.restore();
  }
};

let score=0,combo=0,comboTimer=0,gauge=0;
const stats={maxCombo:0,destroyedFloors:0,perfectSmashes:0,perfectGuards:0};
function comboMultiplier(){if(combo>=100)return 5;if(combo>=50)return 3;if(combo>=30)return 2;if(combo>=20)return 1.5;if(combo>=10)return 1.2;return 1}
function checkComboCallout(){const map={10:'GOOD!',20:'GREAT!',30:'CRAZY!',50:'MONSTER!',100:'LEGEND!'};if(map[combo])popup(map[combo],W/2,170,{size:44,color:'#fff06d',life:.75})}

function resetGame(){
  score=0;combo=0;comboTimer=0;gauge=0;stage=1;tutorial=8;gameOverTimer=0;Object.assign(stats,{maxCombo:0,destroyedFloors:0,perfectSmashes:0,perfectGuards:0});
  particles.length=0;popups.length=0;waves.length=0;impactRays.length=0;hazards.length=0;player.reset();building.reset();state='play';flash=.18;shake=4;
}
function endGame(){if(state!=='play')return;state='gameover';gameOverTimer=0;slowMo=.35;highScore=Math.max(highScore,Math.floor(score));localStorage.setItem('buildingBreakerHighScore',String(highScore));audio.break(2);}
function useUltimate(){
  if(state!=='play')return;if(gauge<100){popup('NOT READY',W/2,H-106,{size:26,color:'#ff786a',life:.5});shake=Math.max(shake,2.5);return}
  gauge=0;state='ultimate';ultimatePhase=0;ultimateTimer=0;audio.ultimate();
}
let ultimateTimer=0,ultimatePhase=0;
function updateUltimate(dt){
  ultimateTimer+=dt;
  if(ultimatePhase===0){slowMo=.3;zoomKick=.1;flash=.08;if(ultimateTimer>.35){ultimatePhase=1;ultimateTimer=0;popup('LIMIT BREAK',W/2,150,{size:34,color:'#ffda5a',life:.8})}}
  else if(ultimatePhase===1){player.x=lerp(player.x,W/2-130,clamp(dt*7,0,1));if(ultimateTimer>.28){ultimatePhase=2;ultimateTimer=0;freeze=.08;shake=7;flash=.4;wave(W/2,building.bottom()-50,180,.35)}}
  else if(ultimatePhase===2){if(ultimateTimer>.12){const count=combo>=60?15:combo>=40?10:combo>=20?7:5;building.ultimateBreak(count);ultimatePhase=3;ultimateTimer=0}}
  else if(ultimatePhase===3&&ultimateTimer>.48){state='play';slowMo=1;}
}

function update(dt){
  if(freeze>0){freeze-=dt;dt=0}
  time+=dt;flash=Math.max(0,flash-dt*2.5);shake=Math.max(0,shake-dt*28);zoomKick=Math.max(0,zoomKick-dt*.7);zoom=1+zoomKick;
  if(state==='menu'){
    if(pressed.has('ArrowUp')||pressed.has('ArrowDown')){menuIndex=1-menuIndex;audio.tone(280,.035,'square',.035,60)}
    if(pressed.has('Enter')||pressed.has('KeyZ')){if(menuIndex===0)resetGame();else state='howto'}
  }
  else if(state==='howto'){if(pressed.has('Escape')||pressed.has('Enter')||pressed.has('KeyZ'))state='menu';}
  else if(state==='play'){
    building.updateTransition(dt);
    tutorial=Math.max(0,tutorial-dt);player.perfectWindow=Math.max(0,player.perfectWindow-dt);player.update(dt);if(!building.waitingNext)building.update(dt);
    if(combo>0){comboTimer-=dt;if(comboTimer<=0){combo=0;comboTimer=0}}
    for(const h of hazards){h.vy+=700*dt;h.x+=h.vx*dt;h.y+=h.vy*dt;h.rot+=h.vr*dt;const pr=player.rect();if(!h.dead&&h.x>pr.x-10&&h.x<pr.x+pr.w+10&&h.y>pr.y-8&&h.y<pr.y+pr.h+10){h.dead=true;player.damage();burst(h.x,h.y,5,.65,'#9e8c79')}if(h.y>H+30)h.dead=true}
  } else if(state==='ultimate'){building.updateTransition(dt);player.update(dt*.35);updateUltimate(dt)}
  else if(state==='gameover'){gameOverTimer+=dt;slowMo=lerp(slowMo,1,dt*2);if((pressed.has('Enter')||pressed.has('KeyZ'))&&gameOverTimer>.6)resetGame();}
  for(let i=particles.length-1;i>=0;i--){particles[i].update(dt);if(particles[i].life<=0)particles.splice(i,1)}
  for(let i=popups.length-1;i>=0;i--){const p=popups[i];p.life-=dt;p.y+=p.vy*dt;if(p.life<=0)popups.splice(i,1)}
  for(let i=waves.length-1;i>=0;i--){waves[i].life-=dt;if(waves[i].life<=0)waves.splice(i,1)}
  for(let i=impactRays.length-1;i>=0;i--){impactRays[i].life-=dt;if(impactRays[i].life<=0)impactRays.splice(i,1)}
  for(let i=hazards.length-1;i>=0;i--)if(hazards[i].dead)hazards.splice(i,1);
  pressed.clear();mouse.clicked=false;
}

function text(t,x,y,size=32,color='#fff',align='center',stroke=true){ctx.save();ctx.font=`900 ${size}px Impact, Arial Black, sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';if(stroke){ctx.lineWidth=Math.max(3,size*.1);ctx.strokeStyle='#0a0b0e';ctx.strokeText(t,x,y)}ctx.fillStyle=color;ctx.fillText(t,x,y);ctx.restore()}
function drawBackground(c){
  const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#1d2b49');g.addColorStop(.5,'#263144');g.addColorStop(1,'#101218');c.fillStyle=g;c.fillRect(0,0,W,H);
  c.fillStyle='rgba(255,208,95,.08)';c.beginPath();c.arc(170,130,95,0,6.28);c.fill();
  for(let i=0;i<15;i++){const bx=i*94-40, bh=70+(i%4)*28;c.fillStyle=i%2?'#151b27':'#1a2130';c.fillRect(bx,GROUND-bh,80,bh);for(let y=GROUND-bh+15;y<GROUND-10;y+=22){c.fillStyle='rgba(252,215,120,.13)';c.fillRect(bx+14,y,9,8);c.fillRect(bx+42,y,9,8)}}
  c.fillStyle='#27282b';c.fillRect(0,GROUND,W,H-GROUND);c.fillStyle='#4c4c4e';c.fillRect(0,GROUND,W,6);
  for(let x=0;x<W;x+=120){c.fillStyle='#202124';c.fillRect(x,GROUND+40,64,5)}
}
function drawWorld(c){
  drawBackground(c);
  c.save();c.setLineDash([16,10]);c.strokeStyle=building.bottom()>GROUND-80?'#ff6659':'rgba(255,91,72,.28)';c.lineWidth=3;c.beginPath();c.moveTo(0,GROUND-64);c.lineTo(W,GROUND-64);c.stroke();c.restore();
  building.draw(c);
  for(const h of hazards){c.save();c.translate(h.x,h.y);c.rotate(h.rot);c.fillStyle='#8f8172';c.strokeStyle='#2a2521';c.lineWidth=3;c.fillRect(-h.r,-h.r,h.r*2,h.r*1.5);c.strokeRect(-h.r,-h.r,h.r*2,h.r*1.5);c.restore()}
  for(const p of particles)p.draw(c);
  player.draw(c);
  for(const w of waves){const k=1-w.life/w.max;c.save();c.globalAlpha=1-k;c.strokeStyle='#fff3b4';c.lineWidth=6*(1-k)+1;c.beginPath();c.arc(w.x,w.y,w.size*easeOut(k),0,6.28);c.stroke();c.restore()}
  for(const r of impactRays){const k=1-r.life/r.max,a=clamp(r.life/r.max,0,1);c.save();c.globalAlpha=a;c.strokeStyle='#fff6c8';c.lineWidth=r.width*(1-k*.7);c.lineCap='round';c.beginPath();c.moveTo(r.x+Math.cos(r.a)*r.inner,r.y+Math.sin(r.a)*r.inner);c.lineTo(r.x+Math.cos(r.a)*(r.inner+(r.outer-r.inner)*easeOut(k)),r.y+Math.sin(r.a)*(r.inner+(r.outer-r.inner)*easeOut(k)));c.stroke();c.restore()}
}
function drawUI(c){
  c.save();
  // top center combo
  if(combo>0){text(`${combo} COMBO`,W/2,50,combo>=50?48:40,combo>=50?'#fff06a':'#ffffff');const tw=250;c.fillStyle='rgba(0,0,0,.45)';c.fillRect(W/2-tw/2,78,tw,8);c.fillStyle=comboTimer<.8?'#ff6258':'#ffd44a';c.fillRect(W/2-tw/2,78,tw*clamp(comboTimer/2.8,0,1),8)}
  // hearts and guard
  c.fillStyle='rgba(7,9,14,.76)';c.beginPath();c.roundRect(22,H-112,294,88,18);c.fill();
  text('HP',44,H-84,18,'#9da6b5','left',false);for(let i=0;i<3;i++)drawHeart(c,94+i*45,H-83,i<player.hearts);
  text('UP GUARD',44,H-50,17,'#9da6b5','left',false);c.fillStyle='#222936';c.fillRect(128,H-58,164,16);c.fillStyle=player.guardBroken>0?'#ef554d':'#5ed7ed';c.fillRect(128,H-58,164*(player.guardMeter/100),16);
  // score
  c.fillStyle='rgba(7,9,14,.72)';c.beginPath();c.roundRect(W-282,H-95,260,70,18);c.fill();text('SCORE',W-252,H-72,18,'#9da6b5','left',false);text(String(Math.floor(score)).padStart(8,'0'),W-36,H-48,30,'#fff29b','right');
  // special
  const gw=430,gx=W/2-gw/2,gy=H-45;c.fillStyle='rgba(7,9,14,.83)';c.beginPath();c.roundRect(gx-14,gy-20,gw+28,42,18);c.fill();
  c.fillStyle='#242735';c.fillRect(gx,gy-7,gw,14);const gg=c.createLinearGradient(gx,0,gx+gw,0);gg.addColorStop(0,'#f05943');gg.addColorStop(.5,'#ffc33e');gg.addColorStop(1,'#fff56b');c.fillStyle=gg;c.fillRect(gx,gy-7,gw*(gauge/100),14);text(gauge>=100?'SPECIAL READY! [X]':`SPECIAL ${Math.floor(gauge)}%`,W/2,gy-23,18,gauge>=100?'#fff46d':'#e7e9ed');
  if(gauge>=100){c.strokeStyle=`rgba(255,241,91,${.45+.4*Math.sin(time*10)})`;c.lineWidth=3;c.strokeRect(gx-2,gy-9,gw+4,18)}
  text(building.waitingNext?`NEXT BUILDING ${building.buildingId}  •  STAGE ${stage}`:`BUILDING ${building.buildingId}  •  STAGE ${stage}`,W-28,30,19,building.waitingNext?'#7fe8ff':'#d5d8df','right');
  if(building.waitingNext){
    const k=building.nextBuildingTimer/.58;
    c.fillStyle='rgba(7,9,14,.78)';c.beginPath();c.roundRect(W/2-190,102,380,58,16);c.fill();
    text(`NEXT BUILDING ${building.buildingId}`,W/2,124,26,'#8fefff');
    c.fillStyle='#23313a';c.fillRect(W/2-145,146,290,6);c.fillStyle='#7fe8ff';c.fillRect(W/2-145,146,290*(1-clamp(k,0,1)),6);
  }
  if(tutorial>0&&state==='play'){const a=clamp(tutorial>1?1:tutorial,0,1);c.save();c.globalAlpha=a;c.fillStyle='rgba(0,0,0,.6)';c.beginPath();c.roundRect(W/2-350,112,700,72,18);c.fill();text('← → MOVE    ↑ JUMP    ↓ UP GUARD    Z UP ATTACK    X SPECIAL',W/2,142,23,'#ffffff');text('↓ CAN LIFT THE BUILDING • JUMP + Z BREAKS THE GLOWING WEAK POINT!',W/2,174,17,'#ffd95a');c.restore()}
  if(building.bottom()>GROUND-110)text('DANGER!',W/2,112,36,'#ff6259');
  c.restore();
}
function drawHeart(c,x,y,on){c.save();c.translate(x,y);c.fillStyle=on?'#f04d55':'#3b3d45';c.beginPath();c.moveTo(0,13);c.bezierCurveTo(-30,-5,-20,-25,0,-12);c.bezierCurveTo(20,-25,30,-5,0,13);c.fill();c.restore()}
function drawPopups(){for(const p of popups){const k=1-p.life/p.max;const a=clamp(p.life/p.max,0,1);const sc=p.scale*(k<.2?lerp(.2,1.18,k/.2):lerp(1.18,1,Math.min(1,(k-.2)/.25)));ctx.save();ctx.globalAlpha=a;ctx.translate(p.x,p.y);ctx.scale(sc,sc);text(p.text,0,0,p.size,p.color,'center',true);ctx.restore()}}

function drawMenu(){
  drawBackground(ctx);ctx.fillStyle='rgba(4,5,9,.58)';ctx.fillRect(0,0,W,H);
  ctx.save();ctx.translate(W/2,132);ctx.rotate(-.015);text('BUILDING',0,0,76,'#f5f5f0');text('BREAKER',0,76,96,'#ffca43');ctx.restore();
  text('SMASH THE CITY BEFORE IT CRUSHES YOU',W/2,258,20,'#c2c8d0');
  const items=['START','HOW TO PLAY'];
  items.forEach((label,i)=>{const y=355+i*76,active=i===menuIndex,pulse=active?1+.025*Math.sin(time*6):1;ctx.save();ctx.translate(W/2,y);ctx.scale(pulse,pulse);ctx.fillStyle=active?'#f2b934':'rgba(21,25,34,.9)';ctx.strokeStyle=active?'#fff1a0':'#454b58';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(-170,-28,340,56,14);ctx.fill();ctx.stroke();text(label,0,1,28,active?'#151515':'#d9dde4','center',false);ctx.restore()});
  text('↑ / ↓ SELECT    Z / ENTER CONFIRM',W/2,512,18,'#aeb7c5');
  text(`HIGH SCORE  ${String(highScore).padStart(8,'0')}`,W/2,557,25,'#fff095');
  text('TIP: JUMP + Z INTO THE PULSING WEAK POINT',W/2,611,18,'#8fdcf0');
}
function drawHowTo(){
  drawBackground(ctx);ctx.fillStyle='rgba(4,5,9,.76)';ctx.fillRect(0,0,W,H);text('HOW TO PLAY',W/2,85,56,'#ffd34f');
  const rows=[['← / →','MOVE','Position yourself under the weak point'],['↑','JUMP','Jump high enough to reach the building'],['↓','UP GUARD','Raise a shield upward; building contact lifts it slightly'],['Z','UP ATTACK','Strike straight upward / best after jumping'],['X','SPECIAL','Use when the gauge reaches 100%']];
  ctx.fillStyle='rgba(14,18,27,.9)';ctx.beginPath();ctx.roundRect(W/2-390,145,780,390,24);ctx.fill();
  rows.forEach((r,i)=>{const y=190+i*67;text(r[0],W/2-300,y,30,'#fff071','left');text(r[1],W/2-120,y,25,'#ffffff','left');ctx.save();ctx.font='700 18px Arial, sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#aeb7c5';ctx.fillText(r[2],W/2+45,y);ctx.restore();});
  text('JUMP + Z → BREAK FLOORS → BUILD COMBO → X FOR ULTIMATE',W/2,584,23,'#79e3ff');
  text('PRESS Z / ENTER TO RETURN',W/2,645,22,'#e7e9ed');
}
function drawGameOver(){
  ctx.fillStyle='rgba(5,6,10,.76)';ctx.fillRect(0,0,W,H);text('GAME OVER',W/2,126,82,'#ff5c54');text(`SCORE  ${String(Math.floor(score)).padStart(8,'0')}`,W/2,238,34,'#fff28b');
  ctx.fillStyle='rgba(16,19,27,.88)';ctx.beginPath();ctx.roundRect(W/2-260,285,520,210,22);ctx.fill();
  const rows=[['MAX COMBO',stats.maxCombo],['DESTROYED FLOORS',stats.destroyedFloors],['PERFECT SMASH',stats.perfectSmashes],['PERFECT GUARD',stats.perfectGuards]];rows.forEach((r,i)=>{text(r[0],W/2-210,322+i*42,20,'#aeb5c0','left',false);text(String(r[1]),W/2+210,322+i*42,24,'#ffffff','right')});
  if(gameOverTimer>.55)text('PRESS ENTER / Z TO RETRY',W/2,562,30,'#ffd248');text(`HIGH SCORE  ${String(highScore).padStart(8,'0')}`,W/2,618,20,'#e8e9ed');
}
function drawUltimateOverlay(){
  if(state!=='ultimate')return;ctx.save();ctx.fillStyle=`rgba(0,0,0,${ultimatePhase<2?.58:.18})`;ctx.fillRect(0,0,W,H);if(ultimatePhase<2){ctx.globalCompositeOperation='screen';const g=ctx.createRadialGradient(player.x,player.y,0,player.x,player.y,220);g.addColorStop(0,'rgba(255,237,134,.45)');g.addColorStop(1,'rgba(255,180,60,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}ctx.restore();
}
function render(){
  ctx.clearRect(0,0,W,H);
  if(state==='menu'){drawMenu();return}
  if(state==='howto'){drawHowTo();return}
  const sx=rand(-shake,shake),sy=rand(-shake,shake);ctx.save();ctx.translate(W/2,H/2);ctx.scale(zoom,zoom);ctx.translate(-W/2+sx,-H/2+sy);drawWorld(ctx);ctx.restore();drawUI(ctx);drawUltimateOverlay();drawPopups();
  if(state==='gameover')drawGameOver();
  if(flash>0){ctx.save();ctx.globalAlpha=clamp(flash,0,.75);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.restore()}
  if(state==='play'||state==='ultimate'){
    const vig=ctx.createRadialGradient(W/2,H/2,260,W/2,H/2,760);vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(0,0,0,.46)');ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
  }
}

function frame(now){
  let dt=Math.min(.033,(now-last)/1000);last=now;dt*=slowMo;update(dt);render();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
