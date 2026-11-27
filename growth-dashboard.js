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
 window.VigorGrowth={growthOverview};
})();
