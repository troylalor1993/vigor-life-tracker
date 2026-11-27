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
 const anchor=$('transformationCoach');if(!anchor)return;
 const box=document.createElement('section');box.className='vigor-start-guide';box.id='vigorStartGuide';
 box.setAttribute('aria-label','Getting started with Vigor Life');
 anchor.before(box);
 let dismissed=false;
 const style=document.createElement('style');
 style.textContent='.vigor-start-guide{padding:17px;margin:0 0 15px;border:1px solid var(--border-strong);border-radius:18px;background:linear-gradient(130deg,#302719,#17191a);color:var(--text-primary)}.vigor-start-guide h2{font-size:21px;margin:6px 0}.vigor-start-guide p{font-size:13px;color:var(--muted);line-height:1.5}.vigor-start-guide .vsg-eyebrow{letter-spacing:.14em;font-size:10px;font-weight:800;color:var(--accent-soft)}.vsg-steps{display:grid;gap:7px;margin:13px 0}.vsg-step{display:flex;align-items:center;gap:10px;border:1px solid var(--border);border-radius:11px;padding:10px 12px;font-size:13px}.vsg-step b{color:var(--accent-soft)}.vsg-actions{display:flex;gap:8px;flex-wrap:wrap}.vsg-actions button{background:var(--accent);color:var(--accent-contrast);border:0;border-radius:11px;padding:11px 14px;min-height:44px;font-weight:800}.vsg-actions button.vsg-secondary{background:var(--panel-alt);color:var(--text-primary);border:1px solid var(--border-strong)}@media(max-width:450px){.vsg-actions button{flex:1}}';
 document.head.append(style);
 function render(){
   let data;try{data=window.vigorCloudBridge?.read?.()}catch(e){box.hidden=true;return}
   if(!data){box.hidden=true;return}
   const state=onboardingState(data);box.hidden=dismissed||!state.eligible;
   if(box.hidden)return;
   box.replaceChildren();
   const tag=document.createElement('div');tag.className='vsg-eyebrow';tag.textContent='START STRONG';
   const head=document.createElement('h2');head.textContent=state.chosen?'Your first small win is next':'Make Vigor Life yours';
   const p=document.createElement('p');p.textContent='Three simple steps. Your habits and goals remain fully editable, and your existing tracker data is never replaced.';
   const steps=document.createElement('div');steps.className='vsg-steps';
   state.steps.forEach((item,i)=>{const row=document.createElement('div');row.className='vsg-step';const symbol=document.createElement('b');symbol.textContent=item.done?'✓':String(i+1);const name=document.createElement('span');name.textContent=item.label;row.append(symbol,name);steps.append(row)});
   const actions=document.createElement('div');actions.className='vsg-actions';
   const main=document.createElement('button');main.type='button';main.textContent=state.chosen?'Record my first habit':'Personalize one habit';main.onclick=()=>{
      if(state.chosen){
       document.querySelector('#vigorNav [data-vigor-route="today"]')?.click();
       const target=$('daily'),parent=target?.closest('details');if(parent)parent.open=true;
       target?.scrollIntoView({behavior:'smooth',block:'start'});
      }else{
       document.querySelector('#vigorNav [data-vigor-route="more"]')?.click();
       const nav=$('vigorMoreMenu');nav?.querySelector('[data-vigor-old="settings"]')?.click();
       const details=$('setupDetails');if(details)details.open=true;
       details?.scrollIntoView({behavior:'smooth',block:'start'});
      }
   };
   const skip=document.createElement('button');skip.type='button';skip.className='vsg-secondary';skip.textContent='Not now';skip.onclick=()=>{dismissed=true;box.hidden=true};
   actions.append(main,skip);box.append(tag,head,p,steps,actions);
 }
 render();
 window.addEventListener('vigor-local-changed',render);
 window.addEventListener('vigor-sync-status',render);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
 window.VigorOnboarding={onboardingState,refresh:render};
})();
