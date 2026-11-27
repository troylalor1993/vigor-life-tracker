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
 const progress=$('panel-progress');if(!progress){window.VigorRotationReview={rotationSummary,trainingSummary};return;}
 const card=document.createElement('section');card.className='vigor-rotation-recap';card.id='vigorRotationRecap';
 ($('progressReports')||progress).append(card);
 const style=document.createElement('style');
 style.textContent='.vigor-rotation-recap{border:1px solid var(--border-strong);border-radius:20px;padding:17px;margin:0 0 14px;background:linear-gradient(135deg,#29241d,var(--panel));color:var(--text-primary)}.vigor-rotation-recap h2{font-size:22px;margin:6px 0}.vigor-rotation-recap p{font-size:13px;color:var(--muted);line-height:1.5}.vrr-eyebrow{font-size:10px;font-weight:800;letter-spacing:.14em;color:var(--accent-soft)}.vrr-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:13px 0}.vrr-stats>div{background:var(--input-bg);border:1px solid var(--border);padding:12px 7px;border-radius:12px;min-width:0}.vrr-stats b{display:block;color:var(--accent-soft);font-size:22px}.vrr-stats small{font-size:11px;color:var(--muted);line-height:1.3}.vrr-compare{border-top:1px solid var(--border);padding-top:10px}.vrr-review{background:var(--panel-alt);border:1px solid var(--border);border-radius:12px;padding:12px;margin-top:12px}.vrr-review p{margin:6px 0}.vigor-rotation-recap button{min-height:44px;padding:10px 13px;border:1px solid var(--border-strong);background:var(--panel-alt);color:var(--text-primary);font-weight:750;border-radius:11px}.vrr-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}';
 document.head.append(style);
 const add=(parent,tag,text,className)=>{const x=document.createElement(tag);x.textContent=text;if(className)x.className=className;parent.append(x);return x};

 function trainingSummary(data,start,length=8){
   const dates=Array.from({length},(_,i)=>dateOffset(start,i)), allowed=new Set(dates);
   const activities=new Map((data.activities||[]).map(a=>[a.id,a]));
   const sets={strength:new Set(),athletic:new Set(),interval:new Set(),mobility:new Set(),walking:new Set()};
   for(const c of data.completions||[]){
     if(!allowed.has(c.date))continue;
     const a=activities.get(c.activityId), name=String(a?.name||'').toLowerCase(), id=c.activityId;
     const named=c.routine||name.match(/(?:full[ -]?body|workout)\s+([a-d])\b/i)?.[1]?.toUpperCase();
     const key=c.date+'|'+(named||id);
     if(/^[A-D]$/.test(named||'')||id==='fullbody'||/full[ -]?body|^workout [a-d](?:\b|$)/i.test(name))sets.strength.add(key);
     else if(named==='athletic'||/athletic|agility/i.test(name))sets.athletic.add(c.date);
     else if(named==='interval'||id==='speed'||/sprint|interval|shuttle/i.test(name))sets.interval.add(c.date);
     else if(id==='mobility'||/mobility|stretch/i.test(name))sets.mobility.add(c.date);
     else if(/walk/i.test(name))sets.walking.add(c.date);
   }
   for(const day of dates){
     const habits=data.dailyCheckins?.[day]?.habits||[];
     (data.habitLabels||[]).forEach((label,i)=>{
       if(!habits[i])return;
       if(/mobility|stretch|flexibility/i.test(label))sets.mobility.add(day);
       if(/walk|step target/i.test(label))sets.walking.add(day);
     });
     if(Number(data.transformationCheckins?.[day]?.walk)>0)sets.walking.add(day);
   }
   const zone=(data.zone2Logs||[]).filter(x=>allowed.has(x.date)).reduce((sum,x)=>sum+Math.max(0,Number(x.minutes)||0),0);
   const t=data.trainingTargetHistory?.[start]||data.trainingTargets||{};
   const goal=(k,f,max)=>Number.isInteger(t[k])&&t[k]>0?Math.min(t[k],max):f;
   const rows=[['Full-body strength',sets.strength.size,goal('strength',4,8),'workouts'],['Athletic performance',sets.athletic.size,goal('athletic',1,8),'workout'],['Interval conditioning',sets.interval.size,goal('interval',1,8),'session'],['Zone 2 cardio',zone,Number(data.trainingTargetHistory?.[start]?.zone||data.zone2Goal)>0?Number(data.trainingTargetHistory?.[start]?.zone||data.zone2Goal):150,'min'],['Mobility',sets.mobility.size,goal('mobility',length,length),'days'],['Walking / step goal',sets.walking.size,goal('walking',length,length),'days']];
   return {rows,score:Math.round(100*rows.reduce((sum,r)=>sum+Math.min(1,r[1]/r[2]),0)/rows.length)};
 }
 function renderTraining(data,today,summary){
   const start=dateOffset(summary.latest.start,summary.length);
   const result=trainingSummary(data,start,summary.length);
   const panel=document.createElement('section');panel.className='vrr-review';
   add(panel,'div','CURRENT ROTATION PERFORMANCE','vrr-eyebrow');
   add(panel,'h2',result.score+'% complete');
   add(panel,'p',start+' to '+dateOffset(start,summary.length-1)+' · Recorded activity only. Recovery comes first.');
   for(const [label,value,target,unit] of result.rows){
     add(panel,'p',label+' · '+value+' / '+target+' '+unit);
     const bar=document.createElement('progress');bar.max=target;bar.value=Math.min(value,target);bar.setAttribute('aria-label',label);bar.style.cssText='width:100%;height:8px;accent-color:var(--accent-soft)';panel.append(bar);
   }
   const edit=add(panel,'details','');
   add(edit,'summary','Edit training targets');
   const form=document.createElement('form');edit.append(form);
   const keys=['strength','athletic','interval','zone','mobility','walking'];
   result.rows.forEach((row,i)=>{
     const label=add(form,'label',row[0]+' ');
     const input=document.createElement('input');input.type='number';input.name=keys[i];input.min='1';input.max=String(i===3?2000:i>=4?summary.length:8);input.step='1';input.required=true;input.value=String(row[2]);label.append(input);form.append(document.createElement('br'));
   });
   const saveButton=add(form,'button','Save targets');saveButton.type='submit';
   const feedback=add(form,'p','');feedback.setAttribute('role','status');
   form.onsubmit=e=>{e.preventDefault();try{(()=>{for(let i=1;i<=6;i++){const past=dateOffset(start,-i*summary.length);const old=trainingSummary(data,past,summary.length);if(old.rows.some(r=>r[1]>0)&&!data.trainingTargetHistory?.[past])window.vigorCloudBridge.snapshotTrainingTargets(past,Object.fromEntries(keys.map((k,j)=>[k,old.rows[j][2]])))}window.vigorCloudBridge.saveTrainingTargets(Object.fromEntries(new FormData(form)))})()}catch(error){feedback.textContent=error.message}};
   card.append(panel);
   const history=add(panel,'details','');
   add(history,'summary','Recent rotation training history');
   for(let i=1;i<=6;i++){
     const past=dateOffset(start,-i*summary.length);
     const old=trainingSummary(data,past,summary.length);
     if(!old.rows.some(r=>r[1]>0))continue;
     add(history,'p',past+' to '+dateOffset(past,summary.length-1)+' · '+old.score+'%'+(data.trainingTargetHistory?.[past]?' (saved targets)':' (estimated using current targets)'));
   }
   add(history,'p','Rotations without recorded training are omitted.');
 }
 function render(){
   let data;try{data=window.vigorCloudBridge?.read?.()}catch(e){card.hidden=true;return}
   if(!data){card.hidden=true;return}
   const day=new Date();const today=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
   const r=rotationSummary(data,today);
   card.hidden=false;card.replaceChildren();
   renderTraining(data,today,r);
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
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){window.vigorCloudBridge?.refreshTrainingRotation?.();render()}});
 window.VigorRotationReview={rotationSummary,trainingSummary,refresh:render};
 window.vigorCloudBridge?.refreshTrainingRotation?.();
})();
