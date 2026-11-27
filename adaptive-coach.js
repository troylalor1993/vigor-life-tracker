/* The Vigor Life: read-only, privacy-first coaching layer.
   Derives suggestions from the existing personal tracker. No AI calls,
   no new cloud writes, no changes to established workout/habit data. */
(()=>{'use strict';
 const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 const shiftDate=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return iso(x)};
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
   const active=labels.map((_,i)=>i).filter(i=>!data.discipline?.settings?.[i]?.archivedAt);
   const last=recent(data,day,8);
   const rest=data.discipline?.restDays||{};
   const recorded=last.filter(x=>x.entry?.saved&&!rest[x.day]);
   const tracked=(index,date)=>{
     const config=data.discipline?.settings?.[index]||{},periods=config.archivePeriods||[];
     return (!config.archivedAt||date<config.archivedAt)&&
       !periods.some(p=>p&&date>=p.start&&(!p.end||date<p.end));
   };
   const perHabit=labels.map((name,i)=>({name,i})).filter(x=>active.includes(x.i)).map(({name,i})=>{
     const applicable=recorded.filter(x=>tracked(i,x.day));
     const full=applicable.filter(x=>!!x.entry?.habits?.[i]).length;
     const minimum=applicable.filter(x=>!x.entry?.habits?.[i]&&!!x.mins?.[i]).length;
     const opportunities=applicable.length;
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
   const possible=perHabit.reduce((sum,h)=>sum+h.opportunities,0);
   const opportunities=possible?Math.round(100*(totalFull+totalMinimum)/possible):null;
   const prior=shiftDate(day,-1);
   const priorEntry=data.dailyCheckins?.[prior],priorMin=data.discipline?.minimums?.[prior]||{};
   const missed=!!priorEntry?.saved&&!rest[prior]&&active.some(i=>tracked(i,prior)&&!priorEntry.habits?.[i]&&!priorMin[i]);
   return {perHabit,chosen,minimum,cue,recordedDays:recorded.length,totalFull,totalMinimum,possible,
     rate:opportunities,missedYesterday:missed,allDone:active.length>0&&!available.length};
 }

 function habitJourney(data,day,index){
   const labels=Array.isArray(data.habitLabels)?data.habitLabels:[];
   if(!Number.isInteger(index)||index<0||index>=labels.length||data.discipline?.settings?.[index]?.archivedAt)return null;
   const settings=data.discipline?.settings?.[index]||{};
   const configured=['cue','minimum','identity'].every(key=>typeof settings[key]==='string'&&settings[key].trim().length>0);
   const recorded=recent(data,day,16).filter(x=>{
     if(!x.entry?.saved||data.discipline?.restDays?.[x.day])return false;
     const periods=settings.archivePeriods||[];
     return (!settings.archivedAt||x.day<settings.archivedAt)&&
       !periods.some(p=>p&&x.day>=p.start&&(!p.end||x.day<p.end));
   });
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
 window.VigorCoaching={summary,habitIntelligence,habitJourney,coaching,roadmap,shiftType,suggestedWorkout,workoutReview,progressionGuidance};
})();
