/* =========================================================================
   BuJo Digital — Analytics Dashboard : render + interactivity
   ========================================================================= */

/* nav rail — Analytics active, appended after Health */
const NAV = [
  {ic:'sun', label:'Daily', href:'Daily Dashboard Wireframe.html'},
  {ic:'week', label:'Weekly', href:'Weekly View Wireframe.html'},
  {ic:'cal', label:'Monthly', href:'Monthly &amp; Future Log Wireframe.html'},
  {ic:'repeat', label:'Recurr.'},
  {ic:'habits', label:'Habits', href:'Habits Tracker Wireframe.html'},
  {ic:'grat', label:'Gratitude', href:'Gratitude Journal Wireframe.html'},
  {ic:'health', label:'Health', href:'Health Tracking Wireframe.html'},
  {ic:'analytics', label:'Analytics', active:true},
];
document.getElementById('rail').innerHTML =
  '<div class="logo">B</div>' +
  NAV.map(n=>`<a class="navitem ${n.active?'active':''}" ${n.href?`href="${n.href}"`:''}>
      <span class="ic">${ICON[n.ic]}</span><small>${n.label}</small></a>`).join('');

/* ===================== RENDER PARTS ===================== */
function kpiCards(){
  const cards = [
    {dark:true, ic:'scoredot', lab:'Avg daily productivity', val:`${OVERALL_AVG}<small> / 10</small>`,
      delta:{dir:'up', txt:'+0.5 vs prev 30d'}},
    {ic:'task', lab:'Task completion rate', val:`${TASK_DONE_RATE}<small>%</small>`,
      sub:`${TASK_FATE[0].n} done · ${TASK_TOTAL} logged`},
    {ic:'habits', lab:'Habit completion rate', val:`${HABIT_OVERALL}<small>%</small>`,
      sub:`${HABITS.length} habits · vs. expected`},
    {ic:'clock', lab:'Avg fasting duration', val:`${fmtH(FAST_AVG)}<small> h</small>`,
      sub:`goal ${FAST_GOAL}h · ${FAST.filter(v=>v>=FAST_GOAL).length}/30 met`},
    {ic:'scale', lab:'Weight vs. 30 days ago', val:`${W_NOW}<small> kg</small>`,
      delta:{dir:'down', txt:`${W_DELTA} kg`}},
    {flame:true, lab:'Top habit streak', val:`${LEADER[0].streak}<small> days</small>`,
      sub:`${LEADER[0].name} · longest active`},
  ];
  return cards.map(c=>`
    <div class="kpi ${c.dark?'dark':''}">
      <div class="klab"><span class="${c.flame?'flameic':''}">${c.flame?ICON.flame:ICON[c.ic||'scoredot']}</span>${c.lab}</div>
      <div class="kval">${c.val}</div>
      ${c.sub?`<div class="ksub">${c.sub}</div>`:''}
      ${c.delta?`<div class="delta ${c.delta.dir}">${c.delta.dir==='up'?ICON.arrowUp:ICON.arrowDown}${c.delta.txt}</div>`:''}
    </div>`).join('');
}

function prodFootStats(){
  return `
    <div class="mini-stat"><span class="dotk" style="background:${SC.morning}"></span><span class="mk">Morning</span><span class="mv">${PROD_AVG.morning}</span></div>
    <div class="mini-stat"><span class="dotk" style="background:${SC.afternoon}"></span><span class="mk">Afternoon</span><span class="mv">${PROD_AVG.afternoon}</span></div>
    <div class="mini-stat"><span class="dotk" style="background:${SC.night}"></span><span class="mk">Night</span><span class="mv">${PROD_AVG.night}</span></div>
    <div class="mini-stat"><span class="dotk" style="background:${SC.avg}"></span><span class="mk">Daily avg</span><span class="mv">${OVERALL_AVG}</span></div>
    <div class="mini-stat"><span class="mk">NA periods</span><span class="mv">${NA_COUNT}<small> excl.</small></span></div>`;
}

function taskLegendKeys(){
  return `
    <span class="lk"><span class="sw" style="background:${PR.pink}"></span>Urgent+Imp.</span>
    <span class="lk"><span class="sw" style="background:${PR.purple}"></span>Urgent</span>
    <span class="lk"><span class="sw" style="background:${PR.yellow}"></span>Important</span>
    <span class="lk"><span class="sw" style="background:${PR.green}"></span>Personal</span>
    <span class="lk"><span class="sw out"></span>Not done</span>`;
}

