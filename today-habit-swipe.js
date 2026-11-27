/* Vigor Life · Every active habit is a daily priority.
   Swipe horizontally, or use arrows. Records use the EXISTING Journey habit handler. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const key=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 function todayHabits(data,day){
  const labels=Array.isArray(data.habitLabels)?data.habitLabels:[];
  const full=data.dailyCheckins?.[day]?.habits||[];
  const mins=data.discipline?.minimums?.[day]||{};
  return labels.map((name,index)=>{
   const settings=data.discipline?.settings?.[index]||{};
   if(settings.archivedAt)return null;
   const status=full[index]?'full':mins[index]?'min':'none';
   return {name,index,status,minimum:settings.minimum||'Take one small meaningful action',
    cue:settings.cue||'After a routine I already have',
    kind:settings.kind==='replace'?'Replacing':'Building'};
  }).filter(Boolean).sort((a,b)=>Number(a.status!=='none')-Number(b.status!=='none')||a.index-b.index);
 }
 const anchor=$('neverTwice');
 if(!anchor)return;
 const deck=document.createElement('section');deck.id='vigorAllHabits';deck.className='vigor-all-habits';
 deck.setAttribute('aria-label','Swipe through all of today’s habits');
 anchor.before(deck);
 let selectedIndex=null,activeDay='';
 const read=()=>{try{return window.vigorCloudBridge?.read?.()}catch{return null}};
 function render(preferred=null){
  const data=read();if(!data||!Array.isArray(data.habitLabels)){deck.hidden=true;return}
  const day=key(),items=todayHabits(data,day);
  if(activeDay!==day){activeDay=day;selectedIndex=null}
  deck.hidden=false;
  const previous=preferred??selectedIndex;
  selectedIndex=items.some(item=>item.index===previous)?previous:
    items.find(item=>item.status==='none')?.index??items[0]?.index??null;
  const done=items.filter(item=>item.status!=='none').length;
  deck.replaceChildren();
  const heading=document.createElement('div');heading.className='vah-heading';
  const headingText=document.createElement('div');
  const eyebrow=document.createElement('span');eyebrow.className='vah-eyebrow';eyebrow.textContent='YOUR DAILY HABITS';
  const title=document.createElement('h2');title.textContent='Every habit matters';
  const subtitle=document.createElement('p');subtitle.textContent='Swipe to your next habit. One action at a time.';
  headingText.append(eyebrow,title,subtitle);
  const counter=document.createElement('span');counter.className='vah-count';
  counter.textContent=done+' / '+items.length+' started';counter.setAttribute('aria-live','polite');
  heading.append(headingText,counter);deck.append(heading);
  if(!items.length){
   const empty=document.createElement('p');empty.className='vah-empty';empty.textContent='Add or restore a habit in Journey to begin.';
   const go=document.createElement('button');go.type='button';go.textContent='Manage habits';
   go.onclick=()=>document.querySelector('#vigorNav [data-vigor-route="journey"]')?.click();
   deck.append(empty,go);return;
  }
  const track=document.createElement('div');track.className='vah-track';
  track.id='vigorHabitsTrack';track.setAttribute('aria-label','Habit cards; swipe left or right');
  track.tabIndex=0;
  items.forEach(item=>{
   const card=document.createElement('article');card.className='vah-card';
   card.dataset.habitIndex=String(item.index);card.dataset.status=item.status;
   const meta=document.createElement('div');meta.className='vah-meta';
   const kind=document.createElement('span');kind.textContent=item.kind;
   const state=document.createElement('span');state.className='vah-status';
   state.textContent=item.status==='full'?'✓ Done today':item.status==='min'?'✓ Minimum today':'Not started';
   meta.append(kind,state);
   const name=document.createElement('h3');name.textContent=item.name;
   const minimum=document.createElement('p');minimum.className='vah-minimum';
   minimum.textContent='Small step: '+item.minimum;
   const cue=document.createElement('p');cue.className='vah-cue';cue.textContent='Cue: '+item.cue;
   const actions=document.createElement('div');actions.className='vah-actions';
   for(const [mode,label] of [['full','Done'],['minimum','Minimum']]){
    const button=document.createElement('button');button.type='button';
    button.textContent=label;button.className='vah-action'+(item.status===(mode==='minimum'?'min':'full')?' active':'');
    button.dataset.mode=mode;button.setAttribute('aria-pressed',String(item.status===(mode==='minimum'?'min':'full')));
    button.setAttribute('aria-label',label+' for '+item.name);
    button.onclick=()=>{
     try{
      window.vigorCloudBridge.recordJourneyHabit(item.index,mode);
      const updated=todayHabits(read()||data,day);
      // After showing up, advance to the next unfinished habit if one exists.
      const next=updated.find(x=>x.status==='none')?.index??item.index;
      render(next);
      window.VigorJourneyManager?.refresh?.();
     }catch(error){
      feedback.textContent=String(error?.message||'Unable to record habit');
     }
    };
    actions.append(button);
   }
   card.append(meta,name,minimum,cue,actions);track.append(card);
  });
  deck.append(track);
  const nav=document.createElement('div');nav.className='vah-navigation';
  const prev=document.createElement('button');prev.type='button';prev.textContent='‹';prev.setAttribute('aria-label','Previous habit');
  const position=document.createElement('span');position.className='vah-position';position.setAttribute('aria-live','polite');
  const next=document.createElement('button');next.type='button';next.textContent='›';next.setAttribute('aria-label','Next habit');
  nav.append(prev,position,next);deck.append(nav);
  const feedback=document.createElement('p');feedback.className='vah-feedback';
  feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');deck.append(feedback);
  const cardList=Array.from(track.children);
  const current=()=>Math.max(0,cardList.findIndex(x=>Number(x.dataset.habitIndex)===selectedIndex));
  const jump=i=>{
   const target=cardList[Math.max(0,Math.min(i,cardList.length-1))];
   if(!target)return;
   selectedIndex=Number(target.dataset.habitIndex);
   track.scrollTo({left:target.offsetLeft-track.offsetLeft,behavior:'smooth'});
   updateNav();
  };
  function updateNav(){
   const i=current();
   position.textContent=(i+1)+' of '+items.length;
   prev.disabled=i===0;next.disabled=i===items.length-1;
  }
  prev.onclick=()=>jump(current()-1);next.onclick=()=>jump(current()+1);
  track.addEventListener('scroll',()=>{
   let closest=cardList[0],distance=Infinity;
   for(const card of cardList){
    const diff=Math.abs(card.offsetLeft-track.offsetLeft-track.scrollLeft);
    if(diff<distance){closest=card;distance=diff}
   }
   if(closest){selectedIndex=Number(closest.dataset.habitIndex);updateNav()}
  },{passive:true});
  track.addEventListener('keydown',e=>{
   if(e.key==='ArrowRight'){e.preventDefault();jump(current()+1)}
   if(e.key==='ArrowLeft'){e.preventDefault();jump(current()-1)}
  });
  const index=current();updateNav();
  requestAnimationFrame(()=>{
   const target=cardList[index];if(target)track.scrollLeft=target.offsetLeft-track.offsetLeft;
  });
 }
 render();
 window.addEventListener('vigor-local-changed',()=>queueMicrotask(()=>render()));
 window.addEventListener('vigor-sync-status',()=>queueMicrotask(()=>render()));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
 window.VigorAllHabits={todayHabits,refresh:render};
})();
