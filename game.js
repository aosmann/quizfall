/* Quizfall — a live class quiz for the EduGames portal (contract v1 + live extension).
   One page, three views chosen by the address:
     ?host=1&topic=…&level=…&count=10&time=20&seed=…   teacher board, runs the game, source of truth for scores
     ?player=1&lock=1&me=<id>&name=…&avatar=<url>       student phone, answers with the 4 colours
     (neither)                                          solo quiz against the clock (normal contract v1 game)
   Live messages ride on a generic relay: host → players {type:'edu-bcast', data}, player → host {type:'edu-up', from, data},
   portal → host {type:'edu-players', players}. See README.md for the data inside them. */
(()=>{
'use strict';
const EQ=window.EduQ;
const {SUBJECTS,DIFFNAME}=EQ;
const URLP=new URLSearchParams(location.search);
const MODE=URLP.get('host')==='1'?'host':URLP.get('player')==='1'?'player':'solo';
const LANG=EQ.getLang?EQ.getLang():'en';
const $=id=>document.getElementById(id);
const stage=$('stage'),topMid=$('topMid'),muteBtn=$('muteBtn'),quitBtn=$('quitBtn');
const RM=matchMedia('(prefers-reduced-motion: reduce)');
const GAME='quizfall';

/* ======================= WORDS (Romanian lives here so questions.js stays identical) ======================= */
const RO={
 'Waiting for players':'Așteptăm jucătorii','Start':'Start','Skip':'Sari peste','Next':'Mai departe','Scoreboard':'Clasament','Podium':'Podium',
 'answers':'răspunsuri','Get ready…':'Pregătește-te…',"You're in!":'Ești înăuntru!','See your name on the board?':'Îți vezi numele pe tablă?',
 'Answer locked in…':'Răspuns trimis…',"Time's up!":'Timpul a expirat!','Correct!':'Corect!','Wrong':'Greșit','Full ranking':'Clasamentul complet',
 'Result sent to your teacher.':'Rezultatul a fost trimis profesorului.','Play again':'Joacă din nou','Change topic':'Alt subiect','Play':'Joacă',
 'Subject':'Materie','Topic':'Subiect','Difficulty':'Dificultate','Questions':'Întrebări','Time per question':'Timp pe întrebare',
 'Right':'Corecte','Best streak':'Cea mai lungă serie','Points':'Puncte','To practise':'De exersat','Paused':'Pauză','Resume':'Continuă','End run':'Termină',
 'How to play':'Cum se joacă','Got it':'Am înțeles','Your answer':'Răspunsul tău','Look at the board!':'Uită-te la tablă!',
 'You joined mid-question. Next one is yours!':'Ai intrat în timpul întrebării. Următoarea e a ta!','Waiting for the teacher…':'Așteptăm profesorul…',
 'Open this board from the portal to host a live game.':'Deschide tabla din portal ca să pornești un joc live.','Final results':'Rezultate finale',
 'Answer right, answer fast.':'Răspunde corect, răspunde repede.','No one answered':'Nimeni nu a răspuns','Sound on':'Sunet pornit','Sound off':'Sunet oprit','Pause':'Pauză','Easy':'Ușor','Medium':'Mediu','Hard':'Greu',
 'Pick the colour with the right answer before the clock runs out. Keys 1 to 4 work too.':'Alege culoarea cu răspunsul corect înainte să expire timpul. Merg și tastele 1–4.',
 'Faster answers score more: 500 to 1000 points.':'Răspunsurile rapide aduc mai mult: între 500 și 1000 de puncte.',
 'Answer streaks add a bonus, up to +500.':'Seriile de răspunsuri corecte aduc bonus, până la +500.',
 'None of these':'Niciuna dintre acestea','Answer streak':'Serie de răspunsuri','Streak lost':'Serie pierdută','Best':'Record'};
const L=s=>LANG==='ro'&&RO[s]!=null?RO[s]:(EQ.T?EQ.T(s):s);
const ordEn=n=>{const v=n%100;return n+((v>10&&v<14)?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th'))};
const W={
 qOf:(i,n)=>LANG==='ro'?`Întrebarea ${i} din ${n}`:`Question ${i} of ${n}`,
 players:n=>LANG==='ro'?(n===1?'1 jucător':`${n} jucători`):(n===1?'1 player':`${n} players`),
 place:(r,ahead,n)=>{if(LANG==='ro'){let s=`Ești pe locul ${r}`;if(ahead&&!ahead.gap)s+=`, la egalitate cu ${ahead.name}`;else if(ahead)s+=`, la ${ahead.gap} ${ahead.gap===1?'punct':'de puncte'} după ${ahead.name}`;else if(n>1)s+=' din '+n;return s}
   let s=`You're in ${ordEn(r)} place`;if(ahead&&!ahead.gap)s+=`, tied with ${ahead.name}`;else if(ahead)s+=`, ${ahead.gap} behind ${ahead.name}`;else if(n>1)s+=` of ${n}`;return s},
 finished:(r,n)=>LANG==='ro'?`Ai terminat pe locul ${r} din ${n}`:`You finished ${ordEn(r)} of ${n}`,
 streak:n=>LANG==='ro'?`Serie de ${n} răspunsuri corecte`:`Answer streak ${n}`,
 count:n=>LANG==='ro'?`${n} întrebări`:`${n} questions`,
 secs:n=>`${n} s`,
 start:n=>n?L('Start'):(LANG==='ro'?'Start (cel puțin 1 jucător)':'Start (needs 1 player)')};

/* ======================= SMALL DOM HELPERS ======================= */
function h(tag,cls,...kids){const e=document.createElement(tag);if(cls)e.className=cls;
  for(const k of kids.flat()){if(k==null||k===false)continue;e.append(k.nodeType?k:document.createTextNode(String(k)))}return e}
const SH=['<path d="M12 2.6 22.6 20.6H1.4z"/>','<path d="M12 1.4 22.6 12 12 22.6 1.4 12z"/>','<circle cx="12" cy="12" r="10.4"/>','<rect x="2.4" y="2.4" width="19.2" height="19.2" rx="2"/>'];
const shp=i=>`<svg class="shp" viewBox="0 0 24 24" aria-hidden="true">${SH[i]}</svg>`;
const ICON={
 check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
 cross:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
 flame:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.6 1.3-4.2 2.6-5.4.2 1.8 1 3 2.2 3.4C11 8 10.6 5 12 2z"/></svg>',
 on:'<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
 off:'<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
 up:'▲',dn:'▼'};
const hue=s=>{let x=0;for(const c of String(s))x=(x*31+c.charCodeAt(0))>>>0;return x%360};
const initials=s=>String(s||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';
function avatarEl(p){const w=h('span','av');w.style.setProperty('--h',hue(p.name));w.textContent=initials(p.name);
  if(p.avatar){const im=new Image();im.alt='';im.decoding='async';im.onload=()=>{w.textContent='';w.classList.add('img');w.append(im)};im.src=p.avatar}return w}
const fmt=n=>Math.round(n).toLocaleString(LANG==='ro'?'ro-RO':'en-US');
let timers=[];const later=(f,ms)=>{const t=setTimeout(f,ms);timers.push(t);return t};
const every=(f,ms)=>{const t=setInterval(f,ms);timers.push(t);return t};
const clearAll=()=>{timers.forEach(t=>clearInterval(t));timers=[]};
let onKey=null;addEventListener('keydown',e=>{if(e.repeat||e.metaKey||e.ctrlKey||e.altKey)return;if(onKey&&onKey(e)!==false)return});
function screen(cls){clearAll();onKey=null;stage.innerHTML='';const s=h('section','screen '+(cls||''));stage.append(s);return s}
const primaryKey=btn=>e=>{if((e.key==='Enter'||e.key===' ')&&btn&&!btn.disabled&&document.activeElement!==btn){e.preventDefault();btn.click()}};

/* ======================= SOUND (WebAudio, no files) ======================= */
const AU={ctx:null,out:null,mus:null,muted:false,want:null,cur:null,timer:null,step:0,next:0,noise:null};
try{AU.muted=localStorage.getItem('quizfall-mute')==='1'}catch(e){}
function ac(){if(!AU.ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
    AU.ctx=new C();AU.out=AU.ctx.createGain();AU.out.gain.value=AU.muted?0:.9;AU.out.connect(AU.ctx.destination);
    AU.mus=AU.ctx.createGain();AU.mus.gain.value=.55;AU.mus.connect(AU.out);
    const n=AU.ctx.sampleRate,b=AU.ctx.createBuffer(1,n,n),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;AU.noise=b}
  return AU.ctx}
function unlock(){const c=ac();if(!c)return;const go=()=>{if(AU.want&&!AU.cur)startMusic(AU.want)};if(c.state==='suspended')c.resume().then(go,()=>{});else go()}
['pointerdown','keydown','touchend'].forEach(ev=>addEventListener(ev,unlock,{passive:true}));
const live=()=>AU.ctx&&AU.ctx.state==='running';
const mf=m=>440*2**((m-69)/12);
function tone(f,t,d,type,v,f2,dest){const c=AU.ctx,o=c.createOscillator(),g=c.createGain();o.type=type||'square';o.frequency.setValueAtTime(f,t);
  if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(dest||AU.out);o.start(t);o.stop(t+d+.03)}
function hiss(t,d,v,type,freq,dest,f2){const c=AU.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=AU.noise;f.type=type||'highpass';f.frequency.setValueAtTime(freq||2000,t);
  if(f2)f.frequency.exponentialRampToValueAtTime(f2,t+d);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(f);f.connect(g);g.connect(dest||AU.out);s.start(t,Math.random()*.5);s.stop(t+d+.02)}
const SFX={
 tick(hurry){if(!live())return;const t=AU.ctx.currentTime;tone(hurry?1650:1150,t,.045,'square',hurry?.11:.05);if(hurry)tone(825,t,.06,'triangle',.08)},
 pop(){if(!live())return;const t=AU.ctx.currentTime;tone(480,t,.13,'sine',.28,1100);tone(1300,t+.06,.08,'triangle',.08)},
 click(){if(!live())return;tone(760,AU.ctx.currentTime,.06,'triangle',.18,520)},
 start(){if(!live())return;const t=AU.ctx.currentTime;[60,64,67,72,76].forEach((m,i)=>tone(mf(m),t+i*.06,.18,'square',.09));hiss(t,.4,.15,'bandpass',500,null,4000)},
 whoosh(){if(!live())return;hiss(AU.ctx.currentTime,.35,.22,'bandpass',300,null,3500)},
 correct(){if(!live())return;const t=AU.ctx.currentTime;[72,76,79,84].forEach((m,i)=>{tone(mf(m),t+i*.075,.22,'triangle',.22);tone(mf(m),t+i*.075,.12,'square',.05)})},
 wrong(){if(!live())return;const t=AU.ctx.currentTime;tone(311,t,.2,'sawtooth',.13,262);tone(233,t+.2,.36,'sawtooth',.13,175)},
 timeup(){if(!live())return;const t=AU.ctx.currentTime;tone(880,t,.25,'square',.1,440);hiss(t,.15,.1,'highpass',3000)},
 reveal(){if(!live())return;const t=AU.ctx.currentTime;tone(110,t,.5,'sine',.5,50);hiss(t,.25,.25,'lowpass',1800);tone(mf(79),t+.02,.3,'triangle',.12)},
 roll(sec){if(!live())return;const t=AU.ctx.currentTime;let x=0;for(let k=0;x<sec;k++){hiss(t+x,.05,.12+.15*x/sec,'bandpass',1800);x+=Math.max(.035,.12-k*.004)}},
 fanfare(){if(!live())return;const t=AU.ctx.currentTime;[[60,64,67],[62,65,69],[64,67,71],[65,69,72],[67,72,76,79]].forEach((c,i)=>c.forEach(m=>{tone(mf(m),t+i*.14,i===4?.9:.16,'square',.06);tone(mf(m),t+i*.14,i===4?1.1:.2,'triangle',.08)}));hiss(t+.56,.8,.12,'highpass',5000)}};
/* two loops: an upbeat lobby groove and a lighter "thinking" loop under the countdown */
const SONGS={
 lobby:{bpm:122,ch:[[60,64,67],[55,59,62],[57,60,64],[53,57,60]],bass:[36,31,33,29],lead:[1,0,0,1,0,0,1,0,1,0,1,0,0,1,0,0],snare:true,v:.08},
 think:{bpm:138,ch:[[57,60,64],[53,57,60],[60,64,67],[55,59,62]],bass:[33,29,36,31],lead:[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0],snare:false,v:.05}};
function playStep(S,s,t){const bar=(s>>4)%4,b=s%16,mus=AU.mus,ch=S.ch[bar];
  if(b%4===0){tone(150,t,.13,'sine',.42,42,mus)}
  if(S.snare&&(b===4||b===12))hiss(t,.12,.16,'highpass',1600,mus);
  if(b%4===2||(!S.snare&&b%2===1))hiss(t,.03,S.snare?.07:.035,'highpass',7500,mus);
  if(b%2===0){const m=S.bass[bar]+(b%4===2?12:0);tone(mf(m),t,.16,'triangle',.2,null,mus)}
  if(S.snare&&(b===6||b===14))ch.forEach(m=>tone(mf(m),t,.12,'square',.035,null,mus));
  if(S.lead[b]){const k=((s>>2)+bar)%3;tone(mf(ch[k]+12),t,.14,'triangle',S.v,null,mus)}}
function startMusic(name){AU.want=name;if(!live()||!name)return;stopMusic(true);const S=SONGS[name];AU.cur=name;AU.step=0;AU.next=AU.ctx.currentTime+.06;
  AU.timer=setInterval(()=>{if(!live())return;while(AU.next<AU.ctx.currentTime+.12){playStep(S,AU.step,AU.next);AU.next+=60/S.bpm/4;AU.step=(AU.step+1)%64}},25)}
function stopMusic(keepWant){clearInterval(AU.timer);AU.timer=null;AU.cur=null;if(!keepWant)AU.want=null}
const music=name=>{if(name)startMusic(name);else stopMusic()};
function paintMute(){muteBtn.innerHTML=AU.muted?ICON.off:ICON.on;muteBtn.setAttribute('aria-label',L(AU.muted?'Sound off':'Sound on'));muteBtn.setAttribute('aria-pressed',AU.muted)}
muteBtn.onclick=()=>{AU.muted=!AU.muted;try{localStorage.setItem('quizfall-mute',AU.muted?'1':'0')}catch(e){}
  ac();if(AU.out)AU.out.gain.setTargetAtTime(AU.muted?0:.9,AU.ctx.currentTime,.02);paintMute()};
paintMute();

/* ======================= CONFETTI ======================= */
function confetti(n){if(RM.matches)return;const cv=$('fx'),x=cv.getContext('2d'),dpr=Math.min(2,devicePixelRatio||1);
  const W_=cv.width=innerWidth*dpr,H_=cv.height=innerHeight*dpr,cols=['#e23a4f','#2a6fdb','#e0a200','#1f9d55','#ffffff','#ffd23f'];
  const P=Array.from({length:n||180},()=>({x:Math.random()*W_,y:-Math.random()*H_*.6,vx:(Math.random()-.5)*3*dpr,vy:(2+Math.random()*4)*dpr,r:Math.random()*6.28,vr:(Math.random()-.5)*.3,s:(5+Math.random()*7)*dpr,c:cols[Math.random()*cols.length|0],k:Math.random()*4|0}));
  const t0=performance.now();(function f(now){const el=now-t0;x.clearRect(0,0,W_,H_);
    P.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.04*dpr;p.r+=p.vr;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.globalAlpha=Math.max(0,1-Math.max(0,el-4200)/1000);
      if(p.k===0)x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);else if(p.k===1){x.beginPath();x.arc(0,0,p.s/2.6,0,6.28);x.fill()}
      else if(p.k===2){x.beginPath();x.moveTo(0,-p.s/2);x.lineTo(p.s/2,p.s/2);x.lineTo(-p.s/2,p.s/2);x.fill()}else{x.rotate(.785);x.fillRect(-p.s/3,-p.s/3,p.s/1.5,p.s/1.5)}x.restore()});
    if(el<5200)requestAnimationFrame(f);else x.clearRect(0,0,W_,H_)})(t0)}

/* ======================= QUESTIONS ======================= */
// the bank lives in questions.js (window.EduQ), shared with every EduGames game. A run is `count` distinct questions,
// "3 × 4" and "4 × 3" count as the same one (same rule as Lanefall). Every question gets a 4th answer.
const qid=Q=>{const m=Q.q.replace(/\s*=\s*\?\s*$/,'').trim().match(/^(-?\d+)\s*([×+])\s*(-?\d+)$/);return(m?[m[1],m[3]].sort().join(m[2]):Q.q)+'|'+Q.answer+'|'+(Q.img||'')};
function seeded(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function withSeed(seed,fn){if(seed==null)return fn();const R=Math.random;Math.random=seeded(seed);try{return fn()}finally{Math.random=R}}
const isNum=s=>/^-?\d+(\.\d+)?$/.test(String(s));
const tmpl0=q=>q.replace(/[\p{Lu}][\p{L}'’.\-]*(\s+(of|and|de|și)?\s*[\p{Lu}][\p{L}'’.\-]*)*/gu,'#').replace(/\d+/g,'#').replace(/\bthe\s+/gi,'').replace(/\s+/g,' ').trim();
/* question "kinds" for the 4th answer: "Capital of Brazil" ~ "Capital of the United Kingdom", "Madrid is the capital of…" ~ "Lima is the capital of…" */
const tmpls=(q,tag)=>{q=String(q);const k=[tmpl0(q.charAt(0).toLowerCase()+q.slice(1)),tmpl0(q)];if(tag)k.unshift('tag:'+tag);return[...new Set(k)]};
const shapeOf=s=>{s=String(s);return[isNum(s),/^["'`]/.test(s),/^\[/.test(s),/^[A-Z][a-z]?$/.test(s),s.split(' ').length>2].join()};
function pad4(Q,pool){const ans=Q.ans.slice(0,4);if(ans.length>=4)return{...Q,ans,correct:ans.indexOf(Q.answer)};
  const have=new Set(ans),pick=a=>a[Math.floor(Math.random()*a.length)];
  if(!Q.img&&pool.rightOf)(pool.rightOf.get(Q.q)||[]).forEach(x=>have.add(x)); // same question text: another right answer would be right here too
  let cand=null;const c=String(Q.answer);
  if(Q.code==='Binary'&&/^[01]{2,}$/.test(c)){for(let k=0;k<12&&!cand;k++){const i=1+Math.floor(Math.random()*(c.length-1)),v=c.slice(0,i)+(c[i]==='0'?'1':'0')+c.slice(i+1);if(!have.has(v))cand=v}}
  else if(isNum(c)&&!Q.img){const n=+c,dec=c.includes('.')?c.split('.')[1].length:0,mag=Math.abs(n);
    const ds=dec?[.5,-.5,1,-1,.1,-.1]:mag>=1000?[100,-100,10,-10,1,-1]:mag>=100?[10,-10,1,-1,2,-2]:[1,-1,2,-2,3,-3,10,-10];
    const opts=ds.map(d=>+(n+d).toFixed(dec)).filter(v=>(n<0||v>=0||ans.some(a=>+a<0))).map(v=>dec?v.toFixed(dec):String(v)).filter(v=>!have.has(v));
    if(opts.length)cand=pick(opts)}
  const um=!Q.img&&c.match(/^(-?\d+(?:\.\d+)?)(\s?(?:°C|°F|%|cm|mm|km|kg|m|g|s|h))$/);
  if(um){const n=+um[1],dec=um[1].includes('.')?um[1].split('.')[1].length:0,ds=dec?[.5,-.5,1,-1]:[1,-1,2,-2,3,-3];
    const o=ds.map(d=>(n+d).toFixed(dec)+um[2]).filter(v=>!have.has(v));if(o.length)cand=pick(o)}
  if(!cand&&pool.byT)for(const k of tmpls(Q.q,Q.tag)){const near=(pool.byT.get(k)||[]).filter(x=>!have.has(x));if(near.length){cand=pick(near);break}}
  if(!cand&&pool.groups){const g=pool.groups.find(G=>ans.filter(a=>G.has(a)).length>=2);if(g){const free=[...g].filter(x=>!have.has(x)),same=free.filter(x=>shapeOf(x)===shapeOf(c));if(same.length)cand=pick(same);else if(free.length)cand=pick(free)}}
  if(!cand){const free=pool.filter(x=>!have.has(x)),same=free.filter(x=>shapeOf(x)===shapeOf(c));if(same.length)cand=pick(same);else if(free.length)cand=pick(free)}
  if(!cand)cand=L('None of these');
  ans.splice(Math.floor(Math.random()*4),0,cand);return{...Q,ans,correct:ans.indexOf(Q.answer)}}
function buildQuestions(topic,level,count,regions){
  const next=EQ.stream(topic,level,regions?{regions}:undefined),out=[],seen=new Set();let dup=0;
  while(out.length<count&&dup<40){const Q=next(),k=qid(Q);if(seen.has(k)){dup++;continue}seen.add(k);dup=0;out.push(Q)}
  while(out.length<count)out.push(next()); // a tiny teacher set may repeat
  const all=out.map(Q=>({q:Q.q,tag:Q.tag,ans:Q.ans,right:String(Q.answer),img:Q.img}));for(let i=0;i<14;i++){const Q=next();all.push({q:Q.q,tag:Q.tag,ans:Q.ans,right:String(Q.answer),img:Q.img})}
  /* extra raw samples of the same kind of question, so the 4th answer fits (for Mix: every topic) */
  const srcs=topic.id&&topic.id.startsWith('mix')?SUBJECTS.filter(x=>x.id!=='mix'&&x.id!=='mine').flatMap(x=>x.topics.filter(t=>!t.unit&&!t.regions)):topic.regions?[]:[topic];
  if(EQ.setLevel)EQ.setLevel(level);
  const groups=[];srcs.forEach(t=>{const G=new Set();for(let i=0,n=srcs.length>1?14:40;i<n;i++){try{const g=t.gen(),a=[g.c,...(g.w||[])].map(String);a.forEach(x=>G.add(x));all.push({q:g.q,tag:g.tag,ans:a,right:String(g.c),img:g.img})}catch(e){break}}groups.push(G)});
  const pool=[...new Set(all.slice(0,out.length+14).flatMap(Q=>Q.ans.map(String)))];pool.byT=new Map();pool.groups=groups;pool.rightOf=new Map();
  all.forEach(Q=>{if(!Q.img){const l=pool.rightOf.get(Q.q)||[];l.push(Q.right);pool.rightOf.set(Q.q,l)}});
  all.forEach(Q=>tmpls(Q.q,Q.tag).forEach(k=>{const l=pool.byT.get(k)||[];Q.ans.forEach(a=>{a=String(a);if(!l.includes(a))l.push(a)});pool.byT.set(k,l)}));
  return out.map(Q=>pad4({...Q,ans:Q.ans.map(String),answer:String(Q.answer)},pool))}
function findTopic(id){for(const s of SUBJECTS){const t=s.topics.find(t=>t.id===id);if(t)return{s,t}}return null}
const scoreFor=(ms,timeS)=>Math.round(1000*(1-(Math.min(Math.max(ms,0),timeS*1000)/1000/timeS)/2));
const bonusFor=streak=>streak>=2?Math.min(500,100*(streak-1)):0;

/* ======================= PORTAL EMBED (edugames contract v1) =======================
   Opened by the portal as ?topic=<id>&level=1-3&count=5-20&time=10-30&lock=1 → settings come from the portal and the run starts at once.
   lock=1 (class mode): no replay, no topic menu. Posts edu-ready on load, edu-progress after every answer, edu-result at the end.
   Live rounds add ?host=1 (teacher board) or ?player=1 (student); messages are relayed by the portal (see README.md). */
const EMBED=(()=>{const p=URLP;if(!p.get('topic'))return null;
  return{topic:p.get('topic'),level:+p.get('level')||0,count:+p.get('count')||0,time:+p.get('time')||0,lock:p.get('lock')==='1',seed:p.has('seed')&&p.get('seed')!==''?(+p.get('seed')|0):null}})();
/* continents from the portal (class mode); no regions param = all continents */
const EMBED_REG=EMBED?(EQ.parseRegions?EQ.parseRegions(URLP.get('regions'))||EQ.REGIONS.map(r=>r.id):null):null;
const TARGET=window.parent!==window?window.parent:(window.opener||null);
let lastAns=null;/* the last answer rides on the next edu-progress, for the portal's mistakes report */
const toParent=m=>{try{if(m&&m.type==='edu-progress'&&lastAns){m.last=lastAns;lastAns=null}if(TARGET)TARGET.postMessage(m,'*')}catch(e){}};
function logResult(r){
  try{const k='edu-results',a=JSON.parse(localStorage.getItem(k)||'[]');a.push(r);localStorage.setItem(k,JSON.stringify(a.slice(-200)))}catch(e){}
  toParent({type:'edu-result',result:r})}
function listen(fn){addEventListener('message',e=>{const ok=e.source&&(e.source===window.parent&&window.parent!==window||window.opener&&e.source===window.opener);
  if(!ok||!e.data||typeof e.data!=='object')return;fn(e.data)})}
const clampInt=(v,lo,hi,d)=>v>0?Math.round(Math.min(hi,Math.max(lo,v))):d;
function runFromEmbed(){const f=findTopic(EMBED.topic);if(!f)return null;
  return{subject:f.s,topic:f.t,level:[1,2,3].includes(EMBED.level)?EMBED.level:f.t.d,count:clampInt(EMBED.count,3,50,10),time:clampInt(EMBED.time,5,120,20),regions:EMBED_REG,lock:EMBED.lock,seed:EMBED.seed}}
const lastOf=(q,pickText,ok)=>({q:q.img?'This flag':q.q,img:q.img||null,answer:q.answer,picked:pickText,ok:ok?1:0,tag:q.tag||null});

/* ======================= SHARED SCREENS ======================= */
function tileEl(i,text,asButton,code){const t=h(asButton?'button':'div','tile t'+i);t.insertAdjacentHTML('afterbegin',shp(i));
  const tx=h(code?'code':'span','tx',text);t.append(tx);if(String(text).length>24)t.classList.add('long');
  if(asButton){t.type='button';t.setAttribute('aria-label',`${i+1}: ${text}`)}return t}
function qcardEl(q){const c=h('div','qcard');if(q.code)c.append(h('span','tag',q.code));c.append(h(q.code?'code':'span',null,q.q));if(q.q.length>70)c.classList.add('long');return c}
function ringEl(){const w=h('div','ring');w.innerHTML='<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="bgc" cx="50" cy="50" r="43"/><circle class="fgc" cx="50" cy="50" r="43"/></svg><b></b>';
  const fg=w.querySelector('.fgc'),b=w.querySelector('b'),C=2*Math.PI*43;fg.style.strokeDasharray=C;
  return{el:w,set(left,total){fg.style.strokeDashoffset=C*(1-Math.max(0,left/total));b.textContent=Math.max(0,Math.ceil(left/1000));w.classList.toggle('hurry',left>0&&left<=5000)}}}
/* a countdown that ticks every second; returns {stop, left()} */
function clock(totalMs,leftMs,onTick,onEnd,quiet){const t0=performance.now();let last=null,done=false;
  const left=()=>Math.max(0,leftMs-(performance.now()-t0));
  const step=()=>{if(done)return;const l=left();onTick(l,totalMs);const s=Math.ceil(l/1000);if(s!==last){if(last!=null&&s>0&&!quiet)SFX.tick(s<=5);last=s}
    if(l<=0){done=true;clearInterval(id);onEnd()}};
  const id=every(step,100);step();return{stop(){done=true;clearInterval(id)},left}}
function chartEl(counts,correct){const max=Math.max(1,...counts),c=h('div','chart');
  counts.forEach((n,i)=>{const b=h('div','bar'+(i===correct?'':' dim')),num=h('div','n'),col=h('div','col t'+i),base=h('div','base t'+i);
    if(i===correct)num.innerHTML=ICON.check;num.append(String(n));base.innerHTML=shp(i);b.append(num,col,base);c.append(b);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{col.style.height=(n/max*68)+'%'}))});return c}
function markTiles(tiles,correct,mine){tiles.forEach((t,i)=>{t.disabled=true;if(i===correct){t.classList.add('win');const ok=h('span','ok');ok.innerHTML=ICON.check;t.append(ok)}else t.classList.add('dim');
  if(i===mine&&mine!==correct)t.append(h('span','mine',L('Your answer')))})}
/* the board's question layout: card on top, timer | image | counter, the 4 tiles */
function questionLayout(s,q,interactive,onPick){const card=qcardEl(q),mid=h('div','qmid'),ring=ringEl(),media=h('div','media'),counter=h('div','counter');
  if(q.img){const im=h('img');im.src=q.img;im.alt='';media.append(im)}mid.append(ring.el,media,counter);
  const tiles=h('div','tiles'),tl=q.ans.map((a,i)=>{const t=tileEl(i,a,interactive,!!q.code);if(interactive)t.onclick=()=>onPick(i);tiles.append(t);return t});
  s.append(card,mid,tiles);return{ring,media,counter,tiles:tl}}
function introScreen(q,i,total,ms){const s=screen('center intro');s.append(h('div','num',W.qOf(i+1,total)));
  if(q.img){const im=h('img');im.src=q.img;im.alt='';s.append(im)}s.append(h('div','q',q.q));const bar=h('div','load'),fill=h('i');fill.style.animationDuration=ms+'ms';bar.append(fill);s.append(bar);return s}
function overlay(build){const o=h('div','overlay'),c=h('div','card');o.append(c);build(c,()=>o.remove());document.body.append(o);return o}

/* ======================= HOST (teacher board) ======================= */
function host(){
  const run=EMBED&&runFromEmbed();
  if(!run){const s=screen('center');s.append(h('p','big',L('Waiting for players')),h('p','sub',L('Open this board from the portal to host a live game.')));return}
  const seed=run.seed!=null?run.seed:(Math.random()*1e9|0);
  const QS=withSeed(seed,()=>buildQuestions(run.topic,run.level,run.count,run.regions));
  const info={subject:run.subject.id,topic:run.topic.id,topicName:run.topic.name,level:run.level,count:QS.length,time:run.time};
  const T=run.time*1000,P=new Map();let seq=0,phase='lobby',cur=-1,answers=new Map(),qIds=new Set(),qClock=null,lastReveal=null,endMsg=null,lobbyRefs=null,qRefs=null,leaving=null;
  topMid.innerHTML='';topMid.append(h('span','pill',`${run.topic.name} · ${L(DIFFNAME[run.level])} · ${W.count(QS.length)}`));
  const bcast=data=>toParent({type:'edu-bcast',data});
  const ensure=f=>{let p=P.get(f.id);if(!p){p={id:f.id,name:f.name||'Player',avatar:f.avatar||null,on:true,seq:seq++,total:0,streak:0,best:0,right:0,asked:0,rank:0,prev:0,isNew:true};P.set(f.id,p)}
    else{if(f.name)p.name=f.name;if(f.avatar)p.avatar=f.avatar;p.on=true}return p};
  const online=()=>[...P.values()].filter(p=>p.on);
  const ranked=()=>[...P.values()].filter(p=>p.on||p.asked).sort((a,b)=>b.total-a.total||a.seq-b.seq);
  const qMsg=(i,left)=>{const q=QS[i];return{k:'q',i,total:QS.length,text:q.q,img:q.img?new URL(q.img,location.href).href:null,code:q.code||null,tag:q.tag||null,
    choices:q.ans,time:run.time,left:Math.round(left),endsAt:Date.now()+Math.round(left)}};
  function stateFor(id){
    if(phase==='lobby')return{k:'lobby',info,n:online().length};
    if(phase==='intro')return{k:'ready',i:cur,total:QS.length,info};
    if(phase==='question'){qIds.add(id);return{...qMsg(cur,qClock?qClock.left():T),done:answers.has(id),info}}
    if(phase==='end')return endMsg;return lastReveal}
  function sync(list){const ids=new Set();(list||[]).forEach(f=>{if(!f||f.id==null)return;ids.add(f.id);ensure(f)});
    for(const p of [...P.values()])if(!ids.has(p.id)){if(phase==='lobby')P.delete(p.id);else p.on=false}
    refresh()}
  function refresh(){if(phase==='lobby'){paintLobby();bcast({k:'lobby',info,n:online().length})}if(phase==='question')paintCounter()}
  listen(m=>{
    if(m.type==='edu-players')sync(m.players);
    else if(m.type==='edu-up'&&m.from&&m.from.id!=null&&m.data){const p=ensure(m.from),d=m.data;
      if(p.isNew&&phase!=='lobby')p.isNew=false;
      if(d.a==='hello'){bcast({...stateFor(p.id),to:p.id});if(phase==='lobby')paintLobby();if(phase==='question')paintCounter();return}
      if(d.a==='answer'&&phase==='question'&&d.q===cur&&!answers.has(p.id)&&[0,1,2,3].includes(d.pick)){
        const hostMs=T-qClock.left();let ms=+d.ms;if(!(ms>=0))ms=hostMs;ms=Math.min(ms,hostMs+1500,T);
        answers.set(p.id,{pick:d.pick,ms});qIds.add(p.id);SFX.click();paintCounter();
        const want=[...qIds].filter(id=>{const x=P.get(id);return x&&(x.on||answers.has(id))});
        if(want.length&&want.every(id=>answers.has(id)))later(endQuestion,450)}}});
  toParent({type:'edu-ready',game:GAME,host:true});

  function lobby(){phase='lobby';const s=screen('lobby');music('lobby');
    const head=h('div','head');head.append(h('h1','big',L('Waiting for players')));
    const count=h('div','count');const list=h('div','plist');const start=h('button','btn go');start.type='button';
    start.onclick=()=>{if(!online().length)return;SFX.start();P.forEach(p=>p.isNew=false);intro(0)};
    head.append(count);s.append(head,list,start);lobbyRefs={count,list,start,chips:new Map()};onKey=primaryKey(start);paintLobby()}
  function paintLobby(){if(!lobbyRefs)return;const {count,list,start,chips}=lobbyRefs,on=online();
    count.innerHTML='';count.append(h('b',null,String(on.length)),h('span',null,W.players(on.length).replace(/^\d+\s/,'')));
    start.disabled=!on.length;start.textContent=W.start(on.length);
    for(const [id,el] of chips)if(!P.has(id)){el.remove();chips.delete(id)}
    on.forEach(p=>{let c=chips.get(p.id);if(!c){c=h('div','chip',avatarEl(p),h('span',null,p.name));chips.set(p.id,c);list.append(c);SFX.pop()}})}

  function intro(i){phase='intro';cur=i;lobbyRefs=null;music(null);SFX.whoosh();bcast({k:'ready',i,total:QS.length,info});
    const s=introScreen(QS[i],i,QS.length,3000);onKey=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();question()}};later(question,3000);s.onclick=()=>question()}
  function question(){if(phase!=='intro')return;phase='question';answers=new Map();qIds=new Set(online().map(p=>p.id));
    const q=QS[cur],s=screen();music('think');bcast({...qMsg(cur,T),info});
    qRefs=questionLayout(s,q,false);const foot=h('div','foot'),skip=h('button','btn ghost',L('Skip'));skip.type='button';skip.onclick=()=>endQuestion();foot.append(skip);s.append(foot);
    onKey=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();endQuestion()}};
    paintCounter();qClock=clock(T,T,(l,t)=>qRefs.ring.set(l,t),()=>{SFX.timeup();later(endQuestion,500)})}
  function paintCounter(){if(!qRefs)return;const pres=[...qIds].filter(id=>{const x=P.get(id);return x&&(x.on||answers.has(id))}).length;
    qRefs.counter.innerHTML='';qRefs.counter.append(h('b',null,`${answers.size}/${Math.max(pres,answers.size)}`),h('span',null,L('answers')))}
  function endQuestion(){if(phase!=='question')return;phase='reveal';if(qClock)qClock.stop();music(null);SFX.reveal();
    const q=QS[cur],counts=[0,0,0,0];answers.forEach(a=>counts[a.pick]++);const res={};
    P.forEach(p=>p.prev=p.rank);
    qIds.forEach(id=>{const p=P.get(id);if(!p)return;const a=answers.get(id),ok=!!a&&a.pick===q.correct;let base=0,bonus=0;
      if(ok){p.streak++;base=scoreFor(a.ms,run.time);bonus=bonusFor(p.streak);p.right++}else p.streak=0;
      p.best=Math.max(p.best,p.streak);p.asked++;p.total+=base+bonus;res[id]={ok:ok?1:0,pick:a?a.pick:-1,pts:base+bonus,base,bonus,total:p.total,streak:p.streak}});
    const R=ranked();R.forEach((p,k)=>p.rank=k+1);
    Object.keys(res).forEach(id=>{const p=P.get(id),k=p.rank-1,up=R[k-1];Object.assign(res[id],{rank:p.rank,ahead:up?{name:up.name,gap:up.total-p.total}:null})});
    lastReveal={k:'reveal',i:cur,total:QS.length,correct:q.correct,answer:q.answer,counts,res,players:R.length,info};bcast(lastReveal);
    // reveal on the board: correct tile highlighted, others dimmed, bar chart in the middle
    const {ring,media,counter,tiles}=qRefs;ring.set(0,1);markTiles(tiles,q.correct,-1);media.innerHTML='';media.append(chartEl(counts,q.correct));
    if(!answers.size)counter.innerHTML='',counter.append(h('span',null,L('No one answered')));
    const s=stage.querySelector('.screen'),foot=s.querySelector('.foot');foot.innerHTML='';const nx=h('button','btn',L('Next'));nx.type='button';nx.onclick=()=>board();foot.append(nx);onKey=primaryKey(nx);nx.focus()}
  function board(){phase='board';qRefs=null;SFX.whoosh();const R=ranked(),top=R.slice(0,5);
    lastReveal={...lastReveal,k:'board',top:top.map(p=>({id:p.id,name:p.name,avatar:p.avatar,total:p.total,rank:p.rank,move:p.prev?p.prev-p.rank:0}))};bcast(lastReveal);
    const s=screen('board');s.append(h('h2',null,L('Scoreboard')));const rows=h('div','rows');
    top.forEach((p,k)=>{const mv=p.prev?p.prev-p.rank:0,r=h('div','prow',h('span','rk',String(p.rank)),avatarEl(p),h('span','nm',p.name),h('span','pt',fmt(p.total)),
      h('span','mv '+(mv>0?'up':mv<0?'dn':''),mv>0?`${ICON.up} ${mv}`:mv<0?`${ICON.dn} ${-mv}`:''));r.style.animationDelay=k*.08+'s';rows.append(r)});
    s.append(rows);const foot=h('div','foot'),last=cur+1>=QS.length,nx=h('button','btn',L(last?'Podium':'Next'));nx.type='button';nx.onclick=()=>last?end():intro(cur+1);foot.append(nx);s.append(foot);onKey=primaryKey(nx);nx.focus()}
  function end(){phase='end';const R=ranked(),res={};R.forEach((p,k)=>{p.rank=k+1;res[p.id]={rank:p.rank,total:p.total,right:p.right,asked:p.asked,best:p.best}});
    endMsg={k:'end',total:QS.length,players:R.length,res,top:R.slice(0,3).map(p=>({id:p.id,name:p.name,avatar:p.avatar,total:p.total})),info};bcast(endMsg);
    toParent({type:'edu-live-end',game:GAME,...info,players:R.length,at:new Date().toISOString(),
      ranking:R.map(p=>({id:p.id,name:p.name,rank:p.rank,score:p.total,right:p.right,asked:p.asked,bestStreak:p.best}))});
    const s=screen('end');const pod=h('div','podium');const order=[[R[1],2,'1.6s'],[R[0],1,'3.1s'],[R[2],3,'.3s']];
    order.forEach(([p,n,d])=>{const col=h('div','pcol p'+n);col.style.setProperty('--d',d);if(p){const who=h('div','who',avatarEl(p),h('span','nm',p.name),h('span','pt',fmt(p.total)));who.style.setProperty('--d',(parseFloat(d)+.5)+'s');col.append(who)}
      const st=h('div','step',String(n));st.style.setProperty('--d',d);col.append(st);pod.append(col)});
    s.append(h('h2','big',L('Final results')),pod);SFX.roll(3);later(()=>{SFX.fanfare();confetti(220)},RM.matches?0:3300);later(()=>music('lobby'),5500);
    later(()=>{const fr=h('div','fullrank',h('h3',null,L('Full ranking')));R.forEach((p,k)=>{const r=h('div','prow',h('span','rk',String(p.rank)),avatarEl(p),h('span','nm',p.name),h('span','pt',`${p.right}/${p.asked} · ${fmt(p.total)}`));r.style.animationDelay=Math.min(k,12)*.05+'s';fr.append(r)});s.append(fr)},RM.matches?0:5000)}
  lobby()}

