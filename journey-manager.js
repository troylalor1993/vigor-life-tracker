/* The Vigor Life: manage and practise all habits in one Journey page.
   Existing habit records, cue settings and save/sync mechanisms are reused. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 let editorOpen=false,editingIndex=null,selectedIndex=0,view='all',recoveryIndex=null;
 let recoveryDraft={obstacle:'time',nextStep:''};
 let draft={kind:'build',name:'',cue:'',minimum:'',identity:'',plan:''};
 let notice='';
 const getData=()=>{try{return window.vigorCloudBridge?.read?.()}catch(e){return null}};
 const mk=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
 function navigate(route){document.querySelector('#vigorNav [data-vigor-route="'+route+'"]')?.click()}
 function openHabitEditor(){
  navigate('today');
  const daily=$('daily'),wrapper=daily?.closest('details');
  if(wrapper)wrapper.open=true;
  const editor=$('habitEditor');
  if(editor?.classList.contains('hidden'))$('editHabits')?.click();
  daily?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function openForm(index,data){
  editingIndex=Number.isInteger(index)?index:null;
  const existing=editingIndex===null?null:data.discipline?.settings?.[editingIndex]||{};
  draft=editingIndex===null?{kind:'build',name:'',cue:'',minimum:'',identity:'',plan:''}:{
    kind:existing.kind==='replace'?'replace':'build',
    name:data.habitLabels[editingIndex]||'',cue:existing.cue||'',
    minimum:existing.minimum||'',identity:existing.identity||'',plan:existing.plan||''
  };
  editorOpen=true;recoveryIndex=null;notice='';render();
  $('vjmName')?.focus();
 }
 function recordHabit(index,mode){
  try{
    window.vigorCloudBridge.recordJourneyHabit(index,mode);
    notice=mode==='full'?'Full action recorded for today.':'Minimum effort recorded for today.';
    render();
  }catch(error){notice=String(error?.message||'Could not record this action.');render()}
 }
 function gentleSuggestion(obstacle){
  const advice={
   time:'Do the two-minute version at my next reliable opportunity.',
   energy:'Rest first, then try the smallest helpful action.',
   forgot:'Put a visible reminder beside something I already use.',
   environment:'Prepare what I need before the cue arrives.',
   motivation:'Begin with just one small action, even if I do not feel ready.',
   other:'Make my next attempt easier with one small change.'
  };
  return advice[obstacle]||advice.other;
 }
 function openRecovery(index,data){
  const existing=data.discipline?.settings?.[index]?.recovery;
  recoveryIndex=index;editorOpen=false;selectedIndex=index;
  recoveryDraft={obstacle:existing?.obstacle||'time',nextStep:existing?.nextStep||''};
  notice='';render();
  $('vjmRecoveryStep')?.focus();
 }
 function enhanceJourney(){
  const root=$('vigorJourneyScreen');if(!root)return null;
  root.querySelector('#vigorJourneyManager')?.remove();
  const existingSteps=root.querySelector('.vjm-steps');
  if(existingSteps){const old=existingSteps.querySelector('.vigor-steps');if(old)existingSteps.before(old);existingSteps.remove()}
  const originalPicker=root.querySelector('.vigor-habit-select');
  if(originalPicker)originalPicker.hidden=true;
  // The five-stage educational guide is still available, but it no longer dominates the page.
  const steps=root.querySelector('.vigor-steps');
  if(steps){
    const section=mk('details','vjm-steps');const summary=mk('summary','', 'How habit-building works — 5 steps');
    section.append(summary);steps.before(section);section.append(steps);
  }
  const manager=mk('section','vjm-manager');manager.id='vigorJourneyManager';
  const header=root.querySelector('.vigor-screen-header');
  if(header)header.after(manager);else root.prepend(manager);
  return manager;
 }
 function render(){
  const root=$('vigorJourneyScreen'),data=getData();
  if(!root||!data||!Array.isArray(data.habitLabels))return;
  const manager=enhanceJourney();if(!manager)return;
  const heading=mk('div','vjm-title');
  const left=mk('div');
  left.append(mk('div','vigor-eyebrow','YOUR HABITS'),mk('h3','', 'Build better habits'));
  left.append(mk('p','','Start something good or replace a habit you want to leave behind.'));
  const add=mk('button','vjm-add','+ Add a habit');add.type='button';
  add.onclick=()=>{editorOpen=false;openForm(null,data)};
  heading.append(left,add);manager.append(heading);
  const days=Array.from({length:16},(_,j)=>{
    const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-15+j);
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  }).filter(day=>data.dailyCheckins?.[day]?.saved&&!data.discipline?.restDays?.[day]);
  // Exactly the same daily priorities and order used by Today (including defaults).
  const priorities=window.VigorDailyFocus?.focusFor?.(data,localDate())?.priorities||[];
  const focusIndexes=new Set(priorities.filter(key=>/^h:\\d+$/.test(key))
    .map(key=>Number(key.slice(2))));
  const visible=data.habitLabels.map((name,index)=>{
    const settings=data.discipline?.settings?.[index]||{};
    const full=days.filter(day=>!!data.dailyCheckins?.[day]?.habits?.[index]).length;
    const minimum=days.filter(day=>!data.dailyCheckins?.[day]?.habits?.[index]&&!!data.discipline?.minimums?.[day]?.[index]).length;
    return {name,index,kind:settings.kind==='replace'?'replace':'build',full,minimum,
      rate:days.length?Math.round((full+minimum)*100/days.length):null};
  }).filter(item=>view==='all'||view==='focus'&&focusIndexes.has(item.index)
     ||view==='build'&&item.kind==='build'||view==='replace'&&item.kind==='replace')
    .sort((a,b)=>view==='focus'?priorities.indexOf('h:'+a.index)-priorities.indexOf('h:'+b.index):a.index-b.index);
  const tabs=mk('div','vjm-filters');
  for(const [key,label] of [['all','All habits'],['focus','My focus'],['build','Building'],['replace','Replacing']]){
    const button=mk('button',view===key?'vjm-filter active':'vjm-filter',label);
    button.type='button';button.setAttribute('aria-pressed',String(view===key));
    button.onclick=()=>{view=key;render()};
    tabs.append(button);
  }
  manager.append(tabs);
  const summary=mk('p','vjm-filter-summary',
    view==='focus'?'The habit priorities shown on Today, in the same order. Workouts remain under Fitness.':
    view==='replace'?'A positive action to practise when an unwanted pattern appears.':
    view==='build'?'Good routines that you are growing one step at a time.':
    'All your habits in one place. Choose a smaller view when you want less to look at.');
  manager.append(summary);
  if(data.habitLabels.length){
    const grid=mk('div','vjm-list');
    const entry=data.dailyCheckins?.[localDate()]||{};
    const mins=data.discipline?.minimums?.[localDate()]||{};
    visible.forEach(({name,index:i,full:recentFull,minimum:recentMinimum,rate})=>{
      const settings=data.discipline?.settings?.[i]||{};
      const row=mk('div','vjm-item'+(selectedIndex===i?' vjm-selected':''));
      const info=mk('div','vjm-item-info');
      const top=mk('div','vjm-item-title');
      top.append(mk('strong','',name),mk('span','vjm-kind',settings.kind==='replace'?'Replacing':'Building'));
      info.append(top, mk('small','',entry.habits?.[i]?'✓ Full effort today':mins[i]?'◐ Minimum effort today':settings.minimum?'Small step: '+settings.minimum:'Not started today'));
      info.append(mk('small','vjm-trend',
        rate===null?'No recent check-ins yet':rate+'% followed on '+days.length+' recorded non-rest day(s)'));
      if(settings.kind==='replace'&&settings.plan)info.append(mk('small','vjm-plan','When it gets difficult: '+settings.plan));
      if(settings.recovery?.nextStep)info.append(mk('small','vjm-recovery-note','Next easier step: '+settings.recovery.nextStep));
      const actions=mk('div','vjm-item-actions');
      const full=mk('button','vjm-done'+(entry.habits?.[i]?' vjm-pressed':''),'Done');
      full.type='button';full.setAttribute('aria-label','Record full effort for '+name);full.setAttribute('aria-pressed',String(!!entry.habits?.[i]));
      full.onclick=()=>{selectedIndex=i;recordHabit(i,'full')};
      const min=mk('button','vjm-min'+(mins[i]?' vjm-pressed':''),'Minimum');
      min.type='button';min.setAttribute('aria-label','Record minimum effort for '+name);min.setAttribute('aria-pressed',String(!!mins[i]&&!entry.habits?.[i]));
      min.onclick=()=>{selectedIndex=i;recordHabit(i,'minimum')};
      const edit=mk('button','vjm-edit','Edit');edit.type='button';edit.setAttribute('aria-label','Edit '+name);
      edit.onclick=()=>{selectedIndex=i;openForm(i,data)};
      const adjust=mk('button','vjm-adjust','Adjust');
      adjust.type='button';adjust.setAttribute('aria-label','Adjust '+name+' after an obstacle');
      adjust.onclick=()=>openRecovery(i,data);
      actions.append(full,min,edit,adjust);row.append(info,actions);grid.append(row);
    });
    if(!visible.length)grid.append(mk('p','vjm-empty','No habits in this view yet. Try All habits or add one.'));
    manager.append(grid);
  }else manager.append(mk('p','vjm-empty','No habits yet. Add one to begin.'));
  const manage=mk('button','vjm-manage','Rearrange or remove habits');
  manage.type='button';manage.onclick=openHabitEditor;manager.append(manage);
  if(recoveryIndex!==null&&recoveryIndex<data.habitLabels.length){
    const name=data.habitLabels[recoveryIndex];
    const form=mk('form','vjm-recovery-form');form.id='vigorJourneyRecovery';form.noValidate=true;
    form.append(mk('div','vigor-eyebrow','ADJUST, NOT RESTART'));
    form.append(mk('h3','', 'Make '+name+' easier'));
    form.append(mk('p','vjm-helper','A difficult day is information, not failure. Keep every past check-in and choose just one helpful adjustment.'));
    const field=mk('label','vjm-field');
    field.append(mk('span','','What got in the way?'));
    const select=mk('select','');select.id='vjmRecoveryObstacle';select.name='obstacle';
    const obstacles=[
     ['time','Not enough time'],['energy','Tired or needed recovery'],
     ['forgot','Forgot'],['environment','Environment or distractions'],
     ['motivation','Hard to get started'],['other','Something else']
    ];
    obstacles.forEach(([key,label])=>{const opt=mk('option','',label);opt.value=key;select.append(opt)});
    select.value=recoveryDraft.obstacle;
    select.onchange=()=>{
      const prior=gentleSuggestion(recoveryDraft.obstacle);
      const canSuggest=!recoveryDraft.nextStep||recoveryDraft.nextStep===prior;
      recoveryDraft.obstacle=select.value;
      if(canSuggest){recoveryDraft.nextStep=gentleSuggestion(select.value);$('vjmRecoveryStep').value=recoveryDraft.nextStep}
    };
    field.append(select);form.append(field);
    const next=mk('label','vjm-field');
    next.append(mk('span','','One easier action for next time'));
    const step=mk('input','');step.type='text';step.id='vjmRecoveryStep';
    step.name='nextStep';step.maxLength=180;step.required=true;
    step.value=recoveryDraft.nextStep;step.placeholder=gentleSuggestion(recoveryDraft.obstacle);
    step.oninput=()=>{recoveryDraft.nextStep=step.value};
    next.append(step);form.append(next);
    const actions=mk('div','vjm-form-actions');
    const save=mk('button','vjm-save','Save adjustment');save.type='submit';
    const cancel=mk('button','vjm-cancel','Cancel');cancel.type='button';
    cancel.onclick=()=>{recoveryIndex=null;notice='';render()};
    actions.append(save,cancel);form.append(actions);
    form.onsubmit=event=>{
      event.preventDefault();
      try{
       window.vigorCloudBridge.saveJourneyRecovery({index:recoveryIndex,...recoveryDraft});
       recoveryIndex=null;notice='✓ Your next step is saved. Your earlier progress remains unchanged.';
       render();
      }catch(error){notice=String(error?.message||'Could not save this adjustment.');render()}
    };
    manager.append(form);
  }
  if(editorOpen){
    const form=mk('form','vjm-form');form.id='vigorJourneyForm';form.noValidate=true;
    const title=mk('h3','',editingIndex===null?'Add a habit':'Edit this habit');form.append(title);
    const kind=mk('fieldset','vjm-kind-picker');kind.append(mk('legend','','What are you working on?'));
    for(const [value,label] of [['build','Build a new habit'],['replace','Replace an unwanted habit']]){
      const choice=mk('label','vjm-choice'),input=mk('input');
      input.type='radio';input.name='kind';input.value=value;input.checked=draft.kind===value;
      input.onchange=()=>{draft.kind=value;render();$('vjmName')?.focus()};
      choice.append(input,mk('span','',label));kind.append(choice);
    }
    form.append(kind);
    const helper=mk('p','vjm-helper',draft.kind==='replace'
      ?'Describe the better action you want to take (for example, “Choose water instead of soda”). Track the replacement action—not a claim of perfect abstinence.'
      :'Describe one action you want to repeat (for example, “Read 10 pages”).');
    form.append(helper);
    const fields=[
      ['name',draft.kind==='replace'?'My replacement action':'Habit I want to build','e.g. Read one chapter',70,true],
      ['minimum','My smallest doable step','e.g. Read one page',150,true],
      ['cue','When will I do it? (optional)','e.g. After breakfast',150,false],
      ['identity','Why this matters (optional)','e.g. I am a lifelong learner',150,false],
      ...(draft.kind==='replace'?[['plan','What will I do when the urge shows up? (optional)','e.g. When I want soda, I will choose water first',180,false]]:[])
    ];
    fields.forEach(([key,label,placeholder,max,required])=>{
      const field=mk('label','vjm-field');const input=mk('input');input.id=key==='name'?'vjmName':'vjm'+key;
      input.name=key;input.type='text';input.maxLength=max;input.value=draft[key]||'';
      input.placeholder=placeholder;input.required=required;input.oninput=()=>{draft[key]=input.value};
      field.append(mk('span','',label),input);form.append(field);
    });
    const controls=mk('div','vjm-form-actions');
    const save=mk('button','vjm-save',editingIndex===null?'Add habit':'Save changes');save.type='submit';
    const cancel=mk('button','vjm-cancel','Cancel');cancel.type='button';cancel.onclick=()=>{editorOpen=false;notice='';render()};
    controls.append(save,cancel);form.append(controls);
    form.onsubmit=e=>{
      e.preventDefault();
      const bridge=window.vigorCloudBridge;
      try{
        const index=editingIndex===null?bridge.addJourneyHabit({...draft}):editingIndex;
        if(editingIndex!==null)bridge.updateJourneyHabit({index,...draft});
        selectedIndex=index;view='all';editorOpen=false;notice='✓ Saved on this device. Cloud status appears above.';
        // The legacy renderer updates all connected modules.
        window.VigorPremiumScreens?.selectHabit?.(index);render();
      }catch(error){notice=String(error?.message||'Could not save. Please try again.');render()}
    };
    manager.append(form);
  }
  const feedback=mk('p','vjm-feedback',notice);feedback.id='vigorJourneyFeedback';
  feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');manager.append(feedback);
 }
 function localDate(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
 render();
 window.addEventListener('vigor-local-changed',()=>queueMicrotask(render));
 window.addEventListener('vigor-sync-status',()=>queueMicrotask(render));
 document.addEventListener('change',e=>{
  if(e.target?.closest?.('#vigorJourneyManager'))return;
  queueMicrotask(render);
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
 window.VigorJourneyManager={refresh:render,showHabit:index=>{
   const data=getData();
   if(!data||!Number.isInteger(index)||index<0||index>=data.habitLabels.length)return false;
   selectedIndex=index;view='all';editorOpen=false;recoveryIndex=null;render();
   document.querySelector('#vigorNav [data-vigor-route="journey"]')?.click();
   const item=Array.from($('vigorJourneyManager')?.querySelectorAll('.vjm-item')||[])[index];
   item?.scrollIntoView({behavior:'smooth',block:'center'});
   return true;
 }};
})();
