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
 window.VigorRotationReview={rotationSummary,trainingSummary};
 if($('panel-progress')){
   document.addEventListener('visibilitychange',()=>{
     if(!document.hidden)window.vigorCloudBridge?.refreshTrainingRotation?.();
   });
   window.vigorCloudBridge?.refreshTrainingRotation?.();
 }
})();
