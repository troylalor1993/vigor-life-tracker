/* The Today checklist uses the shared habit check-in records. */
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
 deck.setAttribute('aria-label','Today’s habits');
 anchor.before(deck);
 const read=()=>{try{return window.vigorCloudBridge?.read?.()}catch{return null}};
 function make(tag,text,cls){
  const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;
 }
 function render(){
  const data=read();if(!data||!Array.isArray(data.habitLabels)){deck.hidden=true;return}
  const items=todayHabits(data,key());
  deck.hidden=false;
  const heading=make('div','','vah-heading');
  const counter=make('span',items.filter(item=>item.status==='full').length+' of '+items.length+' done','vah-count');
  counter.setAttribute('aria-live','polite');
  heading.append(make('h2','Today’s habits'),counter);
  const list=make('ul','','vah-track');list.id='vigorHabitsTrack';
  const feedback=make('p','','vah-feedback');feedback.setAttribute('role','status');
  for(const item of items){
   const row=make('li','','vah-card');
   row.dataset.habitIndex=String(item.index);row.dataset.status=item.status;
   const actions=make('div','','vah-actions');
   for(const [mode,label] of [['full','Done'],['minimum','Small step']]){
    const checked=item.status===(mode==='full'?'full':'min');
    const button=make('button',checked?'✓ '+label:label,'vah-action');
    button.type='button';button.dataset.mode=mode;
    button.setAttribute('aria-pressed',String(checked));button.setAttribute('aria-label',label+' for '+item.name);
    if(mode==='minimum')button.title=item.minimum;
    button.onclick=()=>{
     try{
      if(window.vigorCloudBridge.recordJourneyHabit(item.index,mode))render();
     }catch(error){feedback.textContent=String(error?.message||'Could not save this habit.')}
    };
    actions.append(button);
   }
   const label=make('div','');
   label.append(make('h3',item.name));
   const smallStep=data.discipline?.settings?.[item.index]?.minimum;
   if(smallStep)label.append(make('small',smallStep,'vah-step'));
   row.append(label,actions);list.append(row);
  }
  const manage=make('button',items.length?'Manage habits':'Add a habit','secondary vah-manage');
  manage.type='button';manage.onclick=()=>window.VigorNavigate?.('journey');
  deck.replaceChildren(heading,list,manage,feedback);
 }
 render();
 window.addEventListener('vigor-local-changed',()=>queueMicrotask(render));
 window.addEventListener('vigor-sync-status',()=>queueMicrotask(render));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
 window.VigorAllHabits={todayHabits,refresh:render};
})();
