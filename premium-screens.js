/* Premium Vigor Life Journey/Fitness screens: accessible presentations
   of existing logged data. Never modify Firebase records or workout goals. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const panel=$('panel-today');if(!panel||!window.VigorCoaching)return;
 const main=document.querySelector('main');if(!main)return;
 const journey=document.createElement('section');journey.className='vigor-screen';journey.id='vigorJourneyScreen';journey.setAttribute('aria-label','Habit Building Journey');
 const fitness=document.createElement('section');fitness.className='vigor-screen';fitness.id='vigorFitnessScreen';fitness.setAttribute('aria-label','Fitness and workout coaching');
 main.append(journey,fitness);
 let selectedHabit=0;
 function read(){try{return window.vigorCloudBridge?.read?.()}catch(e){return null}}
 function setRoute(route){document.querySelector('#vigorNav [data-vigor-route="'+route+'"]')?.click()}
 function expandAndScroll(id){
  const target=$(id);if(!target)return;
  const details=target.closest('details');if(details)details.open=true;
  target.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function navigateToSetup(name,config){
  setRoute('more');
  $('vigorMoreMenu')?.querySelector('[data-vigor-old="settings"]')?.click();
  const details=$('setupDetails');if(details)details.open=true;
  const list=$('setupTopHabit');if(list)list.value=name;
  const cue=$('setupCue');if(cue)cue.value=config.cue||'';
  const minimum=$('setupMinimum');if(minimum)minimum.value=config.minimum||'';
  details?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function renderJourney(data,day){
  const labels=Array.isArray(data.habitLabels)?data.habitLabels:[];
  const active=labels.map((name,i)=>({name,i})).filter(x=>!data.discipline?.settings?.[x.i]?.archivedAt);
  if(!active.some(x=>x.i===selectedHabit))selectedHabit=active[0]?.i??0;
  const h=active.length?window.VigorCoaching.habitJourney(data,day,selectedHabit):null;
  const stepDesc=['Choose a meaningful habit and why it matters','Attach a small action to a reliable cue','Repeat with minimum or full efforts','Learn from obstacles and recent check-ins','Protect your routine before adding more'];
  journey.innerHTML=`<div class="vigor-screen-header"><div class="vigor-eyebrow">A LIFE BUILT ON PURPOSE</div>
      <h2>Habit-Building Journey</h2><p>Choose, simplify, practice, reflect, and grow. Your journey is personal—not a race.</p></div>
      ${active.length?`<label class="vigor-habit-select">Habit you're building
       <select id="vigorJourneySelect" aria-label="Choose a habit to develop">${active.map(({name:x,i})=>'<option value="'+i+'"'+(i===selectedHabit?' selected':'')+'>'+escape(x)+'</option>').join('')}</select></label>`:'<div class="vigor-summary">Add or restore a habit in Journey to begin.</div>'}
      ${h?`<div class="vigor-steps">${h.steps.map((step,i)=>`<div class="vigor-step${step.complete?' complete':''}">
       <span class="vigor-step-index">${step.complete?'✓':i+1}</span>
       <div><strong>${escape(step.label)}</strong><small>${escape(stepDesc[i])}</small></div>
       <span class="vigor-step-state">${step.complete?'Done':'Next'}</span></div>`).join('')}</div>
       <div class="vigor-summary"><strong>${escape(h.headline)}</strong><p>${escape(h.suggestion)}</p>
       <div class="vigor-mini-progress"><span style="width:${Math.round(h.steps.filter(x=>x.complete).length/h.steps.length*100)}%"></span></div>
       <p>${h.steps.filter(x=>x.complete).length} of ${h.steps.length} journey steps · ${h.recordedDays} recorded days in the recent window</p>
       ${h.configured?'<p><strong>Cue:</strong> '+escape(h.cue)+' · <strong>Minimum:</strong> '+escape(h.minimum)+'</p>':''}</div>` :''}
      <div class="vigor-action-row"><button id="vigorJourneySetup" type="button">Make this habit easier</button>
      <button id="vigorJourneyLog" type="button" class="secondary">Log a small win</button>
      <button id="vigorJourneyGrowth" type="button" class="secondary">Review progress</button></div>
      <p class="vigor-detail-note">These stages respond to recorded check-ins, not a clinical measure of habit automaticity. Blank and designated rest days are not treated as failures.</p>`;
  journey.querySelector('#vigorJourneySelect')?.addEventListener('change',e=>{selectedHabit=Number(e.target.value)||0;render()});
  journey.querySelector('#vigorJourneySetup')?.addEventListener('click',()=>navigateToSetup(h?.name||labels[0]||'',h||{}));
  journey.querySelector('#vigorJourneyLog')?.addEventListener('click',()=>{setRoute('today');expandAndScroll('daily')});
  journey.querySelector('#vigorJourneyGrowth')?.addEventListener('click',()=>{setRoute('growth');expandAndScroll('disciplineReview')});
 }
 function renderFitness(data,day){
  const w=window.VigorCoaching.workoutReview(data,day),guide=window.VigorCoaching.progressionGuidance(data,day);
  const rate=w.target?Math.min(100,Math.round(w.completed/w.target*100)):0;
  fitness.innerHTML=`<div class="vigor-screen-header"><div class="vigor-eyebrow">BUILD STRENGTH · PROTECT CONSISTENCY</div>
      <h2>Fitness & Coaching</h2><p>Train with intention. Your workouts adapt around real-life schedules and recovery—not a perfect calendar.</p></div>
      <div class="vigor-summary"><strong>Workout rotation</strong><h2>${w.completed} of ${w.target} sessions</h2>
      <p>${escape(w.length+'-day schedule')} · ${w.daysRemaining} day(s) remaining · ${w.minimumEfforts} minimum-effort start(s)</p>
      <div class="vigor-mini-progress" role="progressbar" aria-label="Rotation workout completion" aria-valuemin="0" aria-valuemax="${Math.max(1,w.target)}" aria-valuenow="${Math.min(w.target,w.completed)}"><span style="width:${rate}%"></span></div></div>
      <div class="vigor-action-row"><button type="button" id="vigorFitnessOpen">Open workout checklist</button><button class="secondary" type="button" id="vigorFitnessHistory">See performance history</button></div>
      <h3>Planned workouts</h3>
      <div class="vigor-workout-list">${w.items.length?w.items.map(x=>'<div class="vigor-workout-row"><strong>'+escape(x.name)+'</strong><span>'+x.current+' / '+x.target+' logged</span></div>').join(''):'<p>No workouts have been configured yet.</p>'}</div>
      <div class="vigor-summary"><strong>Coach's note: ${escape(guide.label)}</strong><p>${escape(guide.detail)}</p>
      <p>${escape(guide.basis)}. Your training targets are not changed automatically.</p></div>
      <p class="vigor-detail-note">Session counts reflect completed logs, not an estimate of calories burned or fitness gains. Follow your own recovery needs and professional guidance where appropriate.</p>`;
  fitness.querySelector('#vigorFitnessOpen')?.addEventListener('click',()=>{setRoute('today');expandAndScroll('training')});
  fitness.querySelector('#vigorFitnessHistory')?.addEventListener('click',()=>{setRoute('growth');expandAndScroll('progressInsights')});
 }
 function render(){
  const data=read();if(!data)return;
  const day=today();
  renderJourney(data,day);renderFitness(data,day);
 }
 render();
 window.addEventListener('vigor-sync-status',render);
 window.addEventListener('vigor-local-changed',render);
 document.addEventListener('change',event=>{if(event.target?.closest?.('#vigorJourneyManager'))return;queueMicrotask(render)});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
 window.VigorPremiumScreens={refresh:render,selectHabit:index=>{if(Number.isInteger(index)&&index>=0)selectedHabit=index;render()}};
})();
