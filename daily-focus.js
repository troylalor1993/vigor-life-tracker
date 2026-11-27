/* Resolve focus order for the Habit Journey. */
(()=>{'use strict';
 function focusFor(data,day){
  const habits=Array.isArray(data.habitLabels)?data.habitLabels:[];
  const workouts=Array.isArray(data.activities)?data.activities:[];
  const full=data.dailyCheckins?.[day]?.habits||[];
  const minimums=data.discipline?.minimums?.[day]||{};
  const doneWorkouts=new Set((data.completions||[]).filter(x=>x.date===day).map(x=>x.activityId));
  const minWorkouts=new Set((data.discipline?.workoutMinimums||[]).filter(x=>x.date===day).map(x=>x.activityId));
  const possible=[
    ...habits.map((name,i)=>data.discipline?.settings?.[i]?.archivedAt?null:({key:'h:'+i,type:'habit',name,index:i,done:!!full[i],started:!!minimums[i]})).filter(Boolean),
    ...workouts.filter(w=>w?.id&&w?.name).map(w=>({key:'w:'+w.id,type:'workout',name:w.name,id:w.id,done:doneWorkouts.has(w.id),started:minWorkouts.has(w.id)}))
  ];
  const configured=Array.isArray(data.discipline?.big3)?data.discipline.big3:[];
  const prayer=habits.findIndex((x,i)=>!data.discipline?.settings?.[i]?.archivedAt&&/pray/i.test(x));
  const scripture=habits.findIndex((x,i)=>!data.discipline?.settings?.[i]?.archivedAt&&/bible|scripture/i.test(x));
  const nutrition=habits.findIndex((x,i)=>!data.discipline?.settings?.[i]?.archivedAt&&/nutrition|meal|protein/i.test(x));
  const active=possible.filter(x=>x.type==='habit');
  const first=prayer>=0?prayer:scripture>=0?scripture:active[0]?.index;
  const defaults=[first===undefined?null:'h:'+first,
    workouts[0]?'w:'+workouts[0].id:active.find(x=>x.index!==first)?.key,
    nutrition>=0?'h:'+nutrition:active.find(x=>x.index!==first)?.key].filter(Boolean);
  const priorities=[...configured,...defaults,...possible.map(x=>x.key)];
  const ordered=[];
  for(const key of priorities){if(ordered.length>=Math.min(3,possible.length))break;const item=possible.find(x=>x.key===key);if(item&&!ordered.includes(item))ordered.push(item)}
  const completed=ordered.filter(x=>x.done||x.started).length;
  const remaining=ordered.filter(x=>!x.done&&!x.started);
  // Retain existing focus order for saved habit preferences.
  const next=remaining[0]||null;
  const config=next?.type==='habit'?data.discipline?.settings?.[next.index]||{}:{};
  const min=typeof config.minimum==='string'&&config.minimum.trim()?config.minimum.trim():'Start with the smallest useful version';
  const cue=typeof config.cue==='string'&&config.cue.trim()?config.cue.trim():'After an existing daily routine';
  return {completed,total:ordered.length,priorities:ordered.map(x=>x.key),next,minimum:min,cue,allComplete:ordered.length>0&&completed===ordered.length};
 }
 window.VigorDailyFocus={focusFor};
})();
