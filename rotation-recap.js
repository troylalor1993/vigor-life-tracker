/* Rotation reflection card — uses recorded data and existing review editor. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const dateOffset=(text,n)=>{const d=new Date(text+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 const dayDifference=(a,b)=>Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000);
 function rotationSummary(data,day){
   const length=data.cycleLength===7?7:8;
   const anchor=/^\d{4}-\d{2}-\d{2}$/.test(data.anchor||'')?data.anchor:day;
   const delta=dayDifference(day,anchor);
   const currentStart=dateOffset(anchor,Math.floor(delta/length)*length);
   const previousStart=dateOffset(currentStart,-length);
   const priorStart=dateOffset(previousStart,-length);
   const records=data.dailyCheckins||{},minimums=data.discipline?.minimums||{},rest=data.discipline?.restDays||{};
   const workouts=Array.isArray(data.completions)?data.completions:[];
   const workoutMinimums=Array.isArray(data.discipline?.workoutMinimums)?data.discipline.workoutMinimums:[];
   const count=start=>{
     const end=dateOffset(start,length-1),dates=Array.from({length},(_,i)=>dateOffset(start,i));
     const logged=dates.filter(d=>records[d]?.saved&&!rest[d]);
     const resting=dates.filter(d=>!!rest[d]).length;
     let full=0,minimum=0;
     for(const d of logged)for(let i=0;i<(data.habitLabels||[]).length;i++){
       if(records[d]?.habits?.[i])full++;else if(minimums[d]?.[i])minimum++;
     }
     const sessions=workouts.filter(x=>x.date>=start&&x.date<=end).length;
     const shortStarts=workoutMinimums.filter(x=>x.date>=start&&x.date<=end).length;
     return {start,end,recordedDays:logged.length,restDays:resting,full,minimum,workoutSessions:sessions,workoutMinimums:shortStarts};
   };
   const latest=count(previousStart),before=count(priorStart);
   const meaningful=latest.recordedDays+latest.workoutSessions+latest.workoutMinimums+latest.restDays>0;
   const review=data.discipline?.reviews?.[previousStart]||null;
   return {length,latest,before,meaningful,review};
 }
 const progress=$('panel-progress');if(!progress)return;
 const card=document.createElement('section');card.className='vigor-rotation-recap';card.id='vigorRotationRecap';
 progress.insertBefore(card,progress.firstChild);
 const style=document.createElement('style');
 style.textContent='.vigor-rotation-recap{border:1px solid var(--border-strong);border-radius:20px;padding:17px;margin:0 0 14px;background:linear-gradient(135deg,#29241d,var(--panel));color:var(--text-primary)}.vigor-rotation-recap h2{font-size:22px;margin:6px 0}.vigor-rotation-recap p{font-size:13px;color:var(--muted);line-height:1.5}.vrr-eyebrow{font-size:10px;font-weight:800;letter-spacing:.14em;color:var(--accent-soft)}.vrr-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:13px 0}.vrr-stats>div{background:var(--input-bg);border:1px solid var(--border);padding:12px 7px;border-radius:12px;min-width:0}.vrr-stats b{display:block;color:var(--accent-soft);font-size:22px}.vrr-stats small{font-size:11px;color:var(--muted);line-height:1.3}.vrr-compare{border-top:1px solid var(--border);padding-top:10px}.vrr-review{background:var(--panel-alt);border:1px solid var(--border);border-radius:12px;padding:12px;margin-top:12px}.vrr-review p{margin:6px 0}.vigor-rotation-recap button{min-height:44px;padding:10px 13px;border:1px solid var(--border-strong);background:var(--panel-alt);color:var(--text-primary);font-weight:750;border-radius:11px}.vrr-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}';
 document.head.append(style);
 const add=(parent,tag,text,className)=>{const x=document.createElement(tag);x.textContent=text;if(className)x.className=className;parent.append(x);return x};
 function render(){
   let data;try{data=window.vigorCloudBridge?.read?.()}catch(e){card.hidden=true;return}
   if(!data){card.hidden=true;return}
   const day=new Date();const today=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
   const r=rotationSummary(data,today);
   card.hidden=false;card.replaceChildren();
   add(card,'div','COMPLETED ROTATION REVIEW','vrr-eyebrow');
   add(card,'h2','Learn from your last '+r.length+' days');
   add(card,'p',r.latest.start+' to '+r.latest.end+'. Only recorded activity counts; blank days are not treated as failures.');
   if(!r.meaningful){add(card,'p','No activity recorded in this completed rotation yet. Your review will appear after you have history.');return}
   const stats=add(card,'div','','vrr-stats');
   for(const [number,label] of [[r.latest.recordedDays,'Logged non-rest days'],[r.latest.full,'Full habit efforts'],[r.latest.minimum,'Minimum habit efforts']]){
     const tile=document.createElement('div');add(tile,'b',String(number));add(tile,'small',label);stats.append(tile);
   }
   add(card,'p',r.latest.workoutSessions+' full workout session(s) · '+r.latest.workoutMinimums+' workout minimum(s) · '+r.latest.restDays+' designated rest day(s).','vrr-compare');
   if(r.before.recordedDays||r.before.workoutSessions)
     add(card,'p','Previous completed rotation: '+r.before.recordedDays+' logged non-rest day(s), '+r.before.full+' full habit effort(s), '+r.before.minimum+' minimum effort(s), and '+r.before.workoutSessions+' workout(s).');
   if(r.review&&(r.review.win||r.review.obstacle||r.review.adjustment)){
     const note=add(card,'div','','vrr-review');
     if(r.review.win)add(note,'p','What worked: '+r.review.win);
     if(r.review.obstacle)add(note,'p','Obstacle: '+r.review.obstacle);
     if(r.review.adjustment)add(note,'p','Next adjustment: '+r.review.adjustment);
   }
   const actions=add(card,'div','','vrr-actions');
   const button=add(actions,'button','Open current rotation reflection');
   button.type='button';button.onclick=()=>{
     const target=$('disciplineReview');target?.querySelector('details')?.setAttribute('open','');
     target?.scrollIntoView({behavior:'smooth',block:'start'});
   };
   add(card,'p','The existing reflection editor saves notes for your current rotation. Completed-rotation reflections are shown here when previously recorded.');
 }
 render();
 window.addEventListener('vigor-local-changed',render);
 window.addEventListener('vigor-sync-status',render);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
 window.VigorRotationReview={rotationSummary,refresh:render};
})();
