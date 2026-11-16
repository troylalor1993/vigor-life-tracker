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
 function coaching(data,day){
   const s=summary(data,day), daily=data.dailyCheckins?.[day]||{},energy=String(daily.energy??'').toLowerCase(),sleep=String(daily.sleep??'').toLowerCase();
   let lead='Start with one manageable action today. Progress comes from repeating it.';
   let reason='A small action is easier to repeat than a perfect plan.';
   if(!s.activeDays){lead='Choose one habit and complete its minimum version today.';reason='Your tracker has no recent check-ins to base a more personalized suggestion on.';}
   else if(s.missedYesterday){lead='Comeback day: do the smallest version of your first habit. No catch-up required.';reason='Yesterday was recorded with no completed habits. Restart with one action.';}
   else if(/low|poor|tired|exhaust|1|2/.test(energy+' '+sleep)){lead='Make today a lighter day: gentle movement, a prepared meal, and your minimum habits.';reason='Your check-in suggests lower energy or sleep. Adjust effort without abandoning the routine.';}
   else if(s.rate!==null&&s.rate<50){lead='Pick one priority habit and a short workout option; build back gradually.';reason='Fewer than half of recent logged habits were completed.';}
   else if(s.todayDone>0){lead='You have started today. Keep going with one more planned action.';reason='Your check-in already shows progress today.';}
   else if(s.rate!==null&&s.rate>=80){lead='You are building consistency. Follow your planned workout and protect recovery.';reason='Most habits in recent logged check-ins were completed.';}
   return {...s,lead,reason};
 }
 function roadmap(data,day){
   const s=summary(data,day),goal=data.bodyGoals||{},start=Number(goal.startWeight),target=Number(goal.goalWeight);
   const valid=Number.isFinite(start)&&Number.isFinite(target)&&start>target&&target>0;
   const progress=valid&&s.weight!==null?Math.max(0,Math.min(100,Math.round((start-s.weight)/(start-target)*100))):null;
   return {
     stages:[
      {day:30,title:'Build the foundation',detail:'Establish realistic workouts, one reliable food-prep habit, and a minimum routine for hard days.'},
      {day:60,title:'Improve consistency',detail:'Review logged habits, adjust the schedule to your life, and progress training safely.'},
      {day:90,title:'Review and grow',detail:'Compare real trends, celebrate non-scale wins, and choose the next sustainable goal.'}
     ],progress,weight:s.weight,target:valid?target:null
   };
 }
 const style=document.createElement('style');
 style.textContent=`.vigor-coach{background:linear-gradient(125deg,var(--panel-alt),var(--panel));border:1px solid var(--border-strong);border-radius:18px;padding:16px;margin:12px 0;color:var(--text-primary)}.vigor-coach h2{margin:5px 0 9px;font-size:21px}.vigor-coach p{line-height:1.55;font-size:13px;margin:6px 0}.vigor-coach .vc-eyebrow{color:var(--accent-soft);font-size:10px;font-weight:800;letter-spacing:1.5px}.vigor-coach .vc-lead{font-size:16px;font-weight:750;color:var(--text-primary)}.vigor-coach .vc-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.vigor-coach .vc-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:43px;padding:8px 12px;border-radius:10px;background:var(--accent);color:var(--accent-contrast);font-weight:750;text-decoration:none;font-size:13px}.vigor-coach .vc-actions a.alt{background:var(--panel-alt);border:1px solid var(--border-strong);color:var(--text-primary)}.vigor-coach .vc-stages{display:grid;gap:8px}.vigor-coach .vc-stage{border:1px solid var(--border);background:var(--panel-alt);border-radius:11px;padding:11px}.vigor-coach .vc-stage strong{color:var(--accent-soft)}.vigor-coach .vc-stage p{margin:5px 0 0}.vigor-coach details summary{cursor:pointer;color:var(--accent-soft);font-size:13px;font-weight:700}.vigor-coach .vc-note{color:var(--muted);font-size:12px}`;
 document.head.append(style);
 const root=document.createElement('section');root.className='vigor-coach';root.id='vigorCoach';root.setAttribute('aria-label','Your adaptive coach and 90-day roadmap');
 const target=$('daily')||document.querySelector('main > .card')||document.querySelector('main');
 if(!target)return;
 target.before(root);
 function render(){
   const bridge=window.vigorCloudBridge;if(!bridge?.read){root.hidden=true;return}
   let data;try{data=bridge.read()}catch(e){root.hidden=true;return}
   if(!data||!Array.isArray(data.habitLabels)){root.hidden=true;return}
   root.hidden=false;
   const day=iso(new Date()),c=coaching(data,day),r=roadmap(data,day);
   const comeback=c.missedYesterday||c.rate!==null&&c.rate<50;
   root.innerHTML=`<div class="vc-eyebrow">YOUR DAILY COACH · BASED ON YOUR TRACKER</div>
    <h2>${comeback?'Your comeback starts today':'Your next best step'}</h2>
    <p class="vc-lead">${escape(c.lead)}</p>
    <p>${escape(c.reason)}</p>
    <p class="vc-note">${c.rate===null?'No recent completion trend yet':escape(c.rate+'% completion across '+c.activeDays+' logged day(s) in the past week')} · These are supportive suggestions, not medical advice.</p>
    <div class="vc-actions"><a href="#daily">Log one habit</a><a class="alt" href="#training">View workouts</a></div>
    <details><summary>My 30 / 60 / 90-day transformation roadmap</summary>
    <div class="vc-stages">${r.stages.map(x=>`<div class="vc-stage"><strong>Day ${x.day}: ${escape(x.title)}</strong><p>${escape(x.detail)}</p></div>`).join('')}</div>
    <p class="vc-note">${r.progress===null?'Log your weight and set body goals to track weight progress.':escape('Weight goal progress: '+r.progress+'%'+(r.target!==null?' toward '+r.target+' lb':''))}. Your roadmap is flexible and has no required weight-loss deadline.</p>
    </details>`;
 }
 render();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
 window.addEventListener('vigor-sync-status',render);
 document.addEventListener('change',()=>queueMicrotask(render));
 // The original app saves via click handlers; recalculate after those handlers finish.
 document.addEventListener('click',()=>queueMicrotask(render));
 window.VigorCoaching={summary,coaching,roadmap,refresh:render};
})();
