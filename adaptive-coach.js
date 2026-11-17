/* The Vigor Life: read-only, privacy-first coaching layer.
   Derives suggestions from the existing personal tracker. No AI calls,
   no new cloud writes, no changes to established workout/habit data. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 const shiftDate=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return iso(x)};
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dates=(end,n)=>Array.from({length:n},(_,i)=>shiftDate(end,i-(n-1)));
 const recent=(data,end,n=7)=>dates(end,n).map(day=>({day,entry:data.dailyCheckins?.[day],mins:data.discipline?.minimums?.[day]||{}}));
 const countDone=(entry,mins)=>entry?.habits?.reduce((sum,done,i)=>sum+(done||mins?.[i]?1:0),0)||0;
 function summary(data,day){
   const labels=Array.isArray(data.habitLabels)?data.habitLabels:[];
   const days=recent(data,day);
   const active=days.filter(x=>x.entry?.saved||countDone(x.entry,x.mins)>0);
   const total=active.reduce((s,x)=>s+countDone(x.entry,x.mins),0);
   const possible=active.length*labels.length;
   const today=days[days.length-1];
   const yesterday=days[days.length-2];
   const missedYesterday=labels.length>0&&!!yesterday?.entry?.saved&&countDone(yesterday.entry,yesterday.mins)===0;
   const latest=Array.isArray(data.measurements)?data.measurements.filter(x=>Number.isFinite(Number(x.weight))&&Number(x.weight)>0).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]:null;
   return {labels,activeDays:active.length,done:total,possible,rate:possible?Math.round(total/possible*100):null,
     todayDone:countDone(today?.entry,today?.mins),missedYesterday,weight:latest?Number(latest.weight):null};
 }
 function habitIntelligence(data,day){
   const labels=Array.isArray(data.habitLabels)?data.habitLabels:[];
   const last=recent(data,day,8);
   const rest=data.discipline?.restDays||{};
   const recorded=last.filter(x=>x.entry?.saved&&!rest[x.day]);
   const perHabit=labels.map((name,i)=>{
     const full=recorded.filter(x=>!!x.entry?.habits?.[i]).length;
     const minimum=recorded.filter(x=>!x.entry?.habits?.[i]&&!!x.mins?.[i]).length;
     const opportunities=recorded.length;
     const rate=opportunities?Math.round(100*(full+minimum)/opportunities):null;
     return {name,index:i,full,minimum,opportunities,rate};
   });
   const todayLog=data.dailyCheckins?.[day]||{};
   const todayMin=data.discipline?.minimums?.[day]||{};
   const configured=Array.isArray(data.discipline?.big3)?data.discipline.big3:[];
   const priority=configured.filter(v=>typeof v==='string'&&v.startsWith('h:'))
     .map(v=>Number(v.slice(2))).filter(i=>Number.isInteger(i)&&i>=0&&i<labels.length);
   const available=perHabit.filter(h=>!todayLog.habits?.[h.index]&&!todayMin[h.index]);
   const chosen=available.find(h=>priority.includes(h.index))||
     [...available].sort((a,b)=>(a.rate??101)-(b.rate??101)||a.index-b.index)[0]||null;
   const config=chosen?data.discipline?.settings?.[chosen.index]||{}:{};
   const minimum=typeof config.minimum==='string'&&config.minimum.trim()?config.minimum.trim():'Do a two-minute or smaller version';
   const cue=typeof config.cue==='string'&&config.cue.trim()?config.cue.trim():'After something you already do each day';
   const totalFull=perHabit.reduce((n,h)=>n+h.full,0);
   const totalMinimum=perHabit.reduce((n,h)=>n+h.minimum,0);
   const possible=labels.length*recorded.length;
   const opportunities=possible?Math.round(100*(totalFull+totalMinimum)/possible):null;
   const prior=shiftDate(day,-1);
   const priorEntry=data.dailyCheckins?.[prior],priorMin=data.discipline?.minimums?.[prior]||{};
   const missed=!!priorEntry?.saved&&!rest[prior]&&labels.some((_,i)=>!priorEntry.habits?.[i]&&!priorMin[i]);
   return {perHabit,chosen,minimum,cue,recordedDays:recorded.length,totalFull,totalMinimum,possible,
     rate:opportunities,missedYesterday:missed,allDone:labels.length>0&&!available.length};
 }

 function habitJourney(data,day,index){
   const labels=Array.isArray(data.habitLabels)?data.habitLabels:[];
   if(!Number.isInteger(index)||index<0||index>=labels.length)return null;
   const settings=data.discipline?.settings?.[index]||{};
   const configured=['cue','minimum','identity'].every(key=>typeof settings[key]==='string'&&settings[key].trim().length>0);
   const recorded=recent(data,day,16).filter(x=>x.entry?.saved&&!data.discipline?.restDays?.[x.day]);
   const done=recorded.filter(x=>x.entry?.habits?.[index]||x.mins?.[index]);
   const full=recorded.filter(x=>x.entry?.habits?.[index]).length;
   const minimums=done.length-full;
   const lastEight=recorded.slice(-8);
   const lastEightDone=lastEight.filter(x=>x.entry?.habits?.[index]||x.mins?.[index]).length;
   const rate=recorded.length?Math.round(100*done.length/recorded.length):null;
   let phase='setup',headline='Make the habit easy to start';
   if(configured){
     if(recorded.length<3){phase='practice';headline='Practice your cue and minimum';}
     else if(recorded.length<8){phase='review';headline='Review what helped you show up';}
     else if(lastEightDone>=6){phase='strengthen';headline='Protect what is working';}
     else {phase='adjust';headline='Make this habit easier again';}
   }
   const steps=[
     {label:'Choose',complete:true},
     {label:'Make it easy',complete:configured},
     {label:'Practice',complete:configured&&recorded.length>=3},
     {label:'Review',complete:configured&&recorded.length>=8},
     {label:'Strengthen',complete:configured&&recorded.length>=8&&lastEightDone>=6}
   ];
   const suggestions={
     setup:'Choose a reliable cue, a two-minute-or-less minimum and an identity statement. This uses your existing habit setup.',
     practice:'Try the smallest version when your cue happens. A minimum counts as showing up.',
     review:'Look at your recorded days. Keep the cue that works, and simplify any obstacle before expanding the goal.',
     adjust:'A difficult period is useful feedback. Reduce friction, prepare in advance, or pick a more reliable cue.',
     strengthen:'Keep the current habit sustainable before adding a new one. Consistency is more valuable than rushing.'
   };
   return {index,name:labels[index],phase,headline,configured,steps,suggestion:suggestions[phase],
      recordedDays:recorded.length,followed:done.length,full,minimums,rate,
      cue:settings.cue||'',minimum:settings.minimum||'',identity:settings.identity||''};
 }
 function shiftType(data,day){
   if(data.cycleLength===7)return 'Flexible daily routine';
   if(!/^\d{4}-\d{2}-\d{2}$/.test(data.anchor||''))return 'Flexible daily routine';
   const difference=Math.round((Date.parse(day+'T12:00:00Z')-Date.parse(data.anchor+'T12:00:00Z'))/86400000);
   const i=((difference%8)+8)%8;
   return i<2?'Day shift':i<4?'Night shift':i===4?'Recovery day':'Day off';
 }
 function suggestedWorkout(data,shift){
   const activities=Array.isArray(data.activities)?data.activities:[];
   const available=activities.filter(a=>a&&a.name&&!/fast|weigh|measurement/i.test(a.name));
   const pattern=shift==='Recovery day'?/mobil|recovery|stretch|walk/i:shift==='Day off'?/strength|full.body|cardio|zone/i:/mobil|walk|zone|recovery/i;
   return available.find(a=>pattern.test(a.name))?.name||available[0]?.name||null;
 }
 function coaching(data,day){
   const s=summary(data,day),daily=data.dailyCheckins?.[day]||{},habits=habitIntelligence(data,day);
   const energy=String(daily.energy??'').trim().toLowerCase(),sleep=String(daily.sleep??'').trim().toLowerCase();
   const lowerEnergy=['low','very low','poor','tired','exhausted','1','2'].includes(energy)||['poor','very poor','low','1','2'].includes(sleep);
   const shift=shiftType(data,day),workout=suggestedWorkout(data,shift);
   const recorded=data.dailyCheckins?.[day]||{},minimums=data.discipline?.minimums?.[day]||{};
   const nextHabit=habits.chosen?.name||null;
   const cues={
      'Day shift':'Keep your plan small around work. Anchor a habit to waking or getting home.',
      'Night shift':'Protect sleep before and after your shift; use after-waking cues, not fixed morning times.',
      'Recovery day':'After night shifts, focus on sleep, meals and gentle movement before intensity.',
      'Day off':'Use flexible time for a planned session and preparing for your next workday.',
      'Flexible daily routine':'Fit your actions around an existing part of your day.'
   };
   let lead='Start with one meaningful habit today. Consistency grows through repetition.';
   let reason='A small action is easier to repeat than a perfect plan.';
   if(!habits.recordedDays){lead='Begin with the smallest version of one important habit.';reason='No recent, non-rest check-ins are available for a meaningful habit trend.';}
   else if(habits.missedYesterday){lead='Return to one missed habit today. A minimum effort counts as returning.';reason='At least one habit was missed in yesterday’s recorded check-in. No catch-up required.';}
   else if(lowerEnergy){lead='Choose a lighter activity and simple habits. Protect recovery today.';reason='Your recorded energy or sleep suggests a lighter approach may be helpful.';}
   else if(shift==='Recovery day'){lead='Let recovery lead today. Your minimum habits can still fit around rest.';reason='Your rotating schedule places today after your night shifts.';}
   else if(habits.rate!==null&&habits.rate<50){lead='Make one meaningful habit easier to repeat today.';reason='Fewer than half of habit opportunities on recent recorded days were completed.';}
   else if(habits.allDone){lead='You followed through on every listed habit today. Celebrate the effort.';reason='Today’s full and minimum habit commitments have all been recorded.';}
   else if(s.todayDone>0){lead='You have already started today. Choose one more useful action.';reason='Your check-in shows progress today.';}
   else if(s.rate!==null&&s.rate>=80){lead='Your recent consistency is strong. Follow your plan and protect recovery.';reason='Most habits on recently logged days were completed.';}
   return {...s,lead,reason,shift,shiftAdvice:cues[shift],workout,nextHabit,habits};
 }
 function workoutReview(data,day){
   const activities=Array.isArray(data.activities)?data.activities.filter(x=>x&&x.id&&x.name&&!/fast|weigh|measurement/i.test(x.name)):[];
   const length=data.cycleLength===7?7:8;
   const anchor=typeof data.anchor==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(data.anchor)?data.anchor:day;
   const delta=Math.round((Date.parse(day+'T12:00:00Z')-Date.parse(anchor+'T12:00:00Z'))/86400000);
   const begin=shiftDate(anchor,Math.floor(delta/length)*length);
   const end=shiftDate(begin,length-1);
   const prevBegin=shiftDate(begin,-length),prevEnd=shiftDate(begin,-1);
   const completions=Array.isArray(data.completions)?data.completions:[];
   const minimums=Array.isArray(data.discipline?.workoutMinimums)?data.discipline.workoutMinimums:[];
   const count=(id,a,b)=>completions.filter(x=>x.activityId===id&&x.date>=a&&x.date<=b&&x.date<=day).length;
   const todayIndex=Math.max(0,Math.min(length-1,delta-Math.floor(delta/length)*length));
   const remaining=length-1-todayIndex;
   const items=activities.map(a=>{
     const target=Number.isFinite(Number(a.target))?Math.max(1,Math.round(Number(a.target))):1;
     const current=count(a.id,begin,end),previous=count(a.id,prevBegin,prevEnd);
     const effort=minimums.filter(x=>x.activityId===a.id&&x.date>=begin&&x.date<=day).length;
     return {id:a.id,name:a.name,target,current,previous,effort,remaining:Math.max(0,target-current)};
   });
   const completed=items.reduce((n,a)=>n+a.current,0),target=items.reduce((n,a)=>n+a.target,0);
   const previous=items.reduce((n,a)=>n+a.previous,0);
   const minimumEfforts=items.reduce((n,a)=>n+a.effort,0);
   let message='Start with one manageable workout this rotation.';
   if(!items.length)message='Add a workout in your existing workout checklist to begin.';
   else if(completed>=target)message='You reached your planned session count. Review recovery before adding more.';
   else if(remaining===0)message='The rotation ends today. Record what you completed; adjust the next plan if needed.';
   else if(completed>0)message='You have workouts recorded. Choose an unfinished target that fits your energy and schedule.';
   else if(minimumEfforts>0)message='Your minimum-effort sessions count as showing up. Build from there when ready.';
   const next=items.find(x=>x.remaining>0&&!/fast/i.test(x.name))||null;
   return {begin,end,length,daysRemaining:remaining,completed,target,previous,minimumEfforts,items,next,message};
 }
 function progressionGuidance(data,day){
   const current=workoutReview(data,day);
   const priorEnd=shiftDate(current.begin,-1);
   const prior=workoutReview(data,priorEnd);
   const before=workoutReview(data,shiftDate(prior.begin,-1));
   const shift=shiftType(data,day);
   const log=data.dailyCheckins?.[day]||{};
   const energy=String(log.energy??'').trim().toLowerCase();
   const sleep=String(log.sleep??'').trim().toLowerCase();
   const tired=['low','very low','poor','tired','exhausted','1','2'].includes(energy)||['poor','very poor','low','1','2'].includes(sleep);
   const recentMinimums=current.minimumEfforts;
   const priorComplete=prior.target>0&&prior.completed>=prior.target;
   const beforeComplete=before.target>0&&before.completed>=before.target;
   const completedAtLeastTwo=priorComplete&&beforeComplete;
   const outcomes={
     recover:{label:'Recovery first',detail:'Keep movement optional and gentle. Prioritize adequate sleep and your existing recovery habits. No extra training is recommended today.'},
     rebuild:{label:'Build consistency',detail:'Stay with the current workout targets. Choose one manageable session or minimum effort before considering more volume.'},
     maintain:{label:'Maintain your plan',detail:'Continue your existing workout targets and check how they feel. Session counts alone cannot tell us whether intensity should increase.'},
     review:{label:'Ready to review progression',detail:'You met your planned session counts in two completed rotations. If training felt manageable and recovery is good, consider a small, optional change to one exercise; track reps, load or effort first.'}
   };
   let status='maintain',basis='Current and prior workout records';
   if(shift==='Recovery day'||tired){status='recover';basis=tired?'Your recorded energy or sleep':'Your recovery day after night shifts';}
   else if(!prior.completed&&!before.completed){status='rebuild';basis='No completed workouts in the previous two rotations';}
   else if(!priorComplete||recentMinimums>0){status='maintain';basis='Your recent completed sessions and minimum-effort records';}
   else if(completedAtLeastTwo){status='review';basis='Two fully completed prior rotations';}
   const selected=outcomes[status];
   return {...selected,status,basis,priorCompleted:prior.completed,priorTarget:prior.target,
     beforeCompleted:before.completed,beforeTarget:before.target};
 }
 function roadmap(data,day){
   const s=summary(data,day),goal=data.bodyGoals||{},start=Number(goal.startWeight),target=Number(goal.goalWeight);
   const valid=Number.isFinite(start)&&Number.isFinite(target)&&start>target&&target>0;
   const progress=valid&&s.weight!==null?Math.max(0,Math.min(100,Math.round((start-s.weight)/(start-target)*100))):null;
   return {
     stages:[
      {day:30,title:'Build the habit foundation',detail:'Choose meaningful habits across the areas of life you want to improve; anchor them to existing routines.',actions:['Choose one keystone habit and its two-minute minimum.','Pair it with a cue such as after waking or after a meal.','Record full effort, minimum effort, or a rest day without guilt.']},
      {day:60,title:'Make consistency easier',detail:'Identify obstacles and improve your environment rather than relying on motivation alone.',actions:['Review which habits are hardest on recorded days.','Make one cue, minimum action, or preparation routine simpler.','Protect sleep, relationships, spiritual growth and physical activity in a realistic rhythm.']},
      {day:90,title:'Reflect and keep growing',detail:'Review what is becoming automatic and choose the next meaningful area of personal growth.',actions:['Celebrate consistency, recovery and non-fitness wins.','Retain habits that are sustainable and revise those that are not.','Choose one next identity-based habit or goal.']}
     ],progress,weight:s.weight,target:valid?target:null
   };
 }
 const style=document.createElement('style');
 style.textContent=`.vigor-coach{background:linear-gradient(125deg,var(--panel-alt),var(--panel));border:1px solid var(--border-strong);border-radius:18px;padding:16px;margin:12px 0;color:var(--text-primary)}.vigor-coach h2{margin:5px 0 9px;font-size:21px}.vigor-coach p{line-height:1.55;font-size:13px;margin:6px 0}.vigor-coach .vc-eyebrow{color:var(--accent-soft);font-size:10px;font-weight:800;letter-spacing:1.5px}.vigor-coach .vc-lead{font-size:16px;font-weight:750;color:var(--text-primary)}.vigor-coach .vc-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.vigor-coach .vc-actions .vc-nav{display:inline-flex;align-items:center;justify-content:center;min-height:43px;padding:8px 12px;border-radius:10px;background:var(--accent);color:var(--accent-contrast);font-weight:750;text-decoration:none;font-size:13px;border:0;cursor:pointer}.vigor-coach .vc-actions .vc-nav.alt{background:var(--panel-alt);border:1px solid var(--border-strong);color:var(--text-primary)}.vigor-coach .vc-stages{display:grid;gap:8px}.vigor-coach .vc-stage{border:1px solid var(--border);background:var(--panel-alt);border-radius:11px;padding:11px}.vigor-coach .vc-stage strong{color:var(--accent-soft)}.vigor-coach .vc-stage p{margin:5px 0 0}.vigor-coach .vc-stage ul{padding-left:20px;margin:9px 0 0;color:var(--text-primary);font-size:12px;line-height:1.65}.vigor-coach details summary{cursor:pointer;color:var(--accent-soft);font-size:13px;font-weight:700}.vigor-coach .vc-note{color:var(--muted);font-size:12px}.vigor-coach .vc-workout{border-top:1px solid var(--border);padding-top:12px;margin:14px 0}.vigor-coach .vc-workout h3{margin:0 0 7px;font-size:16px}.vigor-coach .vc-meter{height:8px;background:var(--border);border-radius:20px;overflow:hidden}.vigor-coach .vc-meter span{display:block;height:100%;background:var(--accent)}.vigor-coach .vc-workout-list>div{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--border);font-size:12px}.vigor-coach .vc-workout-list span{color:var(--muted)}.vigor-coach .vc-shift{border-left:3px solid var(--accent);padding:7px 10px;background:var(--panel-alt);border-radius:5px}.vigor-coach .vc-next{margin:5px 0;font-size:13px}.vigor-coach .vc-progression{margin:10px 0 14px;background:var(--panel-alt);border:1px solid var(--border-strong);border-radius:12px;padding:12px}.vigor-coach .vc-progression h3{margin:6px 0;font-size:16px}.vigor-coach .vc-habit-action{border:1px solid var(--border-strong);border-radius:12px;background:var(--panel-alt);padding:13px;margin:12px 0}.vigor-coach .vc-habit-action h3{margin:5px 0;font-size:18px}.vigor-coach .vc-habit-action p{margin:5px 0}.vigor-coach .vc-habit-history{margin:12px 0}.vigor-coach .vc-training-details{border-top:1px solid var(--border);margin-top:13px;padding-top:12px}.vigor-coach .vc-training-details>summary{font-size:14px}.vigor-coach .vc-journey{margin:13px 0;border:1px solid var(--border-strong);border-radius:12px;padding:12px;background:var(--panel-alt)}.vigor-coach .vc-journey-body{padding-top:12px}.vigor-coach .vc-journey-picker{font-size:12px;display:block}.vigor-coach .vc-journey-picker select{margin-top:7px;min-height:45px;width:100%;background:var(--input-bg);color:var(--text-primary);border:1px solid var(--border);border-radius:9px;font-size:16px}.vigor-coach .vc-journey-steps{display:flex;gap:5px;flex-wrap:wrap;margin:12px 0}.vigor-coach .vc-journey-steps span{font-size:11px;border:1px solid var(--border);padding:6px 8px;border-radius:20px;color:var(--muted)}.vigor-coach .vc-journey-steps .complete{color:var(--accent-soft);border-color:var(--border-strong)}.vigor-coach .vc-journey h3{margin:10px 0;font-size:17px}`;
 document.head.append(style);
 const root=document.createElement('section');root.className='vigor-coach';root.id='vigorCoach';root.setAttribute('aria-label','Your adaptive coach and 90-day roadmap');
 let selectedJourneyIndex=null;
 const target=$('big3Panel')||$('daily')||document.querySelector('main > .card');
 if(!target)return;
 target.after(root);
 function render(){
   const bridge=window.vigorCloudBridge;if(!bridge?.read){root.hidden=true;return}
   let data;try{data=bridge.read()}catch(e){root.hidden=true;return}
   if(!data||!Array.isArray(data.habitLabels)){root.hidden=true;return}
   root.hidden=false;
   const day=iso(new Date()),c=coaching(data,day),r=roadmap(data,day),w=workoutReview(data,day),p=progressionGuidance(data,day),h=c.habits;
   const comeback=h.missedYesterday||(h.rate!==null&&h.rate<50);
   const expanded=root.querySelector('.vc-roadmap')?.open||false;
   const workoutExpanded=root.querySelector('.vc-workout details')?.open||false;
   const journeyExpanded=root.querySelector('.vc-journey')?.open||false;
   const selectedIndex=selectedJourneyIndex!==null&&selectedJourneyIndex>=0&&selectedJourneyIndex<data.habitLabels.length?selectedJourneyIndex:(h.chosen?.index??0);
   const journey=habitJourney(data,day,selectedIndex);
   const trainingExpanded=root.querySelector('.vc-training-details')?.open||false;
   root.innerHTML=`<div class="vc-eyebrow">YOUR HABIT & LIFE COACH · BASED ON YOUR TRACKER</div>
    <h2>${comeback?'A fresh start today':'Your daily guidance'}</h2>
    <p class="vc-lead">${escape(c.lead)}</p>
    <p>${escape(c.reason)}</p><p class="vc-shift"><strong>${escape(c.shift)}:</strong> ${escape(c.shiftAdvice)}</p>
    ${h.chosen?'<div class="vc-habit-action"><div class="vc-eyebrow">YOUR NEXT SMALL WIN</div><h3>'+escape(h.chosen.name)+'</h3><p><strong>Minimum:</strong> '+escape(h.minimum)+'</p><p><strong>Cue:</strong> '+escape(h.cue)+'</p></div>':h.allDone?'<p class="vc-next">✓ All listed habits are recorded for today.</p>':''}

    <p class="vc-note">${h.rate===null?'No recorded habit trend yet':escape(h.rate+'% habits followed on '+h.recordedDays+' logged non-rest day(s)')} · ${h.totalFull} full completions · ${h.totalMinimum} minimum efforts. Unlogged and designated rest days are not counted as failures.</p>
    <details class="vc-journey" ${journeyExpanded?'open':''}>
      <summary>My Habit-Building Journey</summary>
      ${journey?`<div class="vc-journey-body">
        <label class="vc-journey-picker">Focus on a habit
        <select id="vcHabitChoice" aria-label="Habit to develop">
          ${data.habitLabels.map((label,i)=>'<option value="'+i+'"'+(i===selectedIndex?' selected':'')+'>'+escape(label)+'</option>').join('')}
        </select></label>
        <div class="vc-journey-steps">${journey.steps.map(x=>'<span class="'+(x.complete?'complete':'')+'">'+(x.complete?'✓ ':'○ ')+escape(x.label)+'</span>').join('')}</div>
        <h3>${escape(journey.headline)}</h3>
        <p>${escape(journey.suggestion)}</p>
        <p class="vc-note">${journey.recordedDays} recorded non-rest day(s) in the last 16 days · ${journey.full} full · ${journey.minimums} minimum · ${journey.rate===null?'No consistency rate yet':journey.rate+'% showed up'}. Unlogged days are not assumed failures.</p>
        ${journey.configured?'<p><strong>Cue:</strong> '+escape(journey.cue)+'</p><p><strong>Minimum:</strong> '+escape(journey.minimum)+'</p><p><strong>Identity:</strong> '+escape(journey.identity)+'</p>':''}
        <div class="vc-actions">
          <button type="button" class="vc-nav" data-vc-journey="setup">Set up / adjust habit</button>
          <button type="button" class="vc-nav alt" data-vc-journey="log">Record habit</button>
          <button type="button" class="vc-nav alt" data-vc-journey="review">Review progress</button>
        </div>
      </div>`:'<p>Add a habit through your existing habits editor to start.</p>'}
    </details>
    <details class="vc-habit-history"><summary>See habits needing support</summary><div class="vc-workout-list">${h.perHabit.map(x=>'<div><strong>'+escape(x.name)+'</strong><span>'+(x.rate===null?'Not enough data':x.rate+'% followed')+'</span></div>').join('')}</div></details>
    <div class="vc-actions"><button type="button" class="vc-nav" data-vc-target="daily">Log one habit</button><button type="button" class="vc-nav alt" data-vc-target="training">View workouts</button></div>
    <details class="vc-training-details" ${trainingExpanded?'open':''}><summary>Fitness & workout coaching</summary>
    <section class="vc-workout" aria-label="Your workout rotation review">
      <h3>Workout progress this rotation</h3>
      <p class="vc-lead">${w.completed} of ${w.target} planned sessions logged</p>
      <p>${escape(w.message)}</p>
      <div class="vc-meter" role="progressbar" aria-label="Workout sessions logged" aria-valuemin="0" aria-valuenow="${Math.min(w.target,w.completed)}" aria-valuemax="${Math.max(1,w.target)}"><span style="width:${w.target?Math.min(100,Math.round(w.completed/w.target*100)):0}%"></span></div>
      <p class="vc-note">${w.minimumEfforts} minimum-effort session(s) · ${w.daysRemaining} day(s) left in the ${w.length}-day rotation. Previous full rotation: ${w.previous} session(s).</p>
      ${w.next?'<p class="vc-next"><strong>Next planned option:</strong> '+escape(w.next.name)+' ('+w.next.current+'/'+w.next.target+' completed)</p>':''}
      <details ${workoutExpanded?'open':''}><summary>Review all workout targets</summary>
      <div class="vc-workout-list">${w.items.map(x=>'<div><strong>'+escape(x.name)+'</strong><span>'+x.current+'/'+x.target+' logged'+(x.effort?' · '+x.effort+' minimum':'')+'</span></div>').join('')}</div>
      <p class="vc-note">These are completed-session counts, not measurements of fitness gains. Targets never increase automatically.</p></details>
    </section>
    <div class="vc-progression" aria-label="Training progression guidance">
      <span class="vc-eyebrow">TRAINING GUIDANCE</span>
      <h3>${escape(p.label)}</h3>
      <p>${escape(p.detail)}</p>
      <p class="vc-note">Why: ${escape(p.basis)}. Previous rotations: ${p.priorCompleted}/${p.priorTarget} and ${p.beforeCompleted}/${p.beforeTarget} planned sessions. No workout targets have been changed.</p>
    </div>
    </details>
    <details class="vc-roadmap" ${expanded?'open':''}><summary>My 30 / 60 / 90-day transformation roadmap</summary>
    <div class="vc-stages">${r.stages.map(x=>`<div class="vc-stage"><strong>Day ${x.day}: ${escape(x.title)}</strong><p>${escape(x.detail)}</p><ul>${x.actions.map(a=>`<li>${escape(a)}</li>`).join('')}</ul></div>`).join('')}</div>
    <p class="vc-note">${r.progress===null?'Log your weight and set body goals to track weight progress.':escape('Weight goal progress: '+r.progress+'%'+(r.target!==null?' toward '+r.target+' lb':''))}. Your roadmap is flexible and has no required weight-loss deadline.</p>
    </details>`;

   const picker=root.querySelector('#vcHabitChoice');
   if(picker)picker.onchange=()=>{selectedJourneyIndex=Number(picker.value);render()};
   root.querySelectorAll('[data-vc-journey]').forEach(button=>button.onclick=()=>{
     const action=button.dataset.vcJourney;
     if(action==='setup'){
       document.querySelector('[data-panel="settings"]')?.click();
       const details=$('setupDetails');if(details)details.open=true;
       const selected=$('setupTopHabit');if(selected&&journey)selected.value=journey.name;
       if($('setupCue')&&journey)$('setupCue').value=journey.cue;
       if($('setupMinimum')&&journey)$('setupMinimum').value=journey.minimum;
       details?.scrollIntoView({behavior:'smooth',block:'start'});
     }else{
       document.querySelector('[data-panel="'+(action==='review'?'progress':'today')+'"]')?.click();
       const destination=action==='review'?$('disciplineReview'):$('daily');
       const parent=destination?.closest('details');if(parent)parent.open=true;
       destination?.scrollIntoView({behavior:'smooth',block:'start'});
     }
   });
   root.querySelectorAll('[data-vc-target]').forEach(button=>button.onclick=()=>{
     const id=button.dataset.vcTarget;
     document.querySelector('[data-panel="today"]')?.click();
     const destination=$(id);
     const parent=destination?.closest('details');if(parent)parent.open=true;
     destination?.scrollIntoView({behavior:'smooth',block:'start'});
   });
 }
 render();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
 window.addEventListener('vigor-sync-status',render);
 document.addEventListener('change',()=>queueMicrotask(render));
 // The original app saves via click handlers; recalculate after those handlers finish.
 document.addEventListener('click',()=>queueMicrotask(render));
 window.VigorCoaching={summary,habitIntelligence,habitJourney,coaching,roadmap,shiftType,suggestedWorkout,workoutReview,progressionGuidance,refresh:render};
})();