/* ======================= PLAYER (student phone) ======================= */
function player(){
  const ME=URLP.get('me')||('p'+(Math.random()*1e9|0)),NAME=URLP.get('name')||'Player',AV=URLP.get('avatar')||null;
  let info=null,phase='wait',heard=false,qClock=null;const QS={},answered=new Set(),judged=new Set();
  let right=0,asked=0,bestStreak=0,score=0;const missed=[];let ended=false;
  const up=data=>toParent({type:'edu-up',data:{...data,me:ME}});
  listen(m=>{if(m.type!=='edu-bcast'||!m.data||typeof m.data!=='object')return;const d=m.data;if(d.to!=null&&d.to!==ME)return;heard=true;if(d.info)info=d.info;handle(d)});
  toParent({type:'edu-ready',game:GAME,player:true});up({a:'hello'});
  const hi=setInterval(()=>{if(heard)clearInterval(hi);else up({a:'hello'})},3000);
  topMid.innerHTML='';const tp=h('span','pill',NAME);topMid.append(tp);
  function handle(d){
    if(ended&&d.k!=='end')return;
    if(d.k==='lobby'){if(phase==='wait'||phase==='init')waitScreen();return}
    if(d.k==='ready'){readyScreen(d);return}
    if(d.k==='q'){QS[d.i]=d;if(answered.has(d.i)||d.done){answered.add(d.i);lockedScreen(d.i,-1)}else questionScreen(d);return}
    if(d.k==='reveal'){resultScreen(d);return}
    if(d.k==='board'){if(!judged.has(d.i))resultScreen(d);return}
    if(d.k==='end')endScreen(d)}
  function waitScreen(){phase='wait';const s=screen('center');s.append(avatarEl({name:NAME,avatar:AV}),h('h1','big',L("You're in!")),h('p','sub',L('See your name on the board?')));
    s.querySelector('.av').style.cssText='width:min(34vmin,150px);height:min(34vmin,150px);font-size:40px;border:5px solid #fff'}
  function readyScreen(d){phase='ready';const s=screen('center');s.append(h('div','pill',W.qOf(d.i+1,d.total)),h('h1','big',L('Get ready…')),h('div','spin'))}
  function questionScreen(d){phase='question';const s=screen();const recv=performance.now(),total=d.time*1000;
    const pill=h('span','timerpill'),top=h('div','pl-top',h('span',null,`${d.i+1}/${d.total}`),pill);
    const card=h('div','pl-q');if(d.img){const im=h('img');im.src=d.img;im.alt='';card.append(im)}card.append(h(d.code?'code':'span',null,d.text));
    const grid=h('div','pl-tiles');const pick=k=>{if(answered.has(d.i))return;answered.add(d.i);const ms=Math.round(total-d.left+(performance.now()-recv));
      up({a:'answer',q:d.i,pick:k,ms});SFX.click();if(navigator.vibrate)try{navigator.vibrate(25)}catch(e){};lockedScreen(d.i,k)};
    d.choices.forEach((a,k)=>{const t=tileEl(k,a,true,!!d.code);t.onclick=()=>pick(k);grid.append(t)});s.append(top,card,grid);
    onKey=e=>{const k='1234'.indexOf(e.key);if(k>=0){e.preventDefault();pick(k)}};
    qClock=clock(total,d.left,l=>{pill.textContent=Math.ceil(l/1000);pill.classList.toggle('hurry',l<=5000)},()=>{if(!answered.has(d.i)){const s2=screen('center');s2.append(h('h1','big',L("Time's up!")),h('p','sub',L('Look at the board!')));SFX.timeup()}},true)}
  function lockedScreen(i,k){phase='locked';const s=screen('center');if(k>=0){const b=h('div','lockbig t'+k);b.innerHTML=shp(k);s.append(b)}
    s.append(h('h1','big',L('Answer locked in…')),h('div','spin'))}
  function resultScreen(d){const r=d.res&&d.res[ME],q=QS[d.i];phase='result';const s=screen();
    if(!r){const f=h('div','full neutral');f.append(h('h1','big',L('Look at the board!')),h('p','sub',L('You joined mid-question. Next one is yours!')));s.append(f);return}
    const box=h('div','full '+(r.ok?'good':'bad')),mark=h('div','mark');mark.innerHTML=r.ok?ICON.check:ICON.cross;
    box.append(mark,h('h1','big',r.ok?L('Correct!'):r.pick<0?L("Time's up!"):L('Wrong')));
    if(r.ok)box.append(h('div','pts','+'+fmt(r.pts)));
    if(r.ok&&r.streak>=1){const st=h('div','streak');st.innerHTML=ICON.flame;st.append(W.streak(r.streak)+(r.bonus?` · +${r.bonus}`:''));box.append(st)}
    box.append(h('p','place',W.place(r.rank,r.ahead,d.players)));s.append(box);
    if(!judged.has(d.i)){judged.add(d.i);(r.ok?SFX.correct:SFX.wrong)();if(navigator.vibrate)try{navigator.vibrate(r.ok?[30,40,30]:120)}catch(e){}
      asked++;if(r.ok)right++;bestStreak=Math.max(bestStreak,r.streak);score=r.total;
      const qq={q:q?q.text:'',img:q?q.img:null,answer:d.answer,tag:q?q.tag:null},pickT=r.pick>=0&&q?q.choices[r.pick]:'missed';
      if(!r.ok)missed.push({q:qq.img?'This flag':qq.q,answer:qq.answer,picked:pickT});
      lastAns=lastOf(qq,pickT,r.ok);toParent({type:'edu-progress',game:GAME,score,right,asked})}}
  function endScreen(d){if(ended)return;ended=true;phase='end';const r=d.res&&d.res[ME];const s=screen('center end');
    if(r){s.append(avatarEl({name:NAME,avatar:AV}),h('h1','big mid-t',W.finished(r.rank,d.players)));const st=h('div','stats');
      st.append(h('div','stat',h('b',null,fmt(r.total)),h('span',null,L('Points'))),h('div','stat',h('b',null,`${r.right}/${r.asked}`),h('span',null,L('Right'))),h('div','stat',h('b',null,String(r.best)),h('span',null,L('Best streak'))));
      s.append(st);if(r.rank<=3){SFX.fanfare();confetti(160)}}
    else s.append(h('h1','big',L('Final results')),h('p','sub',L('Look at the board!')));
    s.append(h('p','note',L('Result sent to your teacher.')));s.querySelector('.av')&&(s.querySelector('.av').style.cssText='width:min(26vmin,120px);height:min(26vmin,120px);font-size:34px;border:5px solid #fff');
    const inf=info||{};const tp=inf.topic?findTopic(inf.topic):null;
    logResult({game:GAME,subject:inf.subject||(tp&&tp.s.id)||null,topic:inf.topic||null,topicName:inf.topicName||(tp&&tp.t.name)||null,level:inf.level||null,
      score:r?r.total:score,right:r?r.right:right,asked:r?r.asked:asked,bestStreak:r?r.best:bestStreak,missed,rank:r?r.rank:null,players:d.players,
      count:inf.count||d.total,time:inf.time||null,mode:'live',at:new Date().toISOString()})}
  phase='init';waitScreen()}

