/* Premium Vigor Life Journey/Fitness screens: accessible presentations
   of existing logged data. Never modify Firebase records or workout goals. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const panel=$('panel-today');if(!panel||!window.VigorCoaching)return;
 const main=document.querySelector('main');if(!main)return;
 const journey=document.createElement('section');journey.className='vigor-screen';journey.id='vigorJourneyScreen';journey.setAttribute('aria-label','Habits');
 const fitness=document.createElement('section');fitness.className='vigor-screen';fitness.id='vigorFitnessScreen';fitness.setAttribute('aria-label','Fitness');
 main.append(journey,fitness);
 // Move the ORIGINAL collapsible sections, not their inner controls.
 // Otherwise empty "Zone 2 minutes" and "All workouts & session logs" shells
 // remain behind on Today. Retaining the elements also retains every event listener.
 const habitHistory=$('habitHistoryTools');
 const fitnessContent=document.createElement('div');
 fitnessContent.className='vigor-fitness-content';
 const zone2Movement=$('zone2');
 const training=$('training');
 const zoneSection=zone2Movement?.closest('details.compact-details');
 const trainingSection=training?.closest('details.compact-details');
 const routineMount=document.createElement('div');routineMount.id='fitnessRoutineEditor';
 const routineStatus=document.createElement('p');routineStatus.id='fitnessRoutineStatus';routineStatus.setAttribute('role','status');
 fitness.append(fitnessContent,routineMount,routineStatus);
 if(zoneSection){
   fitness.append(zoneSection);
   zoneSection.open=true;
 }else if(zone2Movement)fitness.append(zone2Movement);
 if(trainingSection){
   fitness.append(trainingSection);
   trainingSection.open=false;
 }else if(training)fitness.append(training);
 let selectedHabit=0;
 function read(){try{return window.vigorCloudBridge?.read?.()}catch(e){return null}}
 function setRoute(route){document.querySelector('#vigorNav [data-vigor-route="'+route+'"]')?.click()}
 function expandAndScroll(id){
  const target=$(id);if(!target)return;
  const reports=target.closest('#progressReports');if(reports)reports.open=true;
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
  journey.innerHTML=`<div class="vigor-screen-header"><h2>Habits</h2></div>
      ${active.length?`<label class="vigor-habit-select">Habit you're building
       <select id="vigorJourneySelect" aria-label="Choose a habit to develop">${active.map(({name:x,i})=>'<option value="'+i+'"'+(i===selectedHabit?' selected':'')+'>'+escape(x)+'</option>').join('')}</select></label>`:'<div class="vigor-summary">Add or restore a habit to begin.</div>'}
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
  if(habitHistory)journey.append(habitHistory);
  journey.querySelector('#vigorJourneySelect')?.addEventListener('change',e=>{selectedHabit=Number(e.target.value)||0;render()});
  journey.querySelector('#vigorJourneySetup')?.addEventListener('click',()=>navigateToSetup(h?.name||labels[0]||'',h||{}));
  journey.querySelector('#vigorJourneyLog')?.addEventListener('click',()=>{setRoute('today');expandAndScroll('vigorAllHabits')});
  journey.querySelector('#vigorJourneyGrowth')?.addEventListener('click',()=>{setRoute('growth');expandAndScroll('disciplineReview')});
 }
 function renderFitness(day){
  const schedule=window.vigorCloudBridge.getTrainingSchedule(day);
  const planned=schedule.some(entry=>entry.workouts.length||entry.minutes);
  const editor=$('trainingRoutineEditor');
  const editLabel=planned?'Edit workout plan':'Set up my workouts';
  fitnessContent.innerHTML=`<div class="vigor-screen-header"><h2>Fitness</h2></div>
    <section class="vigor-summary" aria-labelledby="fitnessPlanHeading">
      <div class="row"><h3 id="fitnessPlanHeading">My workout plan</h3>
      <button type="button" id="fitnessEditPlan" class="secondary">${editLabel}</button></div>
      ${planned?`<ul class="fitness-plan-list">${schedule.map(entry=>{
        const tasks=entry.workouts.map(([,label])=>escape(label));
        if(entry.minutes)tasks.push('Easy cardio (Zone 2) · '+entry.minutes+' min');
        return '<li'+(entry.date===day?' aria-current="date"':'')+'><strong>'+escape(entry.label)+
          (entry.date===day?' · Today':'')+'</strong>'+(tasks.length?'<ul><li>'+tasks.join('</li><li>')+'</li></ul>':'<span>Rest day</span>')+'</li>';
      }).join('')}</ul>`:'<p>Add workouts and the days you want to do them.</p>'}
    </section>`;
  $('fitnessEditPlan').onclick=()=>{
    if(!routineMount.contains(editor))routineMount.append(editor);
    if(!editor.open)editor.querySelector('summary').click();
    editor.scrollIntoView({block:'start',behavior:'smooth'});
  };
 }
 function render(){
  const data=read();if(!data)return;
  const day=today();
  renderJourney(data,day);renderFitness(day);
 }
 render();
 window.addEventListener('vigor-sync-status',render);
 window.addEventListener('vigor-local-changed',render);
 document.addEventListener('change',event=>{if(event.target?.closest?.('#vigorJourneyManager'))return;queueMicrotask(render)});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
 window.VigorPremiumScreens={refresh:render,selectHabit:index=>{if(Number.isInteger(index)&&index>=0)selectedHabit=index;render()}};
})();
