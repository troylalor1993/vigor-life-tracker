/* Vigor Life first-run guide: deliberately reuses existing setup and logging. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 function onboardingState(data){
   const records=data.dailyCheckins||{},logs=data.completions||[],measurements=data.measurements||[],zones=data.zone2Logs||[];
   const saved=Object.values(records).some(x=>x?.saved||x?.habits?.some(Boolean));
   const worked=Array.isArray(logs)&&logs.length>0;
   const measured=Array.isArray(measurements)&&measurements.length>0;
   const cardio=Array.isArray(zones)&&zones.length>0;
   const existingHistory=saved||worked||measured||cardio;
   const chosen=!!data.discipline?.setupDone;
   const hasHabits=Array.isArray(data.habitLabels)&&data.habitLabels.length>0;
   return {eligible:!existingHistory,chosen,hasHabits,steps:[
     {label:'Choose a habit',done:hasHabits},
     {label:'Set your cue and minimum',done:chosen},
     {label:'Record your first small win',done:existingHistory}
   ]};
 }
 const anchor=$('neverTwice');if(!anchor)return;
 const box=document.createElement('button');box.type='button';box.className='secondary';box.id='vigorStartGuide';
 box.textContent='Start with a habit';
 $('todayTraining').before(box);
 box.onclick=()=>$('vigorAllHabits')?.scrollIntoView({behavior:'smooth',block:'start'});
 function render(){
   const data=window.vigorCloudBridge?.read?.();
   box.hidden=!data||!onboardingState(data).eligible;
 }
 render();
 window.addEventListener('vigor-local-changed',render);
 window.addEventListener('vigor-sync-status',render);
 window.VigorOnboarding={onboardingState,refresh:render};
})();
