/* The Vigor Life — focused Today hero. Reads existing data; never writes records. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 function focusFor(data,day){
  const habits=Array.isArray(data.habitLabels)?data.habitLabels:[];
  const workouts=Array.isArray(data.activities)?data.activities:[];
  const full=data.dailyCheckins?.[day]?.habits||[];
  const minimums=data.discipline?.minimums?.[day]||{};
  const doneWorkouts=new Set((data.completions||[]).filter(x=>x.date===day).map(x=>x.activityId));
  const minWorkouts=new Set((data.discipline?.workoutMinimums||[]).filter(x=>x.date===day).map(x=>x.activityId));
  const possible=[
    ...habits.map((name,i)=>({key:'h:'+i,type:'habit',name,index:i,done:!!full[i],started:!!minimums[i]})),
    ...workouts.filter(w=>w?.id&&w?.name).map(w=>({key:'w:'+w.id,type:'workout',name:w.name,id:w.id,done:doneWorkouts.has(w.id),started:minWorkouts.has(w.id)}))
  ];
  const configured=Array.isArray(data.discipline?.big3)?data.discipline.big3:[];
  const prayer=habits.findIndex(x=>/pray/i.test(x));
  const scripture=habits.findIndex(x=>/bible|scripture/i.test(x));
  const nutrition=habits.findIndex(x=>/nutrition|meal|protein/i.test(x));
  const defaults=[prayer>=0?'h:'+prayer:scripture>=0?'h:'+scripture:'h:0',
    workouts[0]?'w:'+workouts[0].id:'h:1',nutrition>=0?'h:'+nutrition:'h:2'];
  const priorities=[...configured,...defaults,...possible.map(x=>x.key)];
  const ordered=[];
  for(const key of priorities){if(ordered.length>=Math.min(3,possible.length))break;const item=possible.find(x=>x.key===key);if(item&&!ordered.includes(item))ordered.push(item)}
  const completed=ordered.filter(x=>x.done||x.started).length;
  const remaining=ordered.filter(x=>!x.done&&!x.started);
  const next=remaining.find(x=>x.type==='habit')||remaining[0]||null;
  const config=next?.type==='habit'?data.discipline?.settings?.[next.index]||{}:{};
  const min=typeof config.minimum==='string'&&config.minimum.trim()?config.minimum.trim():'Start with the smallest useful version';
  const cue=typeof config.cue==='string'&&config.cue.trim()?config.cue.trim():'After an existing daily routine';
  return {completed,total:ordered.length,next,minimum:min,cue,allComplete:ordered.length>0&&completed===ordered.length};
 }
 const anchor=$('big3Panel');if(!anchor)return;
 const hero=document.createElement('section');hero.className='vigor-focus-hero';hero.id='vigorDailyFocus';hero.setAttribute('aria-label','Your next small win');
 anchor.before(hero);
 const style=document.createElement('style');
 style.textContent='.vigor-focus-hero{position:relative;overflow:hidden;border:1px solid #8a6a39;border-radius:22px;padding:19px;margin:2px 0 15px;background:radial-gradient(ellipse at 88% 8%,rgba(237,182,89,.24),transparent 57%),linear-gradient(125deg,#34291d,#191a1b 70%);box-shadow:0 22px 43px rgba(0,0,0,.27),inset 0 1px rgba(255,230,173,.17)}.vigor-focus-hero .vigor-focus-eyebrow{font-size:10px;letter-spacing:.18em;color:#efd196;font-weight:850}.vigor-focus-hero h2{font-size:clamp(22px,4.5vw,29px);letter-spacing:-.045em;margin:9px 0 5px;color:#fff4e1;line-height:1.18}.vigor-focus-hero p{color:#e4d7c3;margin:7px 0;font-size:13px}.vigor-focus-hero .vigor-focus-progress{display:flex;align-items:center;gap:12px;margin:13px 0}.vigor-focus-hero .vigor-focus-track{background:#514431;border-radius:99px;flex:1;height:7px;overflow:hidden}.vigor-focus-hero .vigor-focus-fill{height:100%;background:linear-gradient(90deg,#c28b36,#ffe2a0)}.vigor-focus-hero .vigor-focus-value{color:#ffe2a0;font-size:13px;font-weight:800;white-space:nowrap}.vigor-focus-hero button{background:linear-gradient(120deg,#ffe3a0,#d7a54e);color:#1f160b;border:0;border-radius:12px;min-height:46px;padding:11px 16px;font-weight:850;font-size:13px;cursor:pointer;margin-top:7px}.vigor-focus-hero button:focus-visible{outline:3px solid #fff2c9;outline-offset:3px}.vigor-focus-hero .vigor-focus-note{color:#d3c6b2;font-size:12px}@media(max-width:650px){.vigor-focus-hero{padding:16px}.vigor-focus-hero button{width:100%}}';
 document.head.append(style);
 function render(){
  let data;try{data=window.vigorCloudBridge?.read?.()}catch(e){hero.hidden=true;return}
  if(!data||!Array.isArray(data.habitLabels)){hero.hidden=true;return}
  hero.hidden=false;
  const focus=focusFor(data,today()),next=focus.next;
  const headline=focus.allComplete?'You showed up today.':next?next.name:'Start with one meaningful action.';
  const description=focus.allComplete?'Your chosen daily priorities are recorded. Take time to reflect or rest.':next?.type==='habit'?focus.minimum:'Open your existing habits and workout list to choose a manageable action.';
  hero.replaceChildren();
  const top=document.createElement('div');top.className='vigor-focus-eyebrow';top.textContent='YOUR NEXT SMALL WIN';
  const title=document.createElement('h2');title.textContent=headline;
  const desc=document.createElement('p');desc.textContent=description;
  const progress=document.createElement('div');progress.className='vigor-focus-progress';
  const meter=document.createElement('div');meter.className='vigor-focus-track';meter.setAttribute('role','progressbar');meter.setAttribute('aria-label','Daily priorities recorded');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax',String(focus.total));meter.setAttribute('aria-valuenow',String(focus.completed));
  const fill=document.createElement('div');fill.className='vigor-focus-fill';fill.style.width=(focus.total?Math.round(100*focus.completed/focus.total):0)+'%';meter.append(fill);
  const count=document.createElement('div');count.className='vigor-focus-value';count.textContent=focus.completed+' of '+focus.total;progress.append(meter,count);
  const detail=document.createElement('p');detail.className='vigor-focus-note';detail.textContent=next?.type==='habit'?'Cue: '+focus.cue:'A small effort counts. Keep your routine sustainable.';
  const action=document.createElement('button');action.type='button';action.textContent=focus.allComplete?'Review my progress':next?'Open this priority':'Choose my priorities';
  action.onclick=()=>{
    if(focus.allComplete){document.querySelector('#vigorNav [data-vigor-route="growth"]')?.click();return}
    document.querySelector('#vigorNav [data-vigor-route="today"]')?.click();
    const target=next?.type==='habit'&&!data.discipline?.big3?.includes(next.key)?$('daily'):next?.type==='workout'&&!data.discipline?.big3?.includes(next.key)?$('training'):$('big3Panel');
    const details=target?.closest('details');if(details)details.open=true;
    target?.scrollIntoView({behavior:'smooth',block:'start'});
  };
  hero.append(top,title,desc,progress,detail,action);
 }
 render();
 window.addEventListener('vigor-sync-status',render);
 document.addEventListener('change',()=>queueMicrotask(render));
 document.addEventListener('click',()=>queueMicrotask(render));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
 window.VigorDailyFocus={focusFor,refresh:render};
})();
