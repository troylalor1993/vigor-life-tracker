/* Vigor Life - honest, accessible save-state badge.
   Never infers confirmed cloud saves from a local write. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const target=$('globalSaveStatus');if(!target)return;
 const button=document.createElement('button');
 button.type='button';button.id='vigorSyncBadge';button.className='vigor-sync-badge';
 button.setAttribute('aria-label','View saving and cloud synchronization details');
 target.after(button);
 const style=document.createElement('style');
 style.textContent='.vigor-sync-badge{display:inline-flex;align-items:center;gap:7px;margin:7px 0 9px;min-height:37px;padding:8px 12px;border-radius:999px;background:#292821;color:#f6ead1;border:1px solid #6e5940;font-size:12px;font-weight:750;line-height:1.3;text-align:left}.vigor-sync-badge:before{content:"";display:block;flex:none;width:7px;height:7px;border-radius:50%;background:#b2a58b}.vigor-sync-badge[data-state="synced"]:before{background:#a5deb0}.vigor-sync-badge[data-state="pending"]:before{background:#f2c46a}.vigor-sync-badge[data-state="warning"]:before{background:#f6a595}.vigor-sync-badge:focus-visible{outline:3px solid #f4d995;outline-offset:2px}.vigor-sync-badge:hover{border-color:#d9b875}@media(max-width:650px){.vigor-sync-badge{width:auto;max-width:100%;font-size:11px;margin:6px 0 9px}}';
 document.head.append(style);
 function linked(){try{return !!localStorage.getItem('vigor-cloud-linked-user')}catch(e){return false}}
 function pending(){try{return localStorage.getItem('vigor-cloud-pending')==='yes'}catch(e){return false}}
 function describe(status,linkedAccount,pendingEdits,online){
   if(status==='Saved to cloud'&&!pendingEdits)return {text:'Cloud backup confirmed',type:'synced'};
   if(status==='Offline'||online===false)return {text:linkedAccount?'Offline · saved on device':'Saved on this device',type:linkedAccount?'warning':'local'};
   if(['Retry needed','Connection issue','Upload failed','Sign-in failed'].includes(status))return {text:'Cloud needs attention',type:'warning'};
   if(['Checking','Syncing','Sync pending','Restoring','Choose a copy','Signing in'].includes(status)||pendingEdits)return {text:linkedAccount?'Saved locally · cloud pending':'Cloud setup not finished',type:'pending'};
   if(!linkedAccount)return {text:'Saved on this device',type:'local'};
   return {text:'Cloud status not confirmed',type:'pending'};
 }
 let lastStatus='';
 function display(status=lastStatus){
   lastStatus=status;
   const view=describe(lastStatus,linked(),pending(),navigator.onLine);
   button.textContent=view.text;button.dataset.state=view.type;
   button.title='Open Account & Automatic Sync for details';
 }
 button.addEventListener('click',()=>{
   const more=$('vigorNav')?.querySelector('[data-vigor-route="more"]');
   if(more)more.click();
   const settings=$('vigorMoreMenu')?.querySelector('[data-vigor-old="settings"]');
   if(settings)settings.click();
   else $('appTabs')?.querySelector('[data-panel="settings"]')?.click();
   const section=$('cloudSync');
   section?.scrollIntoView({behavior:'smooth',block:'start'});
 });
 window.addEventListener('vigor-local-changed',()=>display('Local change'));
 window.addEventListener('vigor-sync-status',event=>display(String(event.detail?.label||'')));
 window.addEventListener('vigor-cloud-unlinked',()=>display('Not connected'));
 window.addEventListener('online',()=>display('Online'));
 window.addEventListener('offline',()=>display('Offline'));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)display()});
 display();
 window.VigorSyncBadge={describe,refresh:display};
})();
