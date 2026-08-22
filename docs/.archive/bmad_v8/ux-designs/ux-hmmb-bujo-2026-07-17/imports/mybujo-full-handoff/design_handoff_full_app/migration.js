/* =========================================================================
   BuJo Digital — Migration Ritual : cycle-closure wireframe
   Three variants (Daily / Weekly / Monthly) selected via tabs.
   Incomplete tasks MUST get a decision before the cycle can close.
   Lo-fi wireframe. Sample data is illustrative.
   ========================================================================= */

const ICON = {
  sun:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>',
  week:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="10" x2="9" y2="20"/></svg>',
  cal:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>',
  repeat:'<svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  health:'<svg viewBox="0 0 24 24"><path d="M3 12h4l2 5 4-12 2 7h6"/></svg>',
  inbox:'<svg viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  layers:'<svg viewBox="0 0 24 24"><polygon points="12 2 22 8.5 12 15 2 8.5 12 2"/><polyline points="2 15.5 12 22 22 15.5"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  forward:'<svg viewBox="0 0 24 24"><line x1="4" y1="12" x2="18" y2="12"/><polyline points="13 7 18 12 13 17"/></svg>',
  arrow:'<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  down:'<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="6 12 12 19 18 12"/></svg>',
  x:'<svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
  check:'<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
  lock:'<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  unlock:'<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>',
  save:'<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  inbox2:'<svg viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
};

/* nav rail — Weekly is the active context for the default ritual */
const NAV = [
  {ic:'sun', label:'Daily', href:'Daily Dashboard Wireframe.html'},
  {ic:'week', label:'Weekly', active:true, href:'Weekly View Wireframe.html'},
  {ic:'cal', label:'Monthly', href:'Monthly &amp; Future Log Wireframe.html'},
  {ic:'repeat', label:'Recurr.', href:'Recurrents Engine Wireframe.html'},
  {ic:'health', label:'Health', href:'Health Tracking Wireframe.html'},
];
document.getElementById('rail').innerHTML =
  '<div class="logo">B</div>' +
  NAV.map(n=>`<a class="navitem ${n.active?'active':''}" ${n.href?`href="${n.href}"`:''}>
      <span class="ic">${ICON[n.ic]}</span><small>${n.label}</small></a>`).join('');