/* ======================= SOLO (contract v1 game) ======================= */
const cfg={subject:'english',topic:null,diffs:{},count:10,time:20};
try{const s=JSON.parse(localStorage.getItem('quizfall-cfg')||'{}');Object.assign(cfg,s);cfg.diffs=s.diffs||{}}catch(e){}
const saveCfg=()=>{try{localStorage.setItem('quizfall-cfg',JSON.stringify(cfg))}catch(e){}};
const curSubject=()=>SUBJECTS.find(s=>s.id===cfg.subject)||SUBJECTS[0];
const curTopic=()=>{const s=curSubject(),list=EQ.topicsOf?EQ.topicsOf(s,s.topics.find(t=>t.id===cfg.topic)||s.topics[0]):s.topics;return s.topics.find(t=>t.id===cfg.topic)||list[0]||s.topics[0]};
const bestKey=r=>`quizfall-best-${r.topic.id}-d${r.level}-n${r.count}-t${r.time}`;
const getBest=r=>{try{return +localStorage.getItem(bestKey(r))||0}catch(e){return 0}};
function chipsRow(opts,val,on){const c=h('div','chips');opts.forEach(([v,lab])=>{const b=h('button',null,lab);b.type='button';b.setAttribute('aria-pressed',v===val);b.onclick=()=>on(v);c.append(b)});return c}
function menu(){topMid.innerHTML='';quitBtn.hidden=true;music('lobby');const s=screen('menu');
  const hero=h('div','hero');hero.innerHTML='<div class="logo" data-noi18n><span class="mk" aria-hidden="true"><b></b><b></b><b></b><b></b></span>Quizfall</div>';hero.append(h('p',null,L('Answer right, answer fast.')));
  const card=h('div','card'),sub=curSubject(),top=curTopic();if(cfg.topic!==top.id){cfg.topic=top.id}
  const re=()=>{saveCfg();const y=s.scrollTop;menu();stage.querySelector('.screen').scrollTop=y};
  card.append(h('h3',null,L('Subject')),chipsRow(SUBJECTS.map(x=>[x.id,x.name]),sub.id,v=>{cfg.subject=v;cfg.topic=null;re()}));
  card.append(h('h3',null,L('Topic')));const box=h('div','topics');
  const tabs=EQ.topicTabs&&EQ.topicTabs(sub,top,id=>{cfg.topic=id;re()});if(tabs)card.append(tabs);
  (EQ.topicsOf?EQ.topicsOf(sub,top):sub.topics).forEach(tp=>{const b=h('button',null,h('strong',null,tp.name),h('span',null,tp.regions&&EQ.regionLabel?EQ.regionLabel(EQ.getRegions(tp.id)):(tp.bl||'')));
    b.type='button';b.setAttribute('aria-pressed',tp.id===top.id);b.onclick=()=>{cfg.topic=tp.id;re()};box.append(b)});card.append(box);
  const pk=EQ.regionPicker&&EQ.regionPicker(top,{onChange:re});if(pk)card.append(pk);
  const lvl=cfg.diffs[top.id]||top.d;
  card.append(h('h3',null,L('Difficulty')),chipsRow([[1,L('Easy')],[2,L('Medium')],[3,L('Hard')]],lvl,v=>{cfg.diffs[top.id]=v;re()}));
  card.append(h('h3',null,L('Questions')),chipsRow([5,10,15,20].map(n=>[n,String(n)]),cfg.count,v=>{cfg.count=v;re()}));
  card.append(h('h3',null,L('Time per question')),chipsRow([10,20,30].map(n=>[n,W.secs(n)]),cfg.time,v=>{cfg.time=v;re()}));
  const r={subject:sub,topic:top,level:lvl,count:cfg.count,time:cfg.time,regions:null,lock:false},b=getBest(r);
  if(b)card.append(h('p','best',`${L('Best')}: ${fmt(b)}`));
  const play=h('button','btn go',L('Play'));play.type='button';play.onclick=()=>{SFX.start();soloRun(r)};card.append(play);
  s.append(hero,card);onKey=primaryKey(play);
  let seen=false;try{seen=localStorage.getItem('quizfall-tut')==='1'}catch(e){}
  if(!seen&&!document.querySelector('.overlay'))tutorial()}
