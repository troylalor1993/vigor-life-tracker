// Browser-level smoke tests for the Vigor Life premium experience.
// Run after installing Playwright + Chromium: node tests/ui-smoke.test.cjs
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain'}).end(data)
 });
});
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
   for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
     const context=await browser.newContext({viewport});
     const page=await context.newPage();
     const errors=[];
     page.on('pageerror',err=>errors.push(err.message));
     await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
     await page.locator('#vigorNav').waitFor({state:'visible',timeout:12000});
     const artwork=await page.locator('.app-header').evaluate(el=>getComputedStyle(el).backgroundImage);
     assert(artwork.includes('vigor-sunrise.svg'),'premium sunrise artwork applied');
     const artResponse=await page.request.get('http://127.0.0.1:'+port+'/vigor-sunrise.svg');
     assert.equal(artResponse.status(),200,'sunrise artwork served');
     assert.equal(await page.locator('#vigorNav [data-vigor-route]').count(),5,'five primary destinations');
     assert.equal(await page.locator('#big3Panel').isVisible(),true,'Today priorities visible');
     assert.equal(await page.locator('#vigorDailyFocus').isVisible(),true,'Next Small Win hero visible');
     assert.equal(await page.locator('#vigorStartGuide').isVisible(),true,'First-run guide visible without saved history');
     const nextName=await page.locator('#vigorDailyFocus h2').textContent();
     const selectedRow=page.locator('#big3List .big3-row').filter({hasText:nextName}).first();
     assert.equal(await page.locator('#vigorDailyFocus [data-focus-complete]').isVisible(),true,'one-tap Done action available');
     assert.equal(await page.locator('#vigorDailyFocus [data-focus-minimum]').isVisible(),true,'one-tap Minimum action available');
     await page.locator('#vigorDailyFocus [data-focus-complete]').click();
     assert.equal(await selectedRow.locator('button').filter({hasText:/^Done$/}).getAttribute('aria-pressed'),'true','one-tap Done records through existing Big 3');
     await selectedRow.locator('button').filter({hasText:/^Done$/}).click();
     assert.equal(await selectedRow.locator('button').filter({hasText:/^Done$/}).getAttribute('aria-pressed'),'false','existing Big 3 can undo a completed action');
     await page.locator('#vigorDailyFocus [data-focus-minimum]').click();
     assert.equal(await selectedRow.locator('button').filter({hasText:/^Minimum$/}).getAttribute('aria-pressed'),'true','one-tap Minimum records a smaller action');
     await selectedRow.locator('button').filter({hasText:/^Minimum$/}).click();
     await page.locator('#vigorDailyFocus [data-focus-open]').click();
     assert.equal(await page.locator('#big3Panel').isVisible(),true,'Next Small Win action leads to priorities');
     await page.locator('#vigorNav [data-vigor-route="journey"]').click();
     assert.equal(await page.locator('#vigorJourneyScreen').isVisible(),true,'Dedicated Journey view visible');
     assert.equal(await page.locator('#globalSaveStatus').isVisible(),false,'duplicate legacy save text hidden');
     assert.equal(await page.locator('#vigorSyncBadge').isVisible(),true,'single trustworthy save badge remains visible');
     assert.equal(await page.locator('.app-header h1').isVisible(),false,'secondary-screen header is compact');

     assert.equal(await page.locator('#vigorJourneyScreen .vigor-step').count(),5,'Five guided habit steps');
     assert.equal(await page.locator('#panel-today').isVisible(),false,'Today panel hidden while in Journey');
     await page.locator('#vigorNav [data-vigor-route="growth"]').click();
     assert.equal(await page.locator('#vigorPersonalGrowth').isVisible(),true,'Growth visible');
     assert((await page.locator('#vigorPersonalGrowth .vc-life-area').count())>0,'Life-area progress tiles rendered');
     assert.equal(await page.locator('#vigorRotationRecap').isVisible(),true,'Rotation recap visible in Growth');
     await page.locator('#vigorNav [data-vigor-route="fitness"]').click();
     assert.equal(await page.locator('#vigorFitnessScreen').isVisible(),true,'Dedicated Fitness screen visible');
     assert.equal(await page.locator('#vigorFitnessOpen').isVisible(),true,'Workout checklist action visible');
     await page.locator('#vigorNav [data-vigor-route="more"]').click();
     assert.equal(await page.locator('#vigorMoreMenu').isVisible(),true,'More menu visible');
     await page.locator('#vigorMoreMenu [data-vigor-old="faith"]').click();
     assert.equal(await page.locator('#panel-faith').isVisible(),true,'Faith remains reachable');
     await page.locator('#vigorNav [data-vigor-route="today"]').click();
     assert.equal(await page.locator('#big3Panel').isVisible(),true,'Return to Today');
     assert.equal(await page.locator('.app-header h1').isVisible(),true,'Today retains full heading');
     assert.equal(await page.locator('#vigorJourneyScreen').isVisible(),false,'Journey hidden when returning Today');
     // A local habit check must survive a complete browser reload even without signing in.
     await page.locator('#vigorSyncBadge').waitFor({state:'visible'});
     assert.equal(await page.locator('#vigorSyncBadge').textContent(),'Saved on this device','signed-out account is not labeled cloud-synced');
     const firstPriority=page.locator('#big3List .big3-row').first();
     await firstPriority.locator('button').filter({hasText:/^Done$/}).click();
     const saved=await page.evaluate(()=>{
       const raw=localStorage.getItem('vigor-tracker');
       if(!raw)return null;
       const state=JSON.parse(raw);
       return {state,raw};
     });
     assert(saved?.state,'local tracker state persisted');
     assert(saved.state.dailyCheckins&&Object.values(saved.state.dailyCheckins).some(x=>x.saved&&x.habits?.some(Boolean))||
       saved.state.completions?.length>0,'habit or workout completion persisted');
     await page.reload({waitUntil:'domcontentloaded'});
     await page.locator('#vigorNav').waitFor({state:'visible'});
     assert.equal(await page.locator('#big3List .big3-row').first().locator('button').filter({hasText:/^Done$/}).getAttribute('aria-pressed'),'true','completed priority survives reload');
     assert.equal(await page.locator('#vigorSyncBadge').textContent(),'Saved on this device','reload does not claim cloud confirmation');
     await page.locator('#vigorSyncBadge').click();
     assert.equal(await page.locator('#cloudSync').isVisible(),true,'save status opens Account & Automatic Sync');
     assert.equal(await page.locator('#cloudResetPassword').isVisible(),true,'Forgot password action available to signed-out users');
     assert.equal(await page.locator('#cloudResetFeedback').getAttribute('role'),'status','password reset has accessible status feedback');
     // Every selectable palette must reach the premium header, journey, growth,
     // fitness, navigation, and accent buttons rather than only the Settings card.
     const palettes=[
       ['Black & Gold',''],['Midnight Blue','midnight'],['Forest Green','forest'],
       ['Burgundy','burgundy'],['Graphite','graphite'],['Dark Copper','copper']
     ];
     const signatures=new Set();
     for(const [label,theme] of palettes){
       await page.locator('#vigorNav [data-vigor-route="more"]').click();
       await page.locator('#vigorMoreMenu [data-vigor-old="settings"]').click();
       await page.locator('#themeChoices .theme-choice').filter({hasText:label}).click();
       const selected=await page.evaluate(()=>document.documentElement.dataset.theme||'');
       assert.equal(selected,theme,'selected theme matches '+label);
       await page.locator('#vigorNav [data-vigor-route="today"]').click();
       const colors=await page.evaluate(()=>{
         const root=document.documentElement;
         const current=el=>{const css=getComputedStyle(el);return css.backgroundImage+'|'+css.borderTopColor};
         return {
           accent:getComputedStyle(root).getPropertyValue('--accent').trim(),
           body:getComputedStyle(document.body).backgroundImage,
           header:current(document.querySelector('.app-header')),
           priority:current(document.querySelector('#big3Panel')),
           focus:current(document.querySelector('#vigorDailyFocus')),
           nav:current(document.querySelector('#vigorNav'))
         };
       });
       assert(colors.header.includes('vigor-sunrise.svg'),'brand artwork remains for '+label);
       assert(colors.body.includes('gradient'),'body receives theme styling for '+label);
       assert(colors.focus&&colors.priority&&colors.nav,'all premium surfaces visible for '+label);
       signatures.add(colors.header+'|'+colors.priority+'|'+colors.focus+'|'+colors.nav);
       await page.locator('#vigorNav [data-vigor-route="journey"]').click();
       assert.equal(await page.locator('#vigorJourneyScreen').isVisible(),true,'Journey renders for '+label);
       const journeyColor=await page.locator('#vigorJourneyScreen .vigor-step').first().evaluate(el=>getComputedStyle(el).backgroundColor);
       await page.locator('#vigorNav [data-vigor-route="growth"]').click();
       assert.equal(await page.locator('#vigorPersonalGrowth').isVisible(),true,'Growth renders for '+label);
       const growthColor=await page.locator('#vigorPersonalGrowth .vc-life-area').first().evaluate(el=>getComputedStyle(el).backgroundColor);
       await page.locator('#vigorNav [data-vigor-route="fitness"]').click();
       assert.equal(await page.locator('#vigorFitnessScreen').isVisible(),true,'Fitness renders for '+label);
       const fitnessColor=await page.locator('#vigorFitnessScreen .vigor-summary').first().evaluate(el=>getComputedStyle(el).backgroundColor);
       assert(journeyColor&&growthColor&&fitnessColor,'feature surfaces styled for '+label);
     }
     assert.equal(signatures.size,palettes.length,'all six palettes visually distinguishable across premium surfaces');
     await page.locator('#vigorNav [data-vigor-route="more"]').click();
       await page.locator('#vigorMoreMenu [data-vigor-old="settings"]').click();
     await page.locator('#themeChoices .theme-choice').filter({hasText:'Midnight Blue'}).click();
     await page.reload({waitUntil:'domcontentloaded'});
     assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'midnight','saved colour theme survives reload');
     await page.locator('#vigorNav [data-vigor-route="more"]').click();
       await page.locator('#vigorMoreMenu [data-vigor-old="settings"]').click();
     await page.locator('#themeChoices .theme-choice').filter({hasText:'Black & Gold'}).click();
     // Reorder workouts on the phone, save, then verify persistent array order.
     await page.locator('#vigorNav [data-vigor-route="more"]').click();
     await page.locator('#vigorMoreMenu [data-vigor-old="settings"]').click();
     await page.locator('#toggleEdit').click();
     const workoutsBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')).activities.map(x=>x.id));
     assert(workoutsBefore.length>=2,'at least two workouts to reorder');
     await page.locator('#editList .editgrid').first().locator('.reorder-actions button').nth(1).click();
     assert.equal(await page.locator('#editList .editgrid').first().getAttribute('data-activity-id'),workoutsBefore[1],'workout moves down before save');
     await page.locator('#saveWorkoutChanges').click();
     const workoutsSaved=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')).activities.map(x=>x.id));
     assert.equal(workoutsSaved[0],workoutsBefore[1],'workout order persisted');
     await page.reload({waitUntil:'domcontentloaded'});
     await page.locator('#vigorNav').waitFor({state:'visible'});
     const workoutsReloaded=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')).activities.map(x=>x.id));
     assert.deepEqual(workoutsReloaded,workoutsSaved,'workout order survives reload');

     // Reorder habits while retaining the original date-indexed check-in data.
     await page.locator('#vigorNav [data-vigor-route="today"]').click();
     await page.locator('#daily').evaluate(el=>{const details=el.closest('details');if(details)details.open=true});
     await page.locator('#editHabits').click();
     const habitBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')).habitLabels);
     assert(habitBefore.length>=2,'at least two habits to reorder');
     await page.locator('#habitEditor .habit-add-row').first().locator('.reorder-actions button').nth(1).click();
     const habitSaved=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')).habitLabels);
     assert.equal(habitSaved[0],habitBefore[1],'habit order persisted');
     await page.reload({waitUntil:'domcontentloaded'});
     const habitReloaded=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')).habitLabels);
     assert.deepEqual(habitReloaded,habitSaved,'habit order survives reload');

     // Daily Big 3 can be reordered independently of the full checklists.
     await page.locator('#big3Editor').evaluate(el=>el.open=true);
     const firstPriorityValue=await page.locator('#big3Selectors>label select').first().inputValue();
     const secondPriority=await page.locator('#big3Selectors>label select').nth(1).inputValue();
     await page.locator('#big3Selectors>label').first().locator('.reorder-actions button').nth(1).click();
     assert.equal(await page.locator('#big3Selectors>label select').first().inputValue(),secondPriority,'Big 3 selector moved');
     await page.locator('#saveBig3').click();
     const big3Saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')).discipline.big3);
     assert.equal(big3Saved[0],secondPriority,'Big 3 order saved');
     assert.equal(big3Saved[1],firstPriorityValue,'Big 3 keeps both selections');
     const bounds=await page.locator('#vigorNav').boundingBox();
     assert(bounds&&bounds.x>=-1&&bounds.x+bounds.width<=viewport.width+2,'navigation fits screen');
     assert(!errors.some(e=>/Cannot read properties of undefined|SyntaxError|ReferenceError/.test(e)),errors.join('; '));
     console.log('PASS app navigation and screens at '+viewport.width+'x'+viewport.height);
     await context.close();
   }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(err=>{console.error(err);process.exitCode=1;server.close()});