/* ===================== VARIANT DATA ===================== */
// decision values for incomplete: null | 'mig' | 'sch' | 'can'
// decision values for pool:       null | 'inc' | 'sch'
const DATA = {
  daily: {
    tabIcon:'sun', tabLabel:'Daily',
    closeLabel:'Yesterday', openLabel:'Today',
    closingPeriod:'Mon, Jun 8', openingPeriod:'Tue, Jun 9',
    closeNoun:'Monday', destTitle:"Today's task list", destWhen:'Tue, Jun 9',
    col3:{ title:'Weekly log', sub:'not yet assigned to a day', icon:'week',
           foot:'Optional · pull in what fits today' },
    incomplete:[
      {id:'d1', p:'pink',   t:'Send revised proposal to client', from:'left over from Mon', decision:'mig'},
      {id:'d2', p:'purple', t:'Reply to recruiter email',        from:'left over from Mon', decision:'sch', dlabel:'Thu, Jun 11'},
      {id:'d3', p:'yellow', t:'Outline blog post draft',         from:'left over from Mon', decision:null},
      {id:'d4', p:'green',  t:'Pick up dry cleaning',            from:'left over from Mon', decision:'can'},
      {id:'d5', p:'green',  t:'Water the desk plant',            from:'left over from Mon', decision:null},
    ],
    recurrents:[
      {p:'yellow', t:'Morning standup notes', when:'morning'},
      {p:'green',  t:'Take vitamins',          when:'morning'},
      {p:'pink',   t:'Inbox zero sweep',       when:'evening'},
    ],
    pool:[
      {id:'dp1', p:'pink',   t:'Prep Thursday demo deck', from:'this week', decision:'inc'},
      {id:'dp2', p:'yellow', t:'Book 1:1 with manager',   from:'this week', decision:null},
      {id:'dp3', p:'green',  t:'Schedule car service',    from:'this week', decision:null},
    ],
  },

  weekly: {
    tabIcon:'week', tabLabel:'Weekly',
    closeLabel:'Last week', openLabel:'This week',
    closingPeriod:'Week 22 · Jun 1–7', openingPeriod:'Week 23 · Jun 8–14',
    closeNoun:'Week 22', destTitle:"This week's task list", destWhen:'Week 23',
    col3:{ title:'Monthly log', sub:'not yet assigned to a week', icon:'cal',
           foot:'Optional · pull in what fits this week' },
    incomplete:[
      {id:'w1', p:'pink',   t:'Finalize Q2 budget spreadsheet', from:'from Week 22', decision:'mig'},
      {id:'w2', p:'purple', t:'Email accountant about VAT',     from:'from Week 22', decision:'sch', dlabel:'Tue, Jun 9'},
      {id:'w3', p:'yellow', t:'Review contractor proposal',     from:'from Week 22', decision:null},
      {id:'w4', p:'green',  t:'Replace kitchen water filter',   from:'from Week 22', decision:'can'},
      {id:'w5', p:'pink',   t:'Draft investor update v2',       from:'from Week 22', decision:'mig'},
      {id:'w6', p:'green',  t:'Book dentist appointment',       from:'from Week 22', decision:null},
    ],
    recurrents:[
      {p:'pink',   t:'Weekly review & plan ahead', when:'Sun'},
      {p:'purple', t:'Pay outstanding invoices',   when:'Fri'},
      {p:'yellow', t:'Submit weekly timesheet',    when:'Fri'},
      {p:'green',  t:'Grocery run + meal prep',    when:'Sat'},
    ],
    pool:[
      {id:'wp1', p:'pink',   t:'Plan Q3 OKRs', from:'June log', decision:'inc'},
      {id:'wp2', p:'yellow', t:'Renew gym membership', from:'June log', decision:null},
      {id:'wp3', p:'green',  t:'Sort garage + donate run', from:'June log', decision:null},
    ],
  },

  monthly: {
    tabIcon:'cal', tabLabel:'Monthly',
    closeLabel:'Last month', openLabel:'This month',
    closingPeriod:'May 2026', openingPeriod:'June 2026',
    closeNoun:'May', destTitle:"This month's task list", destWhen:'June',
    col3:{ title:'Future Log', sub:'scheduled for June', icon:'layers',
           foot:'Optional · pull in what lands this month' },
    incomplete:[
      {id:'m1', p:'pink',   t:'File quarterly taxes',        from:'from May', decision:'mig'},
      {id:'m2', p:'purple', t:'Negotiate insurance renewal', from:'from May', decision:'sch', dlabel:'Jun 18'},
      {id:'m3', p:'yellow', t:'Deep-clean & declutter study', from:'from May', decision:null},
      {id:'m4', p:'green',  t:'Plan summer trip itinerary',  from:'from May', decision:null},
    ],
    recurrents:[
      {p:'pink',   t:'Rent payment',          when:'1st'},
      {p:'purple', t:'Credit-card due',       when:'15th'},
      {p:'yellow', t:'Back up photos & files', when:'2nd Mon'},
      {p:'green',  t:'Month-end budget review', when:'last day'},
    ],
    pool:[
      {id:'mp1', p:'green',  t:"Mom's birthday — gift & call", from:'Jun 24', decision:'inc'},
      {id:'mp2', p:'yellow', t:'Annual dental check-up',       from:'Jun 9',  decision:null},
    ],
  },
};

