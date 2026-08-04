/* =========================================================================
   BuJo Digital — Analytics Dashboard : icons, synthetic data, chart builders
   Lo-fi wireframe. Data is illustrative (realistic shapes, not real records).
   ========================================================================= */

const ICON = {
  chevL:'<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>',
  chevR:'<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>',
  sun:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>',
  week:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="10" x2="9" y2="20"/></svg>',
  cal:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>',
  repeat:'<svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  health:'<svg viewBox="0 0 24 24"><path d="M3 12h4l2 5 4-12 2 7h6"/></svg>',
  habits:'<svg viewBox="0 0 24 24"><polyline points="3 6 4.5 7.5 7 5"/><polyline points="3 12 4.5 13.5 7 11"/><polyline points="3 18 4.5 19.5 7 17"/><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/></svg>',
  grat:'<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/></svg>',
  analytics:'<svg viewBox="0 0 24 24"><path d="M21 21H3V3"/><polyline points="7 14 11 9 14 12 20 5"/></svg>',
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
  scale:'<svg viewBox="0 0 24 24"><path d="M12 3v3"/><circle cx="12" cy="7" r="1.6"/><path d="M5 9h14l3 8a5 5 0 0 1-10 0"/><path d="M19 9l3 8"/><path d="M5 9l-3 8a5 5 0 0 0 10 0"/></svg>',
  bar:'<svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="4" y2="11"/><line x1="10" y1="20" x2="10" y2="4"/><line x1="16" y1="20" x2="16" y2="9"/><line x1="22" y1="20" x2="22" y2="14"/></svg>',
  trend:'<svg viewBox="0 0 24 24"><polyline points="3 17 9 11 13 15 21 6"/><polyline points="15 6 21 6 21 12"/></svg>',
  check:'<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
  task:'<svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  flame:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2c1 3-1 4-2 6s0 4 0 4-2-1-2-3c-2 2-3 4-3 6a7 7 0 0 0 14 0c0-3-2-5-3-7-1.5 1-2 .5-2-1 0-2-1-4-2-5z"/></svg>',
  scatter:'<svg viewBox="0 0 24 24"><path d="M21 21H3V3"/><circle cx="8" cy="15" r="1.4"/><circle cx="12" cy="10" r="1.4"/><circle cx="16" cy="11" r="1.4"/><circle cx="18" cy="6" r="1.4"/><circle cx="10" cy="16" r="1.4"/></svg>',
  arrowDown:'<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
  arrowUp:'<svg viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  download:'<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  printer:'<svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  info:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12" y2="8"/></svg>',
  scoredot:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>',
  book:'<svg viewBox="0 0 24 24"><path d="M4 4h13a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z"/><line x1="9" y1="4" x2="9" y2="20"/></svg>',
};

/* period palette */
const SC = { morning:'var(--orange)', afternoon:'var(--pin)', night:'var(--purple)', avg:'var(--ink)' };
/* priority palette */
const PR = { pink:'var(--pink)', purple:'var(--purple)', yellow:'var(--yellow)', green:'var(--green)' };

/* deterministic pseudo-random */
function rng(i){ const x=Math.sin((i+1)*53.7)*10000; return x-Math.floor(x); }

/* ===================== DATA ===================== */
// Window = last 30 days ending today (Mon, Jun 8 2026). 30 day-slots, idx 0..29.
const NDAYS = 30;

