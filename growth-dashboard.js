/* Personal growth overview: read-only view of existing habits and rotation reflections. */
(()=>{'use strict';
 const byId=id=>document.getElementById(id);
 const todayKey=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const daysBefore=(date,n)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()-n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const classify=name=>{
   const s=String(name||'').toLowerCase();
   if(/\b(bible|scripture|pray|prayer|devotion|worship|faith)\b/.test(s))return 'Faith';
   if(/\b(nutrition|food|meal|protein|sleep|recovery|mobility|stretch|exercise|workout|run|walk|fitness|water|hydrate|health)\b/.test(s))return 'Health & wellness';
   if(/\b(read|book|study|learn|journal|course|language)\b/.test(s))return 'Learning';
   if(/\b(work|business|career|project|focus|productive|planning)\b/.test(s))return 'Work & purpose';
   if(/\b(family|spouse|partner|wife|husband|daughter|son|friend|marriage|relationship|connect)\b/.test(s))return 'Relationships';
   return 'Other habits';
 };
 function growthOverview(data,day){
   const labels=Array.isArray(data.habitLabels)?data.habitLabels:[];
   const rest=data.discipline?.restDays||{},records=data.dailyCheckins||{},minimums=data.discipline?.minimums||{};
   const valid=Array.from({length:16},(_,i)=>daysBefore(day,15-i))
     .filter(date=>!!records[date]?.saved&&!rest[date]);
   const groups=new Map();
   let full=0,minimum=0;
   labels.forEach((label,index)=>{
     let f=0,m=0;
     valid.forEach(date=>{
       if(records[date]?.habits?.[index])f++;
       else if(minimums[date]?.[index])m++;
     });
     full+=f;minimum+=m;
     const category=classify(label);
     if(!groups.has(category))groups.set(category,[]);
     groups.get(category).push({label,index,full:f,minimum:m});
   });
   const reviews=data.discipline?.reviews||{};
   const reflection=Object.keys(reviews)
     .filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&date<=day)
     .sort().reverse()
     .map(date=>({date,...(reviews[date]||{})}))
     .find(x=>x.win||x.obstacle||x.adjustment)||null;
   return {habitCount:labels.length,recordedDays:valid.length,full,minimum,
     groups:Array.from(groups,([name,habits])=>({name,habits})),
     reflection};
 }
 const clean=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const panel=byId('panel-progress');
 if(!panel)return;
 const card=document.createElement('section');card.id='vigorPersonalGrowth';card.className='vc-growth-card';
 panel.insertBefore(card,panel.firstChild);
 const style=document.createElement('style');
 style.textContent='.vc-growth-card{border:1px solid var(--border-strong);background:linear-gradient(135deg,var(--panel-alt),var(--panel));border-radius:18px;margin:8px 0 15px;padding:16px;color:var(--text-primary)}.vc-growth-card h2{font-size:22px;margin:6px 0}.vc-growth-card h3{font-size:15px;margin:12px 0 7px}.vc-growth-card p{font-size:13px;line-height:1.5;margin:7px 0}.vc-growth-eyebrow{color:var(--accent-soft);font-size:10px;font-weight:800;letter-spacing:1.5px}.vc-growth-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:13px 0}.vc-growth-stats>div{background:var(--input-bg);border:1px solid var(--border);padding:10px 6px;border-radius:11px;min-width:0}.vc-growth-stats strong{display:block;font-size:23px;color:var(--accent-soft)}.vc-growth-stats small{font-size:10px;line-height:1.3;color:var(--muted)}.vc-growth-card details{border-top:1px solid var(--border);padding:11px 0}.vc-growth-card summary{font-size:13px;color:var(--accent-soft);font-weight:750;cursor:pointer}.vc-growth-group{padding:9px 0;border-bottom:1px solid var(--border)}.vc-growth-habit{display:flex;justify-content:space-between;gap:9px;padding:7px 0;font-size:12px}.vc-growth-habit span{min-width:0;overflow-wrap:anywhere}.vc-growth-habit small{color:var(--muted);white-space:nowrap}.vc-growth-note{font-size:11px!important;color:var(--muted)}.vc-growth-review{padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--panel-alt)}.vc-growth-review button{padding:10px 12px;min-height:44px;background:var(--accent);border:0;border-radius:9px;color:var(--accent-contrast);font-weight:800;cursor:pointer}@media(max-width:440px){.vc-growth-stats strong{font-size:18px}.vc-growth-stats small{font-size:9px}.vc-growth-card{padding:13px}}';
 document.head.append(style);
 function render(){
   const bridge=window.vigorCloudBridge;
   if(typeof bridge?.read!=='function'){card.hidden=true;return}
   let data;try{data=bridge.read()}catch(e){card.hidden=true;return}
   if(!data||!Array.isArray(data.habitLabels)){card.hidden=true;return}
   const g=growthOverview(data,todayKey()),open=card.querySelector('.vc-growth-details')?.open||false;
   card.hidden=false;
   card.innerHTML=`<div class="vc-growth-eyebrow">PERSONAL GROWTH · LAST 16 DAYS</div>
     <h2>Growth beyond the checklist</h2>
     <p>See your intentional actions across different parts of life. These logs are not grades of your worth.</p>
     <div class="vc-growth-stats">
       <div><strong>${g.habitCount}</strong><small>Habits tracked</small></div>
       <div><strong>${g.recordedDays}</strong><small>Recorded days</small></div>
       <div><strong>${g.full}</strong><small>Full efforts</small></div>
       <div><strong>${g.minimum}</strong><small>Minimum efforts</small></div>
     </div>
     <details class="vc-growth-details" ${open?'open':''}>
       <summary>Explore my habit areas</summary>
       ${g.groups.length?g.groups.map(group=>`<div class="vc-growth-group"><h3>${clean(group.name)}</h3>${group.habits.map(item=>`<div class="vc-growth-habit"><span>${clean(item.label)}</span><small>${item.full} full · ${item.minimum} minimum</small></div>`).join('')}</div>`).join(''):'<p>Start by adding your first habit.</p>'}
       <p class="vc-growth-note">Areas are suggested from habit names, not a judgment of your life. Rest and unrecorded days are not scored.</p>
     </details>
     <div class="vc-growth-review">
       <h3>Latest rotation reflection</h3>
       ${g.reflection?`<p class="vc-growth-note">Review dated ${clean(g.reflection.date)}</p>
       ${g.reflection.win?'<p><strong>What worked:</strong> '+clean(g.reflection.win)+'</p>':''}
       ${g.reflection.obstacle?'<p><strong>Obstacle:</strong> '+clean(g.reflection.obstacle)+'</p>':''}
       ${g.reflection.adjustment?'<p><strong>Next adjustment:</strong> '+clean(g.reflection.adjustment)+'</p>':''}`:'<p class="vc-growth-note">Your saved reflection will appear here after your first rotation review.</p>'}
       <button id="growthOpenReview" type="button">Open rotation review</button>
     </div>`;
   card.querySelector('#growthOpenReview')?.addEventListener('click',()=>{
     const section=byId('disciplineReview');if(!section)return;
     section.querySelector('details')?.setAttribute('open','');
     section.scrollIntoView({behavior:'smooth',block:'start'});
   });
 }
 render();
 window.addEventListener('vigor-sync-status',render);
 document.addEventListener('change',()=>queueMicrotask(render));
 document.addEventListener('click',()=>queueMicrotask(render));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
 window.VigorGrowth={growthOverview,refresh:render};
})();