/* ===================== RENDER HELPERS ===================== */
function incBadge(m){
  if(m.decision==='mig') return `<span class="badge mig">${ICON.forward} Migrated</span>`;
  if(m.decision==='can') return `<span class="badge can">${ICON.x} Cancelled</span>`;
  if(m.decision==='sch') return `<span class="badge sch">${ICON.cal} Scheduled · ${m.dlabel||'pick a date'}</span>`;
  return '';
}
function incTask(m){
  if(m.decision){
    return `<div class="stask decided ${m.decision==='can'?'cancelled':''}">
      <div class="st-top"><span class="pdot p-${m.p}"></span>
        <span class="st-t"><div class="st-title">${m.t}</div><div class="st-from">${m.from}</div></span></div>
      ${incBadge(m)}<span class="undo" data-undo="${m.id}">change</span>
    </div>`;
  }
  return `<div class="stask">
    <div class="st-top"><span class="pdot p-${m.p}"></span>
      <span class="st-t"><div class="st-title">${m.t}</div><div class="st-from">${m.from}</div></span></div>
    <div class="st-acts">
      <button class="sbtn mig" data-act="mig" data-id="${m.id}">${ICON.forward} Migrate</button>
      <button class="sbtn sch" data-act="sch" data-id="${m.id}">${ICON.cal} Schedule</button>
      <button class="sbtn can" data-act="can" data-id="${m.id}">${ICON.x} Cancel</button>
    </div>
  </div>`;
}
function recTask(r){
  return `<div class="rtask"><span class="pdot p-${r.p}"></span>
    <span class="rt-t">${r.t}</span>
    <span class="badge auto">${ICON.repeat} auto · ${r.when}</span></div>`;
}
function poolTask(m){
  if(m.decision==='inc') return `<div class="stask decided">
    <div class="st-top"><span class="pdot p-${m.p}"></span>
      <span class="st-t"><div class="st-title">${m.t}</div><div class="st-from">${m.from}</div></span></div>
    <span class="badge inc">${ICON.plus} Included</span><span class="undo" data-undo="${m.id}">remove</span></div>`;
  if(m.decision==='sch') return `<div class="stask decided">
    <div class="st-top"><span class="pdot p-${m.p}"></span>
      <span class="st-t"><div class="st-title">${m.t}</div><div class="st-from">${m.from}</div></span></div>
    <span class="badge sch">${ICON.cal} Scheduled · ${m.dlabel||'later'}</span><span class="undo" data-undo="${m.id}">remove</span></div>`;
  return `<div class="stask">
    <div class="st-top"><span class="pdot p-${m.p}"></span>
      <span class="st-t"><div class="st-title">${m.t}</div><div class="st-from">${m.from}</div></span></div>
    <div class="st-acts">
      <button class="sbtn inc" data-act="inc" data-id="${m.id}">${ICON.plus} Include</button>
      <button class="sbtn sch" data-act="psch" data-id="${m.id}">${ICON.cal} Schedule</button>
    </div></div>`;
}

/* ===================== MAIN RENDER ===================== */
let activeTab = 'weekly';

function metrics(d){
  const total = d.incomplete.length;
  const resolved = d.incomplete.filter(m=>m.decision).length;
  const pending = total - resolved;
  return { total, resolved, pending, pct: Math.round((resolved/total)*100) };
}

