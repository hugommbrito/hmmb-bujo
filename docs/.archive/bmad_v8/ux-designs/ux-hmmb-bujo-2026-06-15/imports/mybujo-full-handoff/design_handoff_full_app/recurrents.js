/* =========================================================================
   BuJo Digital — Recurrents Engine : icons, data, render, interactivity
   Lo-fi wireframe. Sample data is illustrative.
   ========================================================================= */

const ICON = {
  sun:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>',
  week:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="10" x2="9" y2="20"/></svg>',
  cal:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>',
  repeat:'<svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  health:'<svg viewBox="0 0 24 24"><path d="M3 12h4l2 5 4-12 2 7h6"/></svg>',
  habits:'<svg viewBox="0 0 24 24"><polyline points="3 6 4.5 7.5 7 5"/><polyline points="3 12 4.5 13.5 7 11"/><polyline points="3 18 4.5 19.5 7 17"/><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/></svg>',
  grat:'<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/></svg>',
  analytics:'<svg viewBox="0 0 24 24"><path d="M21 21H3V3"/><polyline points="7 14 11 9 14 12 20 5"/></svg>',
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
  yearcal:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><circle cx="12" cy="15" r="2.4"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  pencil:'<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
  check:'<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
  x:'<svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
  eye:'<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  arrowR:'<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  moon:'<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  table:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="10" x2="9" y2="20"/><line x1="15" y1="10" x2="15" y2="20"/></svg>',
};

