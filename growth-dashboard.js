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
     const archived=data.discipline?.settings?.[index]?.archivedAt;
     if(archived)return; // Active dashboard stays focused; archived history remains in the saved records.
     const settings=data.discipline?.settings?.[index]||{};
     const relevant=valid.filter(date=>(!settings.archivedAt||date<settings.archivedAt)
       &&!(settings.archivePeriods||[]).some(p=>p&&date>=p.start&&(!p.end||date<p.end)));
     let f=0,m=0;
     relevant.forEach(date=>{
       if(records[date]?.habits?.[index])f++;
       else if(minimums[date]?.[index])m++;
     });
     full+=f;minimum+=m;
     const category=classify(label);
     if(!groups.has(category))groups.set(category,[]);
     groups.get(category).push({label,index,full:f,minimum:m,opportunities:relevant.length});
   });
   const reviews=data.discipline?.reviews||{};
   const reflection=Object.keys(reviews)
     .filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&date<=day)
     .sort().reverse()
     .map(date=>({date,...(reviews[date]||{})}))
     .find(x=>x.win||x.obstacle||x.adjustment)||null;
   return {habitCount:labels.filter((_,i)=>!data.discipline?.settings?.[i]?.archivedAt).length,recordedDays:valid.length,full,minimum,
     groups:Array.from(groups,([name,habits])=>({name,habits})),
     reflection};
 }
 const clean=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const panel=byId('panel-progress');
 if(!panel)return;
 const card=document.createElement('section');card.id='vigorPersonalGrowth';card.className='vc-growth-card';
 (byId('progressReports')||panel).append(card);
 const style=document.createElement('style');
 style.textContent='.vc-growth-card{border:1px solid var(--border-strong);background:linear-gradient(135deg,var(--panel-alt),var(--panel));border-radius:18px;margin:8px 0 15px;padding:16px;color:var(--text-primary)}.vc-growth-card h2{font-size:22px;margin:6px 0}.vc-growth-card h3{font-size:15px;margin:12px 0 7px}.vc-growth-card p{font-size:13px;line-height:1.5;margin:7px 0}.vc-growth-eyebrow{color:var(--accent-soft);font-size:10px;font-weight:800;letter-spacing:1.5px}.vc-growth-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:13px 0}.vc-growth-stats>div{background:var(--input-bg);border:1px solid var(--border);padding:10px 6px;border-radius:11px;min-width:0}.vc-growth-stats strong{display:block;font-size:23px;color:var(--accent-soft)}.vc-growth-stats small{font-size:10px;line-height:1.3;color:var(--muted)}.vc-growth-card details{border-top:1px solid var(--border);padding:11px 0}.vc-growth-card summary{font-size:13px;color:var(--accent-soft);font-weight:750;cursor:pointer}.vc-growth-group{padding:9px 0;border-bottom:1px solid var(--border)}.vc-growth-habit{display:flex;justify-content:space-between;gap:9px;padding:7px 0;font-size:12px}.vc-growth-habit span{min-width:0;overflow-wrap:anywhere}.vc-growth-habit small{color:var(--muted);white-space:nowrap}.vc-growth-note{font-size:11px!important;color:var(--muted)}.vc-growth-review{padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--panel-alt)}.vc-growth-review button{padding:10px 12px;min-height:44px;background:var(--accent);border:0;border-radius:9px;color:var(--accent-contrast);font-weight:800;cursor:pointer}@media(max-width:440px){.vc-growth-stats strong{font-size:18px}.vc-growth-stats small{font-size:9px}.vc-growth-card{padding:13px}}';
 style.textContent += '.vc-life-areas{margin:14px 0}.vc-life-areas h3{font-size:16px;margin:14px 0 11px}.vc-life-area{border:1px solid var(--border);background:linear-gradient(125deg,#302a22,#232426);padding:13px 14px;border-radius:14px;margin-bottom:9px}.vc-life-area-top{display:flex;justify-content:space-between;align-items:center;gap:10px}.vc-life-area-top strong{font-size:13px;color:var(--text-primary)}.vc-life-area-top span{color:var(--accent-soft);font-size:12px;font-weight:750;white-space:nowrap}.vc-life-area small{font-size:11px;color:var(--muted)}.vc-life-meter{margin:10px 0 6px;height:7px;background:#4b4032;overflow:hidden;border-radius:20px}.vc-life-meter span{display:block;height:100%;background:linear-gradient(90deg,#c69342,#f7d991);border-radius:20px}';
 style.textContent += '.vc-growth-habit{align-items:center}.vc-growth-habit .vc-open-habit{flex:none;min-height:40px;padding:8px 12px;border:1px solid var(--border-strong);border-radius:10px;background:var(--panel-alt);color:var(--accent-soft);font-weight:750;font-size:12px}.vc-growth-habit .vc-open-habit:focus-visible{outline:3px solid var(--accent-soft);outline-offset:2px}@media(max-width:440px){.vc-growth-habit{flex-wrap:wrap}.vc-growth-habit>span{flex:1 1 100%}.vc-growth-habit small{flex:1}}';
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
     <p>See your current habits across different parts of life. Archived habits are preserved in your history but hidden from active progress.</p>
     <div class="vc-growth-stats">
       <div><strong>${g.habitCount}</strong><small>Habits tracked</small></div>
       <div><strong>${g.recordedDays}</strong><small>Recorded days</small></div>
       <div><strong>${g.full}</strong><small>Full efforts</small></div>
       <div><strong>${g.minimum}</strong><small>Minimum efforts</small></div>
     </div>
     <div class="vc-life-areas" aria-label="Habit areas based on logged actions">
       <h3>Your life areas</h3>
       ${g.groups.length?g.groups.map(group=>{
        const count=group.habits.reduce((n,x)=>n+x.full+x.minimum,0);
        const total=group.habits.reduce((sum,h)=>sum+(h.opportunities??g.recordedDays),0);
        const pct=total?Math.round(count*100/total):null;
        return `<div class="vc-life-area"><div class="vc-life-area-top"><strong>${clean(group.name)}</strong><span>${pct===null?'No check-ins':pct+'% followed'}</span></div>
         <div class="vc-life-meter" role="progressbar" aria-label="${clean(group.name)} habit follow-through" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct??0}"><span style="width:${pct??0}%"></span></div>
         <small>${group.habits.length} habit(s) · ${count} recorded full/minimum efforts</small></div>`;
       }).join(''):'<p class="vc-growth-note">Choose a habit to begin tracking progress across life areas.</p>'}
       <p class="vc-growth-note">Percentages show how often selected habits were recorded on logged non-rest days. They do not measure your worth, spiritual growth, or overall health.</p>
     </div>
     <details class="vc-growth-details" ${open?'open':''}>
       <summary>Explore my habit areas</summary>
       ${g.groups.length?g.groups.map(group=>`<div class="vc-growth-group"><h3>${clean(group.name)}</h3>${group.habits.map(item=>`<div class="vc-growth-habit"><span>${clean(item.label)}</span><small>${item.full} full · ${item.minimum} minimum</small><button type="button" class="vc-open-habit" data-growth-habit="${item.index}" aria-label="Open ${clean(item.label)} in Journey">Open</button></div>`).join('')}</div>`).join(''):'<p>Start by adding your first habit.</p>'}
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
   card.querySelectorAll('[data-growth-habit]').forEach(button=>button.addEventListener('click',()=>{
     const index=Number(button.dataset.growthHabit);
     if(!window.VigorJourneyManager?.showHabit?.(index)){
       document.querySelector('#vigorNav [data-vigor-route="journey"]')?.click();
     }
   }));
   card.querySelector('#growthOpenReview')?.addEventListener('click',()=>{
     const section=byId('disciplineReview');if(!section)return;
     const reports=section.closest('#progressReports');if(reports)reports.open=true;
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