function funnelRows(){
  return TASK_FATE.map(f=>`
    <div class="frow">
      <span class="flbl"><span class="fd" style="background:${f.color}"></span>${f.k}</span>
      <span class="fbar-wrap"><span class="fbar" style="width:${f.pct}%;background:${f.color}">${f.pct}%</span></span>
      <span class="fpct">${f.n}<small>tasks</small></span>
    </div>`).join('');
}

function habitBars(){
  const max=Math.max(...HABITS.map(h=>h.rate));
  return HABITS.map(h=>`
    <div class="hbar">
      <span class="hname"><span class="hi">${ICON[h.ic]}</span>${h.name}</span>
      <span class="htrack"><span class="hfill" style="width:${h.rate}%;${h.rate===max?'background:var(--ink)':''}"></span></span>
      <span class="hpct">${h.rate}%</span>
    </div>`).join('');
}

function leaderRows(){
  return LEADER.map((h,i)=>`
    <div class="lrow ${i===0?'top':''}">
      <span class="lrank">${i+1}</span>
      <span class="lname">${h.name}</span>
      <span class="lstreak">${ICON.flame}${h.streak}<small>days</small></span>
    </div>`).join('');
}

/* ===================== MAIN ===================== */
function buildMain(){
  return `
  <!-- header -->
  <div class="phead">
    <div class="ttl">
      <h1>Analytics</h1>
      <div class="sub">Patterns &amp; trends across every module — <em>review, don't track</em></div>
    </div>
  </div>

  <!-- STICKY CONTROLS -->
  <div class="controls">
    <span class="pin lft">1</span>
    <span class="ck">${ICON.cal} Range</span>
    <div class="seg" id="rangeSeg">
      <button>7 days</button>
      <button class="on">30 days</button>
      <button>3 months</button>
      <button>12 months</button>
      <button>Custom</button>
    </div>
    <div class="customrange">${ICON.cal}<b>May 10</b> → <b>Jun 8, 2026</b></div>
    <span class="spacer"></span>
    <button class="ghost">${ICON.download} Export</button>
  </div>

  <!-- KPI CARDS -->
  <div class="kpis">
    <span class="pin lft" style="top:-13px;left:-13px">2</span>
    ${kpiCards()}
  </div>

  <!-- PRODUCTIVITY SCORE CHART (full width) -->
  <section class="region chart-region">
    <span class="rtag">Productivity score</span><span class="pin">3</span>
    <div class="sec-head">
      <span class="icb">${ICON.trend}</span>
      <span class="st">Productivity over time <small>0–10 per period · NA excluded from averages</small></span>
      <span class="spacer"></span>
      <div class="legend-keys" id="prodKeys">
        <span class="lk toggle-key" data-s="morning"><span class="ln" style="border-color:${SC.morning}"></span>Morning</span>
        <span class="lk toggle-key" data-s="afternoon"><span class="ln" style="border-color:${SC.afternoon}"></span>Afternoon</span>
        <span class="lk toggle-key" data-s="night"><span class="ln" style="border-color:${SC.night}"></span>Night</span>
        <span class="lk toggle-key" data-s="avg"><span class="ln" style="border-color:${SC.avg};border-top-width:4px"></span>Daily avg</span>
      </div>
    </div>
    <span class="pin" style="top:104px;left:-13px">4</span>
    <div class="chart-wrap" id="prodChartWrap">${prodChart()}</div>
    <div class="chart-foot">${prodFootStats()}</div>
    <div class="insight-note">${ICON.info}<span>Faint dotted horizontals mark each period's <b>30-day average</b>. Shaded vertical bands are <b>NA days</b> (no intent to be productive) — shown as gaps, never counted as zero.</span></div>
  </section>

  <!-- TASK ANALYTICS -->
  <div class="grid-task">
    <section class="region chart-region" style="margin-bottom:0">
      <span class="rtag">Task analytics</span><span class="pin">5</span>
      <div class="sec-head">
        <span class="icb">${ICON.bar}</span>
        <span class="st">Completed by week <small>stacked by priority · dashed = not completed</small></span>
      </div>
      <div class="chart-wrap">${taskStack()}</div>
      <div class="legend-keys" style="margin-top:12px">${taskLegendKeys()}</div>
    </section>

    <section class="region chart-region" style="margin-bottom:0">
      <span class="rtag">Migration rate</span><span class="pin">6</span>
      <div class="sec-head">
        <span class="icb">${ICON.repeat}</span>
        <span class="st">What happened to tasks <small>this window · ${TASK_TOTAL} logged</small></span>
      </div>
      <div class="funnel">${funnelRows()}</div>
      <div class="insight-note">${ICON.info}<span><b>Migration rate</b> = tasks pushed forward instead of finished. High migration on a priority colour is a signal to scope smaller or drop it.</span></div>
    </section>
  </div>

  <!-- HABIT ANALYTICS -->
  <div class="grid-habit" style="margin-bottom:22px">
    <section class="region chart-region" style="margin-bottom:0">
      <span class="rtag">Habit analytics</span><span class="pin">7</span>
      <div class="sec-head">
        <span class="icb">${ICON.habits}</span>
        <span class="st">Completion rate per habit <small>sorted high → low</small></span>
      </div>
      <div class="hbars">${habitBars()}</div>
      <div class="sec-head" style="margin-top:20px;margin-bottom:12px">
        <span class="icb">${ICON.trend}</span>
        <span class="st">Overall habit score <small>% of habits done per day</small></span>
      </div>
      <div class="chart-wrap">${habitLine()}</div>
    </section>

    <section class="region chart-region" style="margin-bottom:0">
      <span class="rtag">Streak leaderboard</span><span class="pin">8</span>
      <div class="sec-head">
        <span class="icb">${ICON.flame.replace('<svg','<svg style="stroke:var(--ink);fill:none;stroke-width:1.9"')}</span>
        <span class="st">Top streaks <small>consecutive days, current</small></span>
      </div>
      <div class="leader">${leaderRows()}</div>
      <div class="insight-note">${ICON.info}<span>Leaderboard ranks habits by <b>current</b> streak length — the momentum view. A broken streak drops a habit instantly, which is the nudge.</span></div>
    </section>
  </div>

  <!-- HEALTH TRENDS -->
  <div class="grid-2">
    <section class="region chart-region" style="margin-bottom:0">
      <span class="rtag">Health trends</span><span class="pin">9</span>
      <div class="sec-head">
        <span class="icb">${ICON.scale}</span>
        <span class="st">Weight &amp; body fat <small>dual axis · selected window</small></span>
        <span class="spacer"></span>
        <div class="legend-keys">
          <span class="lk"><span class="ln" style="border-color:var(--ink)"></span>Weight</span>
          <span class="lk"><span class="ln dash" style="border-color:var(--pin)"></span>Body fat</span>
        </div>
      </div>
      <div class="chart-wrap">${healthLine()}</div>
      <div class="chart-foot">
        <div class="mini-stat"><span class="mk">weight Δ</span><span class="mv down">${W_DELTA}<small> kg</small></span></div>
        <div class="mini-stat"><span class="mk">body fat Δ</span><span class="mv down">−0.7<small> pts</small></span></div>
        <div class="mini-stat"><span class="mk">now</span><span class="mv">${W_NOW}<small> kg</small></span></div>
      </div>
    </section>

    <section class="region chart-region" style="margin-bottom:0">
      <span class="rtag">Fasting trend</span><span class="pin">10</span>
      <div class="sec-head">
        <span class="icb">${ICON.clock}</span>
        <span class="st">Fasting duration <small>hours/day · goal ${FAST_GOAL}h</small></span>
        <span class="spacer"></span>
        <div class="legend-keys">
          <span class="lk"><span class="sw"></span>met</span>
          <span class="lk"><span class="sw out"></span>short</span>
        </div>
      </div>
      <div class="chart-wrap">${fastBars()}</div>
      <div class="chart-foot">
        <div class="mini-stat"><span class="mk">avg fast</span><span class="mv">${fmtH(FAST_AVG)}<small> h</small></span></div>
        <div class="mini-stat"><span class="mk">met goal</span><span class="mv">${FAST.filter(v=>v>=FAST_GOAL).length}<small> / 30</small></span></div>
      </div>
    </section>
  </div>

  <!-- CORRELATION INSIGHTS -->
  <div class="grid-2">
    <section class="region chart-region" style="margin-bottom:0">
      <span class="rtag">Patterns</span><span class="pin">11</span>
      <div class="sec-head">
        <span class="icb">${ICON.scatter}</span>
        <span class="st">Productivity vs. habits done <small>each dot = one day</small></span>
      </div>
      <div class="chart-wrap">${scatter(COR_HAB,{w:560,h:230,pL:34,pR:14,pT:16,pB:30,xMin:0,xMax:6,yMin:0,yMax:10,xTitle:'habits done',yTitle:'productivity',xLab:[{v:0,l:'0'},{v:2,l:'2'},{v:4,l:'4'},{v:6,l:'6'}]})}</div>
    </section>

    <section class="region chart-region" style="margin-bottom:0">
      <span class="rtag">Patterns</span><span class="pin">12</span>
      <div class="sec-head">
        <span class="icb">${ICON.scatter}</span>
        <span class="st">Productivity vs. fasting hours <small>each dot = one day</small></span>
      </div>
      <div class="chart-wrap">${scatter(COR_FAST,{w:560,h:230,pL:34,pR:14,pT:16,pB:30,xMin:12,xMax:20,yMin:0,yMax:10,xTitle:'fasting hours',yTitle:'productivity',xLab:[{v:12,l:'12h'},{v:14,l:'14h'},{v:16,l:'16h'},{v:18,l:'18h'},{v:20,l:'20h'}]})}</div>
    </section>
  </div>

  <div class="insight-note" style="margin:0 0 22px">${ICON.info}<span><b>These are patterns, not proof.</b> Dashed line is a simple trend fit across the visible window — a prompt for reflection, not a causal claim. Correlation ≠ causation.</span></div>

  <!-- EXPORT / SHARE -->
  <section class="region foot-actions">
    <span class="rtag">Export &amp; share</span><span class="pin">13</span>
    <span class="fa-note"><b>Review tool, not a tracker.</b> Pull the raw numbers out, or print a clean snapshot for the month-end review.</span>
    <span class="spacer"></span>
    <button class="ghost">${ICON.download} Export data as CSV</button>
    <button class="ghost">${ICON.printer} Print-friendly view</button>
  </section>`;
}
document.getElementById('main').innerHTML = buildMain();