function buildMain(){
  const d = DATA[activeTab];
  const mt = metrics(d);
  const ready = mt.pending===0;

  // destination chips
  const recChips = d.recurrents.map(r=>
    `<span class="chip rec"><span class="pdot p-${r.p}"></span><span class="ch-t">${r.t}</span><span class="ch-tag">rec.</span></span>`).join('');
  const migList = [
    ...d.incomplete.filter(m=>m.decision==='mig').map(m=>({p:m.p,t:m.t,tag:'migrated'})),
    ...d.pool.filter(m=>m.decision==='inc').map(m=>({p:m.p,t:m.t,tag:'included'})),
  ];
  const migChips = migList.map(m=>
    `<span class="chip mig"><span class="pdot p-${m.p}"></span><span class="ch-t">${m.t}</span><span class="ch-tag">${m.tag}</span></span>`).join('')
    + `<span class="chip drop">${ICON.plus} drag tasks here</span>`;

  const tabs = ['daily','weekly','monthly'].map(k=>{
    const t = DATA[k];
    return `<div class="tab ${k===activeTab?'active':''}" data-tab="${k}">
      ${ICON[t.tabIcon].replace('<svg','<svg class="tic"')}${t.tabLabel}</div>`;
  }).join('');

  return `
  <!-- ===== HEADER CARD ===== -->
  <section class="rhead">
    <span class="rtag">Header</span><span class="pin">1</span>
    <div class="rh-top">
      <div class="ttl">
        <h1><span class="glyph">${ICON.forward}</span>Migration Ritual</h1>
        <div class="sub">Close one cycle before you open the next — every unfinished task needs an explicit decision.</div>
      </div>
      <div class="spacer"></div>
      <div class="tabs" id="tabs" style="position:relative">
        <span class="pin lft" style="top:-13px;left:-13px">2</span>
        ${tabs}
      </div>
    </div>

    <div class="period">
      <div class="per-card close">
        <span class="pl">Closing</span><span class="pv">${d.closingPeriod}</span>
      </div>
      <span class="per-arrow">${ICON.arrow}</span>
      <div class="per-card">
        <span class="pl">Opening</span><span class="pv">${d.openingPeriod}</span>
      </div>
      <span class="spacer"></span>
      <span class="per-status ${ready?'ready':'pending'}" id="statusPill">
        ${ready ? `${ICON.check} All decisions made` : `${mt.pending} decision${mt.pending>1?'s':''} pending`}
      </span>
    </div>

    <div class="prog ${ready?'done':''}" id="progWrap">
      <div class="pbar"><i id="progFill" style="width:${mt.pct}%"></i></div>
      <span class="pnum" id="progNum">${mt.resolved} of ${mt.total} tasks resolved</span>
    </div>
  </section>

  <!-- ===== SOURCES GRID ===== -->
  <div class="sources">
    <!-- COLUMN 1 — incomplete -->
    <section class="scol" style="position:relative">
      <span class="pin">3</span>
      <div class="scol-h">
        <span class="icb">${ICON.inbox}</span>
        <span class="sh-t">Incomplete${activeTab==='daily'?' — yesterday':activeTab==='weekly'?' — last week':' — last month'}<small>requires a decision</small></span>
        <span class="sh-c" id="col1Count">${mt.pending} left</span>
      </div>
      <div class="scol-body" id="col1Body">${d.incomplete.map(incTask).join('')}</div>
      <div class="scol-foot">${ICON.lock} Each task needs an explicit decision to close the cycle</div>
    </section>

    <!-- COLUMN 2 — recurrents -->
    <section class="scol recurrents" style="position:relative">
      <span class="pin">4</span>
      <div class="scol-h">
        <span class="icb">${ICON.repeat}</span>
        <span class="sh-t">Recurrents<small>auto-included</small></span>
        <span class="sh-c">${d.recurrents.length} auto</span>
      </div>
      <div class="scol-body">${d.recurrents.map(recTask).join('')}</div>
      <div class="scol-foot">${ICON.check} Auto-injected · no action needed · doesn't block close</div>
    </section>

    <!-- COLUMN 3 — pool -->
    <section class="scol" style="position:relative">
      <span class="pin">5</span>
      <div class="scol-h">
        <span class="icb">${ICON[d.col3.icon]}</span>
        <span class="sh-t">${d.col3.title}<small>${d.col3.sub}</small></span>
        <span class="sh-c">optional</span>
      </div>
      <div class="scol-body" id="col3Body">${d.pool.map(poolTask).join('')}</div>
      <div class="scol-foot">${ICON.plus} ${d.col3.foot}</div>
    </section>
  </div>

  <!-- ===== FLOW INDICATOR ===== -->
  <div class="flow" style="position:relative">
    <span class="pin lft" style="left:-2px">6</span>
    <span class="fline"></span>
    <span class="flab">${ICON.down} move tasks into the destination period</span>
    <span class="fline"></span>
  </div>

  <!-- ===== DESTINATION ZONE ===== -->
  <section class="dest" style="position:relative">
    <span class="pin">7</span>
    <div class="dest-h">
      <span class="dh-ic">${ICON.arrow}</span>
      <span class="dh-t">${d.destTitle}<small>${d.destWhen} · receives migrated + recurrent tasks</small></span>
      <span class="spacer"></span>
      <span class="dh-count" id="destCount"><b>${d.recurrents.length}</b> rec. + <b>${migList.length}</b> migrated</span>
    </div>
    <div class="dest-groups">
      <div class="dgrp">
        <div class="dg-lab">Recurrent — auto, dashed</div>
        <div class="chips">${recChips}</div>
      </div>
      <div class="dgrp">
        <div class="dg-lab">Migrated &amp; included — solid</div>
        <div class="chips" id="migChips">${migChips}</div>
      </div>
    </div>
  </section>

  <!-- ===== FOOTER ===== -->
  <section class="region footbar">
    <span class="rtag">Footer</span><span class="pin">8</span>
    <button class="ghost">${ICON.save} Save draft</button>
    <span class="spacer"></span>
    <span class="msg ${ready?'ok':'warn'}" id="footMsg">
      ${ready
        ? `${ICON.check} Ready to close ${d.closeNoun}`
        : `${ICON.lock} ${d.closeNoun} only closes when all incomplete tasks are resolved`}
    </span>
    <span class="spacer"></span>
    <button class="ghost ${ready?'green':''}" id="closeBtn" ${ready?'':'disabled'}>
      ${ready?ICON.unlock:ICON.lock} Close ${d.closeNoun} ${ICON.arrow}
    </button>
  </section>`;
}

