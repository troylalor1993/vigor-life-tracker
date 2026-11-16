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
   const s=summary(data,day),daily=data.dailyCheckins?.[day]||{};
   const energy=String(daily.energy??'').trim().toLowerCase(),sleep=String(daily.sleep??'').trim().toLowerCase();
   const lowerEnergy=['low','very low','poor','tired','exhausted','1','2'].includes(energy)||['poor','very poor','low','1','2'].includes(sleep);
   const shift=shiftType(data,day),workout=suggestedWorkout(data,shift);
   const recorded=data.dailyCheckins?.[day]||{},minimums=data.discipline?.minimums?.[day]||{};
   const nextIndex=s.labels.findIndex((_,i)=>!recorded.habits?.[i]&&!minimums[i]);
   const nextHabit=nextIndex>=0?s.labels[nextIndex]:null;
   const cues={
      'Day shift':'Keep your plan small around work. Anchor a habit to waking or getting home.',
      'Night shift':'Protect sleep before and after your shift; use after-waking cues, not fixed morning times.',
      'Recovery day':'After night shifts, focus on sleep, meals and gentle movement before intensity.',
      'Day off':'Use flexible time for a planned session and preparing for your next workday.',
      'Flexible daily routine':'Fit your actions around an existing part of your day.'
   };
   let lead='Start with one manageable action today. Progress comes from repeating it.';
   let reason='A small action is easier to repeat than a perfect plan.';
   if(!s.activeDays){lead='Complete the minimum version of one habit today.';reason='There are not enough recent logged check-ins for a personalized consistency trend.';}
   else if(s.missedYesterday){lead='Comeback day: restart one habit with its smallest version. No catch-up required.';reason='Yesterday was recorded without a completed habit. Today is a fresh opportunity.';}
   else if(lowerEnergy){lead='Choose a lighter activity and simple habits. Protect recovery today.';reason='Your recorded energy or sleep suggests a lighter approach may be helpful.';}
   else if(shift==='Recovery day'){lead='Let recovery lead today. Light movement and manageable habits are enough.';reason='Your rotating schedule places today after your night shifts.';}
   else if(s.rate!==null&&s.rate<50){lead='Pick one priority habit and a manageable workout option.';reason='Less than half of habit opportunities on recently logged days were completed.';}
   else if(s.todayDone>0){lead='You have already started today. Choose one more useful action.';reason='Your check-in shows progress today.';}
   else if(s.rate!==null&&s.rate>=80){lead='Your recent consistency is strong. Follow your plan and protect recovery.';reason='Most habits on recently logged days were completed.';}
   return {...s,lead,reason,shift,shiftAdvice:cues[shift],workout,nextHabit};
 }
 function roadmap(data,day){
   const s=summary(data,day),goal=data.bodyGoals||{},start=Number(goal.startWeight),target=Number(goal.goalWeight);
   const valid=Number.isFinite(start)&&Number.isFinite(target)&&start>target&&target>0;
   const progress=valid&&s.weight!==null?Math.max(0,Math.min(100,Math.round((start-s.weight)/(start-target)*100))):null;
   return {
     stages:[
      {day:30,title:'Build the foundation',detail:'Establish realistic workouts, one reliable food-prep habit, and a minimum routine for hard days.',actions:['Complete one priority habit on four days this week.','Prepare at least one meal or snack ahead of a busy day.','Choose a manageable workout or mobility session.']},
      {day:60,title:'Improve consistency',detail:'Review logged habits, adjust the schedule to your life, and progress training safely.',actions:['Review the last rotation and identify one barrier.','Adjust the next rotation to protect recovery and workout time.','Increase training only when your current routine feels manageable.']},
      {day:90,title:'Review and grow',detail:'Compare real trends, celebrate non-scale wins, and choose the next sustainable goal.',actions:['Check recorded waist, weight and fitness trends without fixating on a day.','Celebrate one meaningful non-scale improvement.','Choose one realistic goal for the next month.']}
     ],progress,weight:s.weight,target:valid?target:null
   };
 }
 const style=document.createElement('style');
 style.textContent=`.vigor-coach{background:linear-gradient(125deg,var(--panel-alt),var(--panel));border:1px solid var(--border-strong);border-radius:18px;padding:16px;margin:12px 0;color:var(--text-primary)}.vigor-coach h2{margin:5px 0 9px;font-size:21px}.vigor-coach p{line-height:1.55;font-size:13px;margin:6px 0}.vigor-coach .vc-eyebrow{color:var(--accent-soft);font-size:10px;font-weight:800;letter-spacing:1.5px}.vigor-coach .vc-lead{font-size:16px;font-weight:750;color:var(--text-primary)}.vigor-coach .vc-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.vigor-coach .vc-actions .vc-nav{display:inline-flex;align-items:center;justify-content:center;min-height:43px;padding:8px 12px;border-radius:10px;background:var(--accent);color:var(--accent-contrast);font-weight:750;text-decoration:none;font-size:13px;border:0;cursor:pointer}.vigor-coach .vc-actions .vc-nav.alt{background:var(--panel-alt);border:1px solid var(--border-strong);color:var(--text-primary)}.vigor-coach .vc-stages{display:grid;gap:8px}.vigor-coach .vc-stage{border:1px solid var(--border);background:var(--panel-alt);border-radius:11px;padding:11px}.vigor-coach .vc-stage strong{color:var(--accent-soft)}.vigor-coach .vc-stage p{margin:5px 0 0}.vigor-coach .vc-stage ul{padding-left:20px;margin:9px 0 0;color:var(--text-primary);font-size:12px;line-height:1.65}.vigor-coach details summary{cursor:pointer;color:var(--accent-soft);font-size:13px;font-weight:700}.vigor-coach .vc-note{color:var(--muted);font-size:12px}.vigor-coach .vc-shift{border-left:3px solid var(--accent);padding:7px 10px;background:var(--panel-alt);border-radius:5px}.vigor-coach .vc-next{margin:5px 0;font-size:13px}`;
 document.head.append(style);
 const root=document.createElement('section');root.className='vigor-coach';root.id='vigorCoach';root.setAttribute('aria-label','Your adaptive coach and 90-day roadmap');
 const target=$('big3Panel')||$('daily')||document.querySelector('main > .card');
 if(!target)return;
 target.after(root);
 function render(){
   const bridge=window.vigorCloudBridge;if(!bridge?.read){root.hidden=true;return}
   let data;try{data=bridge.read()}catch(e){root.hidden=true;return}
   if(!data||!Array.isArray(data.habitLabels)){root.hidden=true;return}
   root.hidden=false;
   const day=iso(new Date()),c=coaching(data,day),r=roadmap(data,day);
   const comeback=c.missedYesterday||(c.rate!==null&&c.rate<50);
   const expanded=root.querySelector('details')?.open||false;
   root.innerHTML=`<div class="vc-eyebrow">YOUR DAILY COACH · BASED ON YOUR TRACKER</div>
    <h2>${comeback?'Your comeback starts today':'Your next best step'}</h2>
    <p class="vc-lead">${escape(c.lead)}</p>
    <p>${escape(c.reason)}</p><p class="vc-shift"><strong>${escape(c.shift)}:</strong> ${escape(c.shiftAdvice)}</p>
    ${c.nextHabit?'<p class="vc-next"><strong>Next habit:</strong> '+escape(c.nextHabit)+'</p>':''}
    ${c.workout?'<p class="vc-next"><strong>Workout option:</strong> '+escape(c.workout)+'</p>':''}
    <p class="vc-note">${c.rate===null?'No recent completion trend yet':escape(c.rate+'% completion across '+c.activeDays+' logged day(s) in the past week')} · These are supportive suggestions, not medical advice.</p>
    <div class="vc-actions"><button type="button" class="vc-nav" data-vc-target="daily">Log one habit</button><button type="button" class="vc-nav alt" data-vc-target="training">View workouts</button></div>
    <details ${expanded?'open':''}><summary>My 30 / 60 / 90-day transformation roadmap</summary>
    <div class="vc-stages">${r.stages.map(x=>`<div class="vc-stage"><strong>Day ${x.day}: ${escape(x.title)}</strong><p>${escape(x.detail)}</p><ul>${x.actions.map(a=>`<li>${escape(a)}</li>`).join('')}</ul></div>`).join('')}</div>
    <p class="vc-note">${r.progress===null?'Log your weight and set body goals to track weight progress.':escape('Weight goal progress: '+r.progress+'%'+(r.target!==null?' toward '+r.target+' lb':''))}. Your roadmap is flexible and has no required weight-loss deadline.</p>
    </details>`;
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
 window.VigorCoaching={summary,coaching,roadmap,refresh:render};
})();