/* ===================== legend ===================== */
const LEGEND = [
  ['Sticky controls','Date-range selector pinned to the top — <b>7 days / 30 days / 3 months / 12 months / Custom</b>. Every chart and KPI on the page re-reads from this one range. Export lives here too.'],
  ['KPI cards','Six at-a-glance metrics across all modules: avg productivity, task &amp; habit completion rates, avg fast, weight change, top streak. The first is emphasised (dark) as the headline number.'],
  ['Productivity chart','Line chart, score 0–10 over the window. Four series: Morning / Afternoon / Night plus the bold <b>daily average</b>. Click a legend key to show/hide that series.'],
  ['NA handling &amp; period averages','NA periods (no intent to be productive) appear as <b>shaded gaps</b>, never as zero. Each period also gets a faint dotted line at its 30-day average.'],
  ['Task analytics','Stacked bars = tasks completed per week, segmented by the four <b>priority colours</b>. The dashed segment on top is tasks logged but <b>not completed</b> that week.'],
  ['Migration rate','Where logged tasks ended up: completed / migrated / scheduled / cancelled. Surfaces how much work is being pushed forward versus finished.'],
  ['Habit completion','Horizontal bars, one per habit, sorted by completion rate — instantly shows which habits stick and which slip. Below it, overall % of habits done per day over time.'],
  ['Streak leaderboard','Habits ranked by <b>current</b> streak. The momentum view that complements the rate bars: a habit can have a high rate but a just-broken streak.'],
  ['Health trends','Dual-axis line: weight (kg, left) and body fat (%, right) over the window, with net deltas summarised below.'],
  ['Fasting trend','Daily fast length as bars — filled met the goal, outlined fell short. Dashed red line marks the rolling average.'],
  ['Correlation: habits','Scatter of daily productivity against habits completed that day. Each dot is one day; the dashed line is a simple trend fit.'],
  ['Correlation: fasting','Same idea against fasting hours — does a longer fast track with a better day?'],
  ['Patterns, not proof + Export','Insights are framed as prompts for reflection, never causal claims. Footer offers <b>CSV export</b> and a <b>print-friendly</b> snapshot for month-end review.'],
];
document.getElementById('legendBody').innerHTML = LEGEND.map((l,i)=>`
  <div class="lg"><span class="n">${i+1}</span><span class="t"><b>${l[0]}.</b> ${l[1]}</span></div>`).join('');

/* ===================== controls ===================== */
// range segmented control
document.querySelectorAll('#rangeSeg button').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('#rangeSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
  });
});
// productivity series toggle
const wrap=document.getElementById('prodChartWrap');
document.querySelectorAll('#prodKeys .toggle-key').forEach(k=>{
  k.addEventListener('click',()=>{
    const s=k.dataset.s;
    k.classList.toggle('off');
    wrap.classList.toggle('hide-'+s, k.classList.contains('off'));
  });
});
// annotations toggle
const annoT=document.getElementById('annoToggle');
annoT.addEventListener('click',()=>{
  annoT.classList.toggle('on');
  document.body.classList.toggle('annotated', annoT.classList.contains('on'));
});
document.getElementById('legendX').addEventListener('click',()=>{
  annoT.classList.remove('on'); document.body.classList.remove('annotated');
});
