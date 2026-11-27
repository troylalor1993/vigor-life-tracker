/* Five-destination navigation layered over the original app panels.
   Existing sections, controls and their event handlers remain intact. */
(()=>{'use strict';
 const old=document.getElementById('appTabs');
 if(!old||document.getElementById('vigorNav'))return;
 const icons={
  today:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  journey:'<path d="m4 7 8-4 8 4-8 4Z M4 12l8 4 8-4 M4 17l8 4 8-4"/>',
  growth:'<path d="M4 20V12M10 20V7M16 20V14M21 20V4"/>',
  fitness:'<path d="M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
 };
 const label={today:'Today',journey:'Journey',growth:'Growth',fitness:'Fitness',more:'More'};
 const svg=id=>'<svg aria-hidden="true" viewBox="0 0 24 24">'+icons[id]+'</svg>';
 const nav=document.createElement('nav');nav.id='vigorNav';nav.className='app-tabs';nav.setAttribute('aria-label','Main navigation');
 nav.innerHTML=Object.keys(label).map((route,i)=>'<button type="button" class="app-tab'+(!i?' active':'')+'" data-vigor-route="'+route+'" aria-current="'+(!i?'page':'false')+'">'+svg(route)+'<span>'+label[route]+'</span></button>').join('');
 const menu=document.createElement('div');menu.className='vigor-more-menu';menu.id='vigorMoreMenu';menu.hidden=true;
 menu.setAttribute('role','group');menu.setAttribute('aria-label','Other sections');
 menu.innerHTML=[['faith','Faith'],['rewards','Rewards'],['couples','Couples'],['settings','Settings']].map(([id,name])=>
  '<button type="button" data-vigor-old="'+id+'">'+name+'</button>').join('');
 nav.append(menu);
 old.after(nav);
 old.hidden=true;old.style.display='none';
 const moreButton=nav.querySelector('[data-vigor-route="more"]');
 moreButton.setAttribute('aria-expanded','false');
 moreButton.setAttribute('aria-controls','vigorMoreMenu');
 const style=document.createElement('style');
 style.textContent='#vigorNav{grid-template-columns:repeat(5,minmax(0,1fr))}.vigor-more-menu{position:absolute;z-index:110;right:8px;top:calc(100% + 8px);min-width:190px;padding:8px;display:grid;gap:4px;background:#201e1d;border:1px solid #81663d;border-radius:15px;box-shadow:0 15px 38px #000a}.vigor-more-menu[hidden]{display:none!important}.vigor-more-menu button{background:#2b2925;color:#f7f0e4;text-align:left;border:1px solid #544633;border-radius:10px;min-height:44px;padding:10px 14px;font:inherit;font-weight:700}.vigor-more-menu button:focus-visible{outline:3px solid var(--accent-soft);outline-offset:2px}@media(max-width:650px){#vigorNav{grid-template-columns:repeat(5,minmax(0,1fr))}.vigor-more-menu{position:fixed;top:auto;bottom:calc(87px + env(safe-area-inset-bottom));right:12px;min-width:180px;max-width:calc(100% - 24px)}}';
 document.head.append(style);
 const legacy=id=>old.querySelector('[data-panel="'+id+'"]');
 function closeMenu(){menu.hidden=true;moreButton.setAttribute('aria-expanded','false')}
 function setActive(route){
  nav.querySelectorAll('[data-vigor-route]').forEach(button=>{
    const active=button.dataset.vigorRoute===route;
    button.classList.toggle('active',active);
    button.setAttribute('aria-current',active?'page':'false');
  });
 }
 function openInToday(targetId){
  legacy('today')?.click();
  const target=document.getElementById(targetId);
  if(!target)return;
  const parent=target.closest('details');
  if(parent)parent.open=true;
  target.scrollIntoView({behavior:'smooth',block:'start'});
 }
 document.body.dataset.vigorView='today';
 function navigate(route){
  if(route==='more'){
    const open=menu.hidden;menu.hidden=!open;moreButton.setAttribute('aria-expanded',String(open));
    setActive('more');return;
  }
  closeMenu();
  if(route==='today'){legacy('today')?.click();window.scrollTo({top:0,behavior:'instant'})}
  else if(route==='journey'){
    legacy('today')?.click();
    window.scrollTo({top:0,behavior:'instant'});
  }
  else if(route==='growth'){
    legacy('progress')?.click();
    window.scrollTo({top:0,behavior:'instant'});
  }
  else if(route==='fitness'){
    legacy('today')?.click();
    if(!document.getElementById('vigorFitnessScreen')){
      const target=document.getElementById('training');const details=target?.closest('details');if(details)details.open=true;
    }
    window.scrollTo({top:0,behavior:'instant'});
  }
  document.body.dataset.vigorView=route;
  setActive(route);
 }
 nav.querySelectorAll('[data-vigor-route]').forEach(button=>button.onclick=()=>navigate(button.dataset.vigorRoute));
 menu.querySelectorAll('[data-vigor-old]').forEach(button=>button.onclick=()=>{
  const original=legacy(button.dataset.vigorOld);
  closeMenu();original?.click();document.body.dataset.vigorView='more';setActive('more');window.scrollTo({top:0,behavior:'instant'});
 });
 // Keep the visible tab selection accurate when existing in-app controls switch sections.
 old.querySelectorAll('[data-panel]').forEach(button=>button.addEventListener('click',()=>{
  const id=button.dataset.panel;
  document.body.dataset.vigorView=id==='today'?'today':id==='progress'?'growth':'more';
  setActive(id==='today'?'today':id==='progress'?'growth':'more');
  closeMenu();
 }));
 document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu()});
 document.addEventListener('click',event=>{if(!nav.contains(event.target))closeMenu()});
 window.VigorNavigate=navigate;
})();