// --- productivity: 3 periods scored 0..10, some NA (null). idx 0..29 ---
const PROD = [];
for(let i=0;i<NDAYS;i++){
  const wk = i%7;                              // 0..6, weekend dip
  const weekend = (wk===5||wk===6);
  let m = 6.8 + (rng(i)-0.4)*3.4 + (weekend?-1.2:0.5);
  let a = 5.8 + (rng(i+40)-0.45)*3.6 + (weekend?-0.8:0);
  let n = 5.0 + (rng(i+80)-0.5)*3.8 + (weekend?0.6:-0.4);
  const clamp = v => Math.max(1, Math.min(10, Math.round(v)));
  m=clamp(m); a=clamp(a); n=clamp(n);
  // scatter a few NA periods (did not intend to be productive)
  if(rng(i+12)>0.86) n=null;
  if(rng(i+33)>0.92) a=null;
  if(weekend && rng(i+7)>0.6) m=null;
  PROD.push({i, m, a, n});
}
// daily average ignores NA
PROD.forEach(d=>{
  const vals=[d.m,d.a,d.n].filter(v=>v!=null);
  d.avg = vals.length ? +(vals.reduce((x,y)=>x+y,0)/vals.length).toFixed(1) : null;
});
function periodAvg(key){
  const vals=PROD.map(d=>d[key]).filter(v=>v!=null);
  return +(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1);
}
const PROD_AVG = { morning:periodAvg('m'), afternoon:periodAvg('a'), night:periodAvg('n') };
const dailyAvgVals = PROD.map(d=>d.avg).filter(v=>v!=null);
const OVERALL_AVG = +(dailyAvgVals.reduce((a,b)=>a+b,0)/dailyAvgVals.length).toFixed(1);
const NA_COUNT = PROD.reduce((s,d)=>s+[d.m,d.a,d.n].filter(v=>v==null).length,0);

// --- tasks per week, broken down by priority (last ~5 weeks) ---
const TASK_WEEKS = [
  {wk:'May 5',  pink:6, purple:5, yellow:8, green:7,  notdone:7 },
  {wk:'May 12', pink:8, purple:4, yellow:9, green:6,  notdone:5 },
  {wk:'May 19', pink:7, purple:6, yellow:7, green:9,  notdone:8 },
  {wk:'May 26', pink:9, purple:5, yellow:10, green:8, notdone:4 },
  {wk:'Jun 2',  pink:7, purple:7, yellow:8, green:6,  notdone:6 },
];
// task disposition (migration ritual) over window
const TASK_FATE = [
  {k:'Completed', pct:71, n:139, color:'var(--green)' },
  {k:'Migrated',  pct:18, n:35,  color:'var(--pin)' },
  {k:'Scheduled', pct:6,  n:12,  color:'var(--yellow)' },
  {k:'Cancelled', pct:5,  n:10,  color:'var(--ink-faint)' },
];
const TASK_TOTAL = TASK_FATE.reduce((s,f)=>s+f.n,0);
const TASK_DONE_RATE = Math.round(TASK_FATE[0].pct);

// --- habits: completion rate over window + current streak ---
const HABITS = [
  {name:'Read 20 min', rate:92, streak:24, ic:'book'},
  {name:'Meditate',    rate:88, streak:18, ic:'grat'},
  {name:'Workout',     rate:79, streak:9,  ic:'health'},
  {name:'Water 2L',    rate:76, streak:12, ic:'health'},
  {name:'No sugar',    rate:64, streak:6,  ic:'task'},
  {name:'Sleep by 11', rate:58, streak:3,  ic:'clock'},
].sort((a,b)=>b.rate-a.rate);
const HABIT_OVERALL = Math.round(HABITS.reduce((s,h)=>s+h.rate,0)/HABITS.length);
// overall daily habit-completion % over 30 days (line)
const HABIT_LINE = [];
for(let i=0;i<NDAYS;i++){
  let v = 74 + (rng(i+200)-0.45)*34;
  v = Math.max(33, Math.min(100, Math.round(v/100*6)/6*100)); // step to /6 habits
  HABIT_LINE.push(Math.round(v));
}
const LEADER = [...HABITS].sort((a,b)=>b.streak-a.streak).slice(0,5);

// --- health: weight + body fat over window, fasting hours over window ---
const HEALTH = [];
for(let i=0;i<NDAYS;i++){
  const w = +(75.2 - i*0.034 + (rng(i+300)-0.5)*0.28).toFixed(1);
  const bf= +(19.9 - i*0.024 + (rng(i+360)-0.5)*0.22).toFixed(1);
  HEALTH.push({i,w,bf});
}
const FAST = [];
for(let i=0;i<NDAYS;i++){
  let v = 16.5 + (rng(i+500)-0.45)*4.0;
  v = Math.max(12.5, Math.min(20.0, v));
  FAST.push(+v.toFixed(1));
}
const FAST_GOAL = 16;
const FAST_AVG = +(FAST.reduce((a,b)=>a+b,0)/FAST.length).toFixed(1);
const W_NOW = HEALTH[HEALTH.length-1].w, W_THEN = HEALTH[0].w;
const W_DELTA = +(W_NOW - W_THEN).toFixed(1);