function render(){ document.getElementById('main').innerHTML = buildMain(); wire(); }

/* ===================== INTERACTIVITY ===================== */
function wire(){
  // incomplete decisions
  document.querySelectorAll('#col1Body .sbtn').forEach(b=>b.addEventListener('click',()=>{
    const d = DATA[activeTab];
    const m = d.incomplete.find(x=>x.id===b.dataset.id);
    const act = b.dataset.act;
    m.decision = act;
    if(act==='sch') m.dlabel = sampleDate();
    render();
  }));
  // pool include / schedule
  document.querySelectorAll('#col3Body .sbtn').forEach(b=>b.addEventListener('click',()=>{
    const d = DATA[activeTab];
    const m = d.pool.find(x=>x.id===b.dataset.id);
    m.decision = b.dataset.act==='inc' ? 'inc' : 'sch';
    if(m.decision==='sch') m.dlabel = sampleDate();
    render();
  }));
  // undo / remove
  document.querySelectorAll('.undo').forEach(u=>u.addEventListener('click',()=>{
    const d = DATA[activeTab]; const id = u.dataset.undo;
    const m = d.incomplete.find(x=>x.id===id) || d.pool.find(x=>x.id===id);
    m.decision = null; render();
  }));
  // tabs
  document.querySelectorAll('#tabs .tab').forEach(t=>t.addEventListener('click',()=>{
    activeTab = t.dataset.tab; render();
  }));
}
function sampleDate(){
  const opts = ['Jun 12','Jun 18','Jul 2','next Mon','Jul 14'];
  return opts[Math.floor(Math.random()*opts.length)];
}

/* ===================== LEGEND ===================== */
const LEGEND = [
  ['Header card','Title, the <b>Daily / Weekly / Monthly</b> tab switcher, and the <b>Closing → Opening</b> hand-off. The progress bar fills as decisions are made and turns <b>green</b> when every incomplete task is resolved; the inline status mirrors it.'],
  ['Variant tabs','Pick the cycle being closed. Each variant changes the periods, the recurrents that auto-inject, and the third "pool" source — <b>Weekly</b> is shown as the default active state.'],
  ['Column 1 · Incomplete','Unfinished tasks from the previous period. Each <b>must</b> get one decision — <b>Migrate</b> (carry forward), <b>Schedule</b> (a future date), or <b>Cancel</b>. Decided rows collapse to a colored badge with a "change" to reopen. These are the only tasks that gate the close.'],
  ['Column 2 · Recurrents','Recurring tasks for the new period. <b>Auto-injected</b> — already in the destination, no buttons, and they never block the close.'],
  ['Column 3 · Pool','Optional tasks from the broader log (monthly log / weekly log / future log) you can pull in with <b>Include</b> or park with <b>Schedule</b>. Optional — does not affect the progress count.'],
  ['Flow indicator','A visual separator that reads sources → destination, reinforcing that decisions move tasks <b>down</b> into the new period.'],
  ['Destination zone','A dashed receive area showing what the new period will hold, grouped by origin: <b>recurrent</b> chips (dashed, "rec.") and <b>migrated / included</b> chips (solid). A drop placeholder and a live <b>rec. + migrated</b> counter complete it.'],
  ['Footer','<b>Save draft</b> to step away, a center message that switches from a lock-warning to a green "ready" line, and the <b>Close</b> button — visually <b>disabled</b> until every incomplete task has a decision, then it activates.'],
];
document.getElementById('legendBody').innerHTML = LEGEND.map((l,i)=>`
  <div class="lg"><span class="n">${i+1}</span><span class="t"><b>${l[0]}.</b> ${l[1]}</span></div>`).join('');

/* ===================== ANNOTATIONS TOGGLE ===================== */
const annoT = document.getElementById('annoToggle');
annoT.addEventListener('click', ()=>{
  annoT.classList.toggle('on');
  document.body.classList.toggle('annotated', annoT.classList.contains('on'));
});
document.getElementById('legendX').addEventListener('click', ()=>{
  annoT.classList.remove('on'); document.body.classList.remove('annotated');
});

/* ===================== BOOT ===================== */
render();