const DOW = ['S','M','T','W','T','F','S'];          // Sun..Sat
const TOD_IC = { morning:ICON.sun, afternoon:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>', night:ICON.moon };

/* nav rail — Recurrents active */
const NAV = [
  {ic:'sun', label:'Daily', href:'Daily Dashboard Wireframe.html'},
  {ic:'week', label:'Weekly', href:'Weekly View Wireframe.html'},
  {ic:'cal', label:'Monthly', href:'Monthly &amp; Future Log Wireframe.html'},
  {ic:'repeat', label:'Recurr.', active:true},
  {ic:'habits', label:'Habits', href:'Habits Tracker Wireframe.html'},
  {ic:'grat', label:'Gratitude', href:'Gratitude Journal Wireframe.html'},
  {ic:'health', label:'Health', href:'Health Tracking Wireframe.html'},
  {ic:'analytics', label:'Analytics', href:'Analytics Dashboard Wireframe.html'},
];
document.getElementById('rail').innerHTML =
  '<div class="logo">B</div>' +
  NAV.map(n=>`<a class="navitem ${n.active?'active':''}" ${n.href?`href="${n.href}"`:''}>
      <span class="ic">${ICON[n.ic]}</span><small>${n.label}</small></a>`).join('');

/* ===================== DATA ===================== */
// days array indices Sun=0 .. Sat=6
const WEEKLY = [
  {p:'yellow', t:'Team standup notes', days:[1,2,3,4,5], tod:'morning'},
  {p:'yellow', t:'Gym — legs / push / pull', days:[1,3,5], tod:'morning'},
  {p:'purple', t:'Pay outstanding invoices', days:[5], tod:'morning'},
  {p:'pink',   t:'Submit weekly timesheet', days:[5], tod:'afternoon'},
  {p:'green',  t:'Grocery run + meal prep', days:[6], tod:'afternoon'},
  {p:'green',  t:'Water the plants', days:[2,6], tod:'morning'},
  {p:'green',  t:'Call parents', days:[0], tod:'afternoon'},
  {p:'pink',   t:'Weekly review & plan ahead', days:[0], tod:'night'},
];
const WEEKLY_TOTAL = 12;

const MONTHLY = [
  {p:'pink',   t:'Rent payment', pat:'1st of month'},
  {p:'purple', t:'Credit-card due', pat:'15th'},
  {p:'green',  t:'Deep-clean apartment', pat:'1st Saturday'},
  {p:'yellow', t:'Back up photos & files', pat:'2nd Monday'},
  {p:'green',  t:'Subscription audit', pat:'28th'},
  {p:'yellow', t:'Month-end budget review', pat:'last day'},
];
const MONTHLY_TOTAL = 6;

const YEARLY = [
  {p:'pink',   t:'Tax filing deadline', date:'April 15', cat:'professional'},
  {p:'green',  t:"Mom's birthday", date:'March 12', cat:'anniversary'},
  {p:'green',  t:'Wedding anniversary', date:'June 24', cat:'anniversary'},
  {p:'yellow', t:'Annual health check-up', date:'Sept 9', cat:'health'},
  {p:'purple', t:'Domain & hosting renewal', date:'Nov 3', cat:'professional'},
  {p:'green',  t:'Passport expiry check', date:'Feb 20', cat:'personal'},
];
const YEARLY_TOTAL = 7;

// injections preview
const INJ_TODAY = [
  {t:'Team standup notes', when:'morning', done:true},
  {t:'Gym — legs', when:'morning', done:false},
  {t:'Water the plants', when:'morning', done:true},
];
const INJ_WEEK = [
  {t:'Pay outstanding invoices', when:'Fri', done:false},
  {t:'Submit weekly timesheet', when:'Fri', done:false},
  {t:'Grocery run + meal prep', when:'Sat', done:false},
  {t:'Call parents', when:'Sun', done:false},
  {t:'Weekly review & plan', when:'Sun', done:false},
];
const INJ_MONTH = [
  {t:'Credit-card due', when:'Jun 15', done:false},
  {t:'Subscription audit', when:'Jun 28', done:false},
  {t:'Month-end budget review', when:'Jun 30', done:false},
];

// injection history (last 30 days, most recent first)
const HIST = [
  {d:'Jun 8', t:'Team standup notes', p:'yellow', inj:'yes', comp:'yes'},
  {d:'Jun 8', t:'Gym — legs', p:'yellow', inj:'yes', comp:'pend'},
  {d:'Jun 8', t:'Water the plants', p:'green', inj:'yes', comp:'yes'},
  {d:'Jun 7', t:'Weekly review & plan', p:'pink', inj:'yes', comp:'yes'},
  {d:'Jun 6', t:'Grocery run + meal prep', p:'green', inj:'yes', comp:'yes'},
  {d:'Jun 5', t:'Pay outstanding invoices', p:'purple', inj:'yes', comp:'yes'},
  {d:'Jun 5', t:'Submit weekly timesheet', p:'pink', inj:'yes', comp:'miss'},
  {d:'Jun 3', t:'Water the plants', p:'green', inj:'yes', comp:'yes'},
  {d:'Jun 1', t:'Rent payment', p:'pink', inj:'yes', comp:'yes'},
];

/* ===================== RENDER PARTS ===================== */
function daysChips(arr){
  return `<span class="days">${DOW.map((d,i)=>`<span class="day ${arr.includes(i)?'on':''}">${d}</span>`).join('')}</span>`;
}
function todPill(tod){
  return `<span class="tod">${TOD_IC[tod]}${tod}</span>`;
}
function tools(){
  return `<span class="rtools"><span class="rtool" title="Edit">${ICON.pencil}</span><span class="rtool" title="Delete">${ICON.trash}</span></span>`;
}

function weeklyRows(){
  return WEEKLY.map(r=>`
    <div class="rec">
      <span class="pdot p-${r.p}"></span>
      <div class="rmain"><div class="rtitle">${r.t}</div>
        <div class="rmeta"><span class="mtag">weekly</span>· repeats on selected days</div></div>
      <div class="rpattern">${daysChips(r.days)}${todPill(r.tod)}</div>
      ${tools()}
    </div>`).join('');
}
function monthlyRows(){
  return MONTHLY.map(r=>`
    <div class="rec">
      <span class="pdot p-${r.p}"></span>
      <div class="rmain"><div class="rtitle">${r.t}</div>
        <div class="rmeta"><span class="mtag">monthly</span>· repeats every month</div></div>
      <div class="rpattern"><span class="ptext">${r.pat}</span></div>
      ${tools()}
    </div>`).join('');
}
function yearlyRows(){
  return YEARLY.map(r=>`
    <div class="rec">
      <span class="pdot p-${r.p}"></span>
      <div class="rmain"><div class="rtitle">${r.t}</div>
        <div class="rmeta"><span class="mtag">yearly</span>· once a year</div></div>
      <div class="rpattern"><span class="ptext">${r.date}</span><span class="cat">${r.cat}</span></div>
      ${tools()}
    </div>`).join('');
}

const TAB_META = {
  weekly:  {label:'Add weekly recurrent',  count:WEEKLY_TOTAL,  rows:weeklyRows,  noun:'weekly recurrents',  head:'Weekly recurrents', sub:'appear every week, on the selected days'},
  monthly: {label:'Add monthly recurrent', count:MONTHLY_TOTAL, rows:monthlyRows, noun:'monthly recurrents', head:'Monthly recurrents', sub:'appear once a month, on a date or relative day'},
  yearly:  {label:'Add yearly recurrent',  count:YEARLY_TOTAL,  rows:yearlyRows,  noun:'yearly recurrents',  head:'Yearly recurrents', sub:'appear once a year, on a fixed date'},
};

function injGroup(title, count, items, link){
  return `
    <div class="injgroup">
      <div class="ig-head"><span class="ig-t">${title}</span><span class="ig-c">${count}</span>
        <span class="spacer"></span><span class="ig-link">${link} ${ICON.arrowR}</span></div>
      ${items.map(it=>`
        <div class="inj ${it.done?'done':''}">
          <span class="ibox">${it.done?ICON.check:''}</span>
          <span class="ititle">${it.t}</span>
          <span class="iwhen">${it.when}</span>
        </div>`).join('')}
    </div>`;
}

/* the open add/edit form (weekly context) */
function editForm(){
  return `
  <div class="editform">
    <span class="pin lft" style="top:-13px;left:-13px">4</span>
    <div class="ef-head">
      <span class="eh-ic">${ICON.plus}</span>
      <span class="eh-t">New weekly recurrent</span>
      <span class="spacer" style="flex:1"></span>
      <span class="eh-x" id="closeForm">${ICON.x}</span>
    </div>

    <div class="field">
      <span class="flab">Task title</span>
      <div class="inp placeholder">e.g. Empty the inbox &amp; triage</div>
    </div>

    <div class="ef-row">
      <div class="field">
        <span class="flab">Priority</span>
        <div class="prio-pick">
          <span class="prio"><span class="pdot p-pink"></span>Pink</span>
          <span class="prio"><span class="pdot p-purple"></span>Purple</span>
          <span class="prio on"><span class="pdot p-yellow"></span>Yellow</span>
          <span class="prio"><span class="pdot p-green"></span>Green</span>
        </div>
      </div>
      <div class="field">
        <span class="flab">Recurrence type</span>
        <div class="typeseg">
          <button class="on">Weekly</button>
          <button>Monthly</button>
          <button>Yearly</button>
        </div>
      </div>
    </div>

    <div class="field">
      <span class="flab">Repeat on <span class="opt">· pick one or more days</span></span>
      <div class="daypick">
        ${DOW.map((d,i)=>`<span class="day ${[1,3,5].includes(i)?'on':''}">${d}</span>`).join('')}
      </div>
    </div>

    <div class="field">
      <span class="flab">Time-of-day preference <span class="opt">· optional</span></span>
      <div class="todpick">
        <span class="todopt on">${ICON.sun}Morning</span>
        <span class="todopt">${TOD_IC.afternoon}Afternoon</span>
        <span class="todopt">${ICON.moon}Night</span>
      </div>
    </div>

    <div class="field">
      <span class="flab">Notes / description <span class="opt">· optional</span></span>
      <div class="inp area placeholder">Context the daily view should carry with this task…</div>
    </div>

    <div class="ef-actions">
      <span style="font-family:var(--sketch);font-size:12px;color:var(--ink-soft)">auto-injects into Daily &amp; Weekly going forward</span>
      <span class="spacer"></span>
      <button class="ghost">Cancel</button>
      <button class="ghost cta">${ICON.check} Save recurrent</button>
    </div>
  </div>`;
}

/* ===================== MAIN ===================== */
let activeTab = 'weekly';

function listRegion(){
  const m = TAB_META[activeTab];
  return `
    <span class="rtag">${m.head}</span><span class="pin">3</span>
    <div class="sec-head">
      <span class="icb">${ICON.repeat}</span>
      <span class="st">${m.head} <small>${m.sub}</small></span>
      <span class="spacer"></span>
      <div class="prio-key">
        <span class="pk"><span class="pdot p-pink"></span>U+I</span>
        <span class="pk"><span class="pdot p-purple"></span>Urgent</span>
        <span class="pk"><span class="pdot p-yellow"></span>Imp.</span>
        <span class="pk"><span class="pdot p-green"></span>Personal</span>
      </div>
    </div>
    ${activeTab==='weekly' ? editForm() : ''}
    <div class="rec-list">${m.rows()}</div>
    <div class="list-foot">
      <span class="lf-count">${m.count} ${m.noun}</span>
      <span class="spacer"></span>
      <button class="ghost cta" id="addBtn">${ICON.plus} ${m.label}</button>
    </div>`;
}

function buildMain(){
  return `
  <!-- header -->
  <div class="phead">
    <div class="ttl">
      <h1>Recurrents</h1>
      <div class="sub">Define it once — <em>the engine copies it forward for you</em></div>
    </div>
    <div class="spacer"></div>
    <span class="pin lft" style="position:relative;top:auto;left:auto;margin-right:2px">1</span>
    <span class="synced"><span class="pls"></span>Last synced: <b>today at 06:00</b></span>
    <button class="ghost">${ICON.eye} Preview this week's injections</button>
  </div>

  <!-- TABS -->
  <div class="tabs" id="tabs" style="position:relative">
    <span class="pin lft" style="top:-13px;left:-13px">2</span>
    <div class="tab active" data-tab="weekly">${ICON.week.replace('<svg','<svg class="tic"')}Weekly <span class="tc">${WEEKLY_TOTAL}</span></div>
    <div class="tab" data-tab="monthly">${ICON.cal.replace('<svg','<svg class="tic"')}Monthly <span class="tc">${MONTHLY_TOTAL}</span></div>
    <div class="tab" data-tab="yearly">${ICON.yearcal.replace('<svg','<svg class="tic"')}Yearly <span class="tc">${YEARLY_TOTAL}</span></div>
  </div>

  <!-- TWO COLUMN -->
  <div class="layout">
    <div class="col">
      <section class="region listwrap" id="listRegion">${listRegion()}</section>

      <!-- INJECTION HISTORY -->
      <section class="region histwrap">
        <span class="rtag">Injection history</span><span class="pin">6</span>
        <div class="sec-head">
          <span class="icb">${ICON.table}</span>
          <span class="st">Injection log <small>last 30 days · verify the engine fired</small></span>
        </div>
        <table class="hist">
          <thead><tr><th>Date</th><th>Recurrent task</th><th>Injected?</th><th>Completed?</th></tr></thead>
          <tbody>
            ${HIST.map(h=>`
              <tr>
                <td class="td-date">${h.d}</td>
                <td><span class="td-task"><span class="pdot p-${h.p}" style="width:11px;height:11px"></span>${h.t}</span></td>
                <td><span class="badge yes">${ICON.check}injected</span></td>
                <td>${h.comp==='yes'?`<span class="badge yes">${ICON.check}done</span>`
                    : h.comp==='miss'?`<span class="badge miss">${ICON.x}missed</span>`
                    : `<span class="badge pend">pending</span>`}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </section>
    </div>

    <!-- RIGHT: injections preview -->
    <div class="col">
      <section class="region injwrap">
        <span class="rtag">Today's injections</span><span class="pin">5</span>
        <div class="sec-head">
          <span class="icb">${ICON.arrowR}</span>
          <span class="st">Injected for you <small>auto-added to Daily &amp; Weekly</small></span>
        </div>
        ${injGroup('Today', 'Mon, Jun 8', INJ_TODAY, 'Daily')}
        ${injGroup('This week', 'Jun 8 – 14', INJ_WEEK, 'Weekly')}
        ${injGroup('This month', 'June', INJ_MONTH, 'Monthly')}
      </section>
    </div>
  </div>`;
}
document.getElementById('main').innerHTML = buildMain();

/* ===================== legend ===================== */
const LEGEND = [
  ['Header + sync status','Title with the engine framing, plus the <b>last auto-injection timestamp</b> ("today at 06:00") so the user can trust the engine ran. "Preview this week\'s injections" dry-runs the rules.'],
  ['Granularity tabs','Three rule scopes: <b>Weekly</b> (every week / specific weekdays), <b>Monthly</b> (a date or relative day), <b>Yearly</b> (a fixed date). Each tab carries its live count. Weekly is the default.'],
  ['Recurrent list','The rules themselves — not day-to-day tasks. Each row: <b>priority dot</b>, title, the recurrence pattern (weekday chips / "1st Saturday" / "March 12"), an optional time-of-day, and edit / delete.'],
  ['Add / edit form','Shown open. Title, <b>priority</b> selector, recurrence <b>type</b>, a conditional <b>pattern picker</b> (weekday chips here), optional time-of-day and notes. Save writes the rule; it injects going forward.'],
  ['Today\'s injections','The engine\'s output: what it actually injected, grouped <b>Today / This week / This month</b>. Completed items strike through; each group links to the Daily or Weekly view where the user completes them.'],
  ['Injection history','An audit table for the last 30 days — date, task, injected?, completed? — so the user can confirm the automation is firing and catch a <b>missed</b> day.'],
];
document.getElementById('legendBody').innerHTML = LEGEND.map((l,i)=>`
  <div class="lg"><span class="n">${i+1}</span><span class="t"><b>${l[0]}.</b> ${l[1]}</span></div>`).join('');

/* ===================== controls ===================== */
function wireListControls(){
  const ab = document.getElementById('addBtn');
  if(ab) ab.addEventListener('click', ()=>{ activeTab='weekly'; switchTab('weekly'); });
  const cf = document.getElementById('closeForm');
  if(cf) cf.addEventListener('click', ()=>{ /* lo-fi: collapse not persisted */ });
  // day-picker + tod + prio + type toggles inside form
  document.querySelectorAll('.daypick .day').forEach(d=>d.addEventListener('click',()=>d.classList.toggle('on')));
  document.querySelectorAll('.todpick .todopt').forEach(o=>o.addEventListener('click',()=>{
    document.querySelectorAll('.todpick .todopt').forEach(x=>x.classList.remove('on')); o.classList.add('on');
  }));
  document.querySelectorAll('.prio-pick .prio').forEach(p=>p.addEventListener('click',()=>{
    document.querySelectorAll('.prio-pick .prio').forEach(x=>x.classList.remove('on')); p.classList.add('on');
  }));
  document.querySelectorAll('.typeseg button').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.typeseg button').forEach(x=>x.classList.remove('on')); b.classList.add('on');
  }));
}
function switchTab(tab){
  activeTab = tab;
  document.querySelectorAll('#tabs .tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
  document.getElementById('listRegion').innerHTML = listRegion();
  wireListControls();
}
document.querySelectorAll('#tabs .tab').forEach(t=>{
  t.addEventListener('click', ()=>switchTab(t.dataset.tab));
});
wireListControls();

const annoT=document.getElementById('annoToggle');
annoT.addEventListener('click',()=>{
  annoT.classList.toggle('on');
  document.body.classList.toggle('annotated', annoT.classList.contains('on'));
});
document.getElementById('legendX').addEventListener('click',()=>{
  annoT.classList.remove('on'); document.body.classList.remove('annotated');
});