// --- correlation samples: productivity vs habits-done, productivity vs fasting ---
const COR_HAB = PROD.map((d,i)=> d.avg==null?null:{x:Math.round(HABIT_LINE[i]/100*6)+(rng(i+700)-0.5)*0.5, y:d.avg}).filter(Boolean);
const COR_FAST = PROD.map((d,i)=> d.avg==null?null:{x:FAST[i], y:d.avg}).filter(Boolean);

/* ===================== CHART HELPERS ===================== */
function fmtH(h){ const H=Math.floor(h), M=Math.round((h-H)*60); return `${H}:${String(M).padStart(2,'0')}`; }

// ---- multi-series productivity line chart (NA = gap), 30 day-slots ----
function prodChart(){
  const w=1180,h=300,pL=40,pR=18,pT=22,pB=30;
  const plotW=w-pL-pR, plotH=h-pT-pB, n=NDAYS;
  const xAt=i=>pL+plotW*i/(n-1);
  const yMin=0,yMax=10;
  const yAt=v=>pT+plotH*(1-(v-yMin)/(yMax-yMin));
  let s='';
  // NA bands (vertical) where the daily average is null (whole-day NA)
  PROD.forEach(d=>{ if(d.avg==null){ const x=xAt(d.i); s+=`<rect class="na-band" x="${x-plotW/(n-1)/2}" y="${pT}" width="${plotW/(n-1)}" height="${plotH}"/>`; } });
  // gridlines + y labels every 2
  for(let v=yMin; v<=yMax; v+=2){
    const y=yAt(v);
    s+=`<line class="grid-line" x1="${pL}" y1="${y}" x2="${w-pR}" y2="${y}"/>`;
    s+=`<text class="tick-lbl ink" x="${pL-7}" y="${y+3.5}" text-anchor="end">${v}</text>`;
  }
  // axes
  s+=`<line class="axis-line" x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT+plotH}"/>`;
  s+=`<line class="axis-line" x1="${pL}" y1="${pT+plotH}" x2="${w-pR}" y2="${pT+plotH}"/>`;
  s+=`<text class="ax-title" x="${pL-26}" y="${pT-8}">score</text>`;
  // x labels (a few)
  [0,6,13,20,29].forEach(i=>{
    const lab = i===29?'today':`−${29-i}d`;
    s+=`<text class="tick-lbl ${i===29?'ink':''}" x="${xAt(i)}" y="${pT+plotH+15}" text-anchor="middle" ${i===29?'font-weight="700"':''}>${lab}</text>`;
  });
  // helper to draw a series as broken polylines (gaps where null)
  function series(key, cls, color, sw, dash, dotR){
    const get = key==='avg' ? (d=>d.avg) : (d=>d[key]);
    let runs=[], cur=[];
    PROD.forEach(d=>{ const v=get(d); if(v==null){ if(cur.length){runs.push(cur);cur=[];} } else { cur.push([xAt(d.i),yAt(v)]); } });
    if(cur.length) runs.push(cur);
    let g=`<g class="pseries ${cls}">`;
    runs.forEach(r=>{
      g+=`<polyline points="${r.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
    });
    if(dotR){ runs.flat().forEach(p=>{ g+=`<circle cx="${p[0]}" cy="${p[1]}" r="${dotR}" fill="${key==='avg'?'var(--box)':color}" stroke="${color}" stroke-width="1.75"/>`; }); }
    // period-average annotation line + label (skip for daily avg, which is the line itself)
    if(key!=='avg'){
      const av = key==='m'?PROD_AVG.morning : key==='a'?PROD_AVG.afternoon : PROD_AVG.night;
      const ay=yAt(av);
      g+=`<line x1="${pL}" y1="${ay}" x2="${w-pR}" y2="${ay}" stroke="${color}" stroke-width="1.1" stroke-dasharray="1 5" opacity=".55"/>`;
      g+=`<text class="tick-lbl" x="${w-pR-2}" y="${ay-3}" text-anchor="end" style="fill:${color};font-weight:700">avg ${av}</text>`;
    }
    g+=`</g>`;
    return g;
  }
  // period series first (thin), daily-average on top (thick)
  s+=series('m','s-morning',SC.morning,2,'',0);
  s+=series('a','s-afternoon',SC.afternoon,2,'',0);
  s+=series('n','s-night',SC.night,2,'',0);
  s+=series('avg','s-avg',SC.avg,3,'',3.4);
  return `<svg viewBox="0 0 ${w} ${h}" role="img">${s}</svg>`;
}

// ---- stacked bar: tasks per week by priority + not-done outline on top ----
function taskStack(){
  const w=620,h=300,pL=34,pR=14,pT2=18,pB=34;
  const plotW=w-pL-pR, plotH=h-pT2-pB, n=TASK_WEEKS.length;
  const max=Math.max(...TASK_WEEKS.map(t=>t.pink+t.purple+t.yellow+t.green+t.notdone));
  const yMax=Math.ceil(max/10)*10;
  const slot=plotW/n, bw=Math.min(slot*0.56,48);
  const yAt=v=>pT2+plotH*(1-v/yMax);
  let s='';
  for(let v=0; v<=yMax; v+=10){
    const y=yAt(v);
    s+=`<line class="grid-line" x1="${pL}" y1="${y}" x2="${w-pR}" y2="${y}"/>`;
    s+=`<text class="tick-lbl ink" x="${pL-7}" y="${y+3.5}" text-anchor="end">${v}</text>`;
  }
  s+=`<line class="axis-line" x1="${pL}" y1="${pT2}" x2="${pL}" y2="${pT2+plotH}"/>`;
  s+=`<line class="axis-line" x1="${pL}" y1="${pT2+plotH}" x2="${w-pR}" y2="${pT2+plotH}"/>`;
  s+=`<text class="ax-title" x="${pL-26}" y="${pT2-6}">tasks</text>`;
  TASK_WEEKS.forEach((t,i)=>{
    const x=pL+slot*i+(slot-bw)/2;
    let acc=0;
    const segs=[['pink',t.pink],['purple',t.purple],['yellow',t.yellow],['green',t.green]];
    segs.forEach(([k,v])=>{
      const y0=yAt(acc), y1=yAt(acc+v); acc+=v;
      s+=`<rect x="${x}" y="${y1}" width="${bw}" height="${y0-y1}" fill="${PR[k]}"><title>${t.wk} · ${k} done: ${v}</title></rect>`;
    });
    // not-done segment (outlined / hatched on top)
    const y0=yAt(acc), y1=yAt(acc+t.notdone);
    s+=`<rect x="${x}" y="${y1}" width="${bw}" height="${y0-y1}" fill="var(--box)" stroke="var(--line)" stroke-width="1.5" stroke-dasharray="3 2"><title>${t.wk} · not completed: ${t.notdone}</title></rect>`;
    s+=`<text class="tick-lbl ink" x="${x+bw/2}" y="${pT2+plotH+15}" text-anchor="middle">${t.wk}</text>`;
    s+=`<text class="tick-lbl" x="${x+bw/2}" y="${pT2+plotH+27}" text-anchor="middle">wk ${i+1}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" role="img">${s}</svg>`;
}

// ---- single line chart (overall habit %) ----
function habitLine(){
  const w=620,h=232,pL=34,pR=14,pT=18,pB=26;
  const plotW=w-pL-pR, plotH=h-pT-pB, n=NDAYS;
  const xAt=i=>pL+plotW*i/(n-1);
  const yAt=v=>pT+plotH*(1-v/100);
  let s='';
  [0,25,50,75,100].forEach(v=>{
    const y=yAt(v);
    s+=`<line class="grid-line" x1="${pL}" y1="${y}" x2="${w-pR}" y2="${y}"/>`;
    s+=`<text class="tick-lbl ink" x="${pL-7}" y="${y+3.5}" text-anchor="end">${v}%</text>`;
  });
  s+=`<line class="axis-line" x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT+plotH}"/>`;
  s+=`<line class="axis-line" x1="${pL}" y1="${pT+plotH}" x2="${w-pR}" y2="${pT+plotH}"/>`;
  // average line
  const av=Math.round(HABIT_LINE.reduce((a,b)=>a+b,0)/HABIT_LINE.length);
  const ay=yAt(av);
  s+=`<line x1="${pL}" y1="${ay}" x2="${w-pR}" y2="${ay}" stroke="var(--red)" stroke-width="1.6" stroke-dasharray="5 4"/>`;
  s+=`<text class="tick-lbl" x="${pL+4}" y="${ay-4}" style="fill:var(--red);font-weight:700">avg ${av}%</text>`;
  const pts=HABIT_LINE.map((v,i)=>`${xAt(i)},${yAt(v)}`).join(' ');
  s+=`<polyline points="${pts}" fill="none" stroke="var(--ink)" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>`;
  [0,6,13,20,29].forEach(i=>{
    const lab=i===29?'today':`−${29-i}d`;
    s+=`<text class="tick-lbl ${i===29?'ink':''}" x="${xAt(i)}" y="${pT+plotH+15}" text-anchor="middle" ${i===29?'font-weight="700"':''}>${lab}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" role="img">${s}</svg>`;
}

// ---- dual-axis health line (weight + body fat) ----
function healthLine(){
  const w=620,h=250,pL=40,pR=44,pT=22,pB=26;
  const plotW=w-pL-pR, plotH=h-pT-pB, n=NDAYS;
  const xAt=i=>pL+plotW*i/(n-1);
  const wMin=73,wMax=76, bMin=18.5,bMax=20.5;
  const yW=v=>pT+plotH*(1-(v-wMin)/(wMax-wMin));
  const yB=v=>pT+plotH*(1-(v-bMin)/(bMax-bMin));
  let s='';
  for(let v=wMin; v<=wMax+0.001; v+=1){
    const y=yW(v);
    s+=`<line class="grid-line" x1="${pL}" y1="${y}" x2="${w-pR}" y2="${y}"/>`;
    s+=`<text class="tick-lbl ink" x="${pL-7}" y="${y+3.5}" text-anchor="end">${v}</text>`;
  }
  s+=`<text class="tick-lbl" x="${w-pR+7}" y="${yB(bMax)+3.5}">${bMax}%</text>`;
  s+=`<text class="tick-lbl" x="${w-pR+7}" y="${yB(bMin)+3.5}">${bMin}%</text>`;
  s+=`<line class="axis-line" x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT+plotH}"/>`;
  s+=`<line class="axis-line" x1="${pL}" y1="${pT+plotH}" x2="${w-pR}" y2="${pT+plotH}"/>`;
  s+=`<text class="ax-title" x="${pL-24}" y="${pT-8}">kg</text>`;
  s+=`<text class="ax-title" x="${w-pR-2}" y="${pT-8}" text-anchor="start">bf%</text>`;
  const bfPts=HEALTH.map(d=>`${xAt(d.i)},${yB(d.bf)}`).join(' ');
  s+=`<polyline points="${bfPts}" fill="none" stroke="var(--pin)" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>`;
  const wPts=HEALTH.map(d=>`${xAt(d.i)},${yW(d.w)}`).join(' ');
  s+=`<polyline points="${wPts}" fill="none" stroke="var(--ink)" stroke-width="2.25" stroke-linejoin="round"/>`;
  [0,6,13,20,29].forEach(i=>{
    const lab=i===29?'today':`−${29-i}d`;
    s+=`<text class="tick-lbl ${i===29?'ink':''}" x="${xAt(i)}" y="${pT+plotH+15}" text-anchor="middle" ${i===29?'font-weight="700"':''}>${lab}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" role="img">${s}</svg>`;
}

// ---- fasting bar trend ----
function fastBars(){
  const w=620,h=250,pL=32,pR=14,pT=18,pB=26;
  const plotW=w-pL-pR, plotH=h-pT-pB, n=FAST.length;
  const slot=plotW/n, bw=Math.min(slot*0.62,15);
  const yMin=12,yMax=20;
  const yAt=v=>pT+plotH*(1-(v-yMin)/(yMax-yMin));
  let s='';
  for(let v=yMin; v<=yMax; v+=2){
    const y=yAt(v);
    s+=`<line class="grid-line" x1="${pL}" y1="${y}" x2="${w-pR}" y2="${y}"/>`;
    s+=`<text class="tick-lbl ink" x="${pL-6}" y="${y+3.5}" text-anchor="end">${v}h</text>`;
  }
  FAST.forEach((v,i)=>{
    const x=pL+slot*i+(slot-bw)/2, y=yAt(v), bh=pT+plotH-y, met=v>=FAST_GOAL;
    s+=`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="2.5" fill="${met?'var(--ink)':'var(--box)'}" stroke="${met?'none':'var(--line)'}" stroke-width="${met?0:1.5}"><title>−${29-i}d: ${fmtH(v)} ${met?'· met':'· short'}</title></rect>`;
  });
  const gy=yAt(FAST_GOAL);
  s+=`<line x1="${pL}" y1="${gy}" x2="${w-pR}" y2="${gy}" stroke="var(--line)" stroke-width="1.25"/>`;
  s+=`<text class="tick-lbl" x="${w-pR}" y="${gy-4}" text-anchor="end" style="fill:var(--ink-soft)">goal ${FAST_GOAL}h</text>`;
  const ay=yAt(FAST_AVG);
  s+=`<line x1="${pL}" y1="${ay}" x2="${w-pR}" y2="${ay}" stroke="var(--red)" stroke-width="1.6" stroke-dasharray="5 4"/>`;
  s+=`<text class="tick-lbl" x="${pL+4}" y="${ay-4}" style="fill:var(--red);font-weight:700">avg ${fmtH(FAST_AVG)}</text>`;
  s+=`<line class="axis-line" x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT+plotH}"/>`;
  s+=`<line class="axis-line" x1="${pL}" y1="${pT+plotH}" x2="${w-pR}" y2="${pT+plotH}"/>`;
  [0,9,19,29].forEach(i=>{
    const lab=i===29?'today':`−${29-i}d`;
    s+=`<text class="tick-lbl ${i===29?'ink':''}" x="${pL+slot*i+slot/2}" y="${pT+plotH+15}" text-anchor="middle" ${i===29?'font-weight="700"':''}>${lab}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" role="img">${s}</svg>`;
}

// ---- scatter with simple linear fit ----
function scatter(data, cfg){
  const {w,h,pL,pR,pT,pB, xMin,xMax,yMin,yMax, xLab,yLab, xTitle,yTitle} = cfg;
  const plotW=w-pL-pR, plotH=h-pT-pB;
  const xAt=v=>pL+plotW*(v-xMin)/(xMax-xMin);
  const yAt=v=>pT+plotH*(1-(v-yMin)/(yMax-yMin));
  let s='';
  // gridlines y
  const ySteps=5;
  for(let k=0;k<=ySteps;k++){
    const v=yMin+(yMax-yMin)*k/ySteps, y=yAt(v);
    s+=`<line class="grid-line" x1="${pL}" y1="${y}" x2="${w-pR}" y2="${y}"/>`;
    s+=`<text class="tick-lbl ink" x="${pL-6}" y="${y+3.5}" text-anchor="end">${v.toFixed(0)}</text>`;
  }
  s+=`<line class="axis-line" x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT+plotH}"/>`;
  s+=`<line class="axis-line" x1="${pL}" y1="${pT+plotH}" x2="${w-pR}" y2="${pT+plotH}"/>`;
  // linear regression
  const n=data.length;
  const sx=data.reduce((a,d)=>a+d.x,0), sy=data.reduce((a,d)=>a+d.y,0);
  const sxx=data.reduce((a,d)=>a+d.x*d.x,0), sxy=data.reduce((a,d)=>a+d.x*d.y,0);
  const slope=(n*sxy-sx*sy)/(n*sxx-sx*sx||1), icpt=(sy-slope*sx)/n;
  s+=`<line class="trend-fit" x1="${xAt(xMin)}" y1="${yAt(slope*xMin+icpt)}" x2="${xAt(xMax)}" y2="${yAt(slope*xMax+icpt)}"/>`;
  // points
  data.forEach(d=>{ s+=`<circle class="dot-scatter" cx="${xAt(d.x)}" cy="${yAt(d.y)}" r="4"><title>${xTitle} ${d.x} · ${yTitle} ${d.y}</title></circle>`; });
  // x tick labels
  xLab.forEach(t=>{ s+=`<text class="tick-lbl ink" x="${xAt(t.v)}" y="${pT+plotH+15}" text-anchor="middle">${t.l}</text>`; });
  s+=`<text class="ax-title" x="${pL+plotW/2}" y="${h-3}" text-anchor="middle">${xTitle}</text>`;
  s+=`<text class="ax-title" x="${pL-26}" y="${pT-7}">${yTitle}</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" role="img">${s}</svg>`;
}