function tutorial(){overlay((c,close)=>{c.append(h('h2',null,L('How to play')));const ul=h('ul');
  [[0,'Pick the colour with the right answer before the clock runs out. Keys 1 to 4 work too.'],[2,'Faster answers score more: 500 to 1000 points.'],[3,'Answer streaks add a bonus, up to +500.']].forEach(([k,t])=>{const i=h('i','t'+k);i.innerHTML=shp(k);ul.append(h('li',null,i,h('span',null,L(t))))});
  const ok=h('button','btn',L('Got it'));ok.type='button';ok.onclick=()=>{try{localStorage.setItem('quizfall-tut','1')}catch(e){}close()};c.append(ul,ok);setTimeout(()=>ok.focus(),50)})}
function soloRun(r){
  const QS=buildQuestions(r.topic,r.level,r.count,r.regions);let i=0,score=0,right=0,asked=0,streak=0,best=0;const missed=[];const t0=Date.now();let paused=null,qc=null,leftMs=0,qState=null,done=false;
  topMid.innerHTML='';const pill=h('span','pill');topMid.append(pill);const paint=()=>{pill.textContent=`${Math.min(i+1,QS.length)}/${QS.length} · ${fmt(score)}`};paint();
  quitBtn.hidden=false;quitBtn.onclick=()=>pause();
  function pause(){if(paused||done)return;if(qc){leftMs=qc.left();qc.stop();qc=null}music(null);
    paused=overlay((c,close)=>{c.append(h('h2',null,L('Paused')));const res=h('button','btn',L('Resume'));res.type='button';
      res.onclick=()=>{close();paused=null;resumeQ()};const q=h('button','btn ghost',L('End run'));q.type='button';q.style.cssText='background:#eef1fa;color:#141a33';
      q.onclick=()=>{close();paused=null;finish('quit')};c.append(res,q);setTimeout(()=>res.focus(),50)})}
  let resumeQ=()=>{};
  function intro(){qState='intro';paint();const s=introScreen(QS[i],i,QS.length,1700);SFX.whoosh();const go=()=>{if(qState==='intro'&&!paused)question()};resumeQ=go;later(go,1700);s.onclick=go;onKey=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}if(e.key==='Escape'||e.key==='p')pause()}}
  function question(){qState='question';const q=QS[i],s=screen(),T=r.time*1000;music('think');let picked=false;
    const L_=questionLayout(s,q,true,k=>judge(k));s.append(h('div','foot'));L_.counter.append(h('b',null,`${i+1}/${QS.length}`),h('span',null,L('Questions')));
    const startClock=left=>{qc=clock(T,left,(l,t)=>L_.ring.set(l,t),()=>{SFX.timeup();judge(-1)})};
    resumeQ=()=>{music('think');startClock(leftMs)};startClock(T);
    onKey=e=>{const k='1234'.indexOf(e.key);if(k>=0){e.preventDefault();judge(k)}if(e.key==='Escape'||e.key==='p')pause()};
    function judge(k){if(picked||paused)return;picked=true;const ms=qc?T-qc.left():T;if(qc){qc.stop();qc=null}qState='reveal';music(null);
      const ok=k===q.correct;asked++;let pts=0,bonus=0;
      if(ok){streak++;pts=scoreFor(ms,r.time);bonus=bonusFor(streak);right++;SFX.correct()}else{streak=0;SFX.wrong();missed.push({q:q.img?'This flag':q.q,img:q.img||null,answer:q.answer,picked:k>=0?q.ans[k]:'missed'})}
      best=Math.max(best,streak);score+=pts+bonus;paint();markTiles(L_.tiles,q.correct,k);
      const bn=h('div','banner '+(ok?'good':'bad'),h('b',null,ok?`${L('Correct!')} +${fmt(pts+bonus)}`:k<0?L("Time's up!"):L('Wrong')));
      if(ok&&streak>=2)bn.append(h('span',null,W.streak(streak)+` · +${bonus}`));stage.append(bn);
      lastAns=lastOf(q,k>=0?q.ans[k]:'missed',ok);toParent({type:'edu-progress',game:GAME,score,right,asked});
      const foot=s.querySelector('.foot'),last=i+1>=QS.length,nx=h('button','btn',L(last?'Final results':'Next'));nx.type='button';
      const go=()=>{if(paused||qState!=='reveal')return;bn.remove();i++;if(last)finish('end');else intro()};resumeQ=go;nx.onclick=go;foot.append(nx);onKey=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}if(e.key==='Escape'||e.key==='p')pause()};
      later(()=>bn.remove(),1500);later(go,3600)}}
  function finish(cause){if(done)return;done=true;qState='end';clearAll();quitBtn.hidden=true;music(null);document.querySelectorAll('.banner').forEach(b=>b.remove());
    const prev=getBest(r);if(score>prev)try{localStorage.setItem(bestKey(r),String(score))}catch(e){}
    logResult({game:GAME,subject:r.subject.id,topic:r.topic.id,topicName:r.topic.name,level:r.level,score,right,asked,bestStreak:best,
      missed:missed.map(m=>({q:m.q,answer:m.answer,picked:m.picked})),at:new Date().toISOString(),count:QS.length,time:r.time,timeUsed:Math.round((Date.now()-t0)/1000),cause,mode:'solo'});
    const s=screen('center end');s.append(h('h1','big',L('Final results')));const st=h('div','stats');
    st.append(h('div','stat',h('b',null,fmt(score)),h('span',null,L('Points'))),h('div','stat',h('b',null,`${right}/${asked}`),h('span',null,L('Right'))),h('div','stat',h('b',null,String(best)),h('span',null,L('Best streak'))));
    s.append(st);if(score>prev&&prev)s.append(h('p','note',`${L('Best')}: ${fmt(score)}!`));
    if(missed.length){const m=h('div','missed',h('h3',null,L('To practise'))),ul=h('ul');missed.forEach(x=>{const q=h('span');if(x.img){const im=h('img');im.src=x.img;im.alt='';q.append(im)}else q.append(x.q);
      ul.append(h('li',null,q,h('span',null,h('s',null,x.picked),h('b',null,x.answer))))});m.append(ul);s.append(m)}
    if(r.lock)s.append(h('p','note',L('Result sent to your teacher.')));
    else{const row=h('div','row'),a=h('button','btn go',L('Play again')),b=h('button','btn ghost',L('Change topic'));a.type=b.type='button';
      a.onclick=()=>soloRun(r);b.onclick=()=>menu();row.append(a,b);s.append(row);onKey=primaryKey(a)}
    if(asked&&right/asked>=.7){SFX.fanfare();confetti(160)}}
  intro()}
function solo(){if(EMBED){const r=runFromEmbed();if(r){soloRun(r);return}}menu()}

/* ======================= GO ======================= */
if(MODE==='host')host();
else if(MODE==='player')player();
else{solo();toParent({type:'edu-ready',game:GAME})}
document.documentElement.dataset.mode=MODE;
})();
