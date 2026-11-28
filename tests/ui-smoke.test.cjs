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
     assert.equal(await page.locator('#big3Panel').count(),0,'Focus anchor section is removed');
     assert.equal(await page.locator('#vigorAllHabits').isVisible(),true,'Full habits checklist is prominent on Today');
     assert.equal(await page.locator('#nutritionDiscipline').count(),0,'Nutrition Discipline card is removed');
     assert.equal(await page.locator('#vigorAllHabits').getByRole('heading',{name:'Followed nutrition plan'}).count(),1,
       'The regular nutrition habit is still available');
     assert.equal(await page.locator('#vigorDailyFocus').count(),0,'Old priority hero is removed');
     assert.equal(await page.locator('#transformationCoach, #vigorCoach').count(),0,'Redundant coaching cards are removed');
     assert.equal(await page.locator('#todayTraining').isVisible(),true,'Daily training checklist is visible');
     assert.equal(await page.getByText('Add your workouts to see what to do each day.',{exact:true}).isVisible(),true,'New accounts start with an empty routine');
     const routineEditor=page.locator('#trainingRoutineEditor');
     const routineDay=routineEditor.getByLabel('Schedule day');
     const routineActivities=routineEditor.getByRole('textbox',{name:/^Workouts or activities/});
     const routineZone=routineEditor.getByRole('spinbutton',{name:/^Easy cardio/});
     await routineEditor.getByText('Set up my workouts',{exact:true}).click();
     assert.equal(await routineDay.locator('option').count(),8,'Shift workers can schedule all eight days');
     await routineActivities.fill('Mobility circuit');
     await routineZone.fill('30');
     await routineDay.selectOption('1');
     await routineActivities.fill('Tempo run');
     await routineDay.selectOption('0');
     assert.equal(await routineActivities.inputValue(),'Mobility circuit','Editing another day keeps the first draft');
     await routineEditor.getByRole('button',{name:'Save workout plan'}).click();
     assert.equal(await page.getByRole('button',{name:'Complete Mobility circuit'}).isVisible(),true,'Saved activity appears in Today');
     assert.equal(await page.getByRole('button',{name:'Complete Tempo run'}).count(),0,'Another day has its own activities');
     assert.equal(await page.locator('#vigorStartGuide').isVisible(),true,'First-run guide visible without saved history');
     const activeHabits=await page.evaluate(()=>{
       const state=window.vigorCloudBridge.read();
       return state.habitLabels.filter((_,i)=>!state.discipline?.settings?.[i]?.archivedAt).length;
     });
     assert.equal(await page.locator('#vigorHabitsTrack .vah-card').count(),activeHabits,
       'Every active habit has one checklist row');
     assert.equal(await page.locator('#vigorAllHabits .vah-track').evaluate(list=>list.scrollWidth<=list.clientWidth),true,
       'Habits fit without a horizontal swipe');
     assert.equal(await page.locator('#panel-today #habitEditor').count(),0,'Past habit tools are only in Habits');
     const firstHabit=page.locator('#vigorHabitsTrack .vah-card').first();
     const firstIndex=await firstHabit.getAttribute('data-habit-index');
     await firstHabit.locator('[data-mode="full"]').click();
     const finished=page.locator('#vigorHabitsTrack .vah-card[data-habit-index="'+firstIndex+'"]');
     assert.equal(await finished.locator('[data-mode="full"]').getAttribute('aria-pressed'),'true',
       'Done is recorded on the checklist');
     assert.equal(await finished.locator('[data-mode="minimum"]').getAttribute('aria-pressed'),'false',
       'Minimum is not selected when Done is active');
     assert.equal(await page.locator('#vigorJourneyManager').count(),1,'same existing Journey is present');
     await finished.locator('[data-mode="minimum"]').click();
     assert.equal(await finished.locator('[data-mode="minimum"]').getAttribute('aria-pressed'),'true',
       'Minimum effort is recorded on the same habit');
     assert.equal(await finished.locator('[data-mode="full"]').getAttribute('aria-pressed'),'false',
       'Full effort becomes unselected after Minimum');
     await finished.locator('[data-mode="minimum"]').click();
     assert.equal(await finished.locator('[data-mode="minimum"]').getAttribute('aria-pressed'),'false',
       'Tapping selected minimum again can undo the action');
     assert.equal(await page.locator('#vigorHabitsTrack .vah-card').count(),activeHabits,
       'Every active habit remains available after completion or undo');
     await page.locator('#vigorNav [data-vigor-route="journey"]').click();
     assert.equal(await page.locator('#vigorJourneyScreen').isVisible(),true,'Dedicated Journey view visible');
     assert.equal(await page.locator('#globalSaveStatus').isVisible(),false,'duplicate legacy save text hidden');
     assert.equal(await page.locator('#vigorSyncBadge').isVisible(),true,'single trustworthy save badge remains visible');
     assert.equal(await page.locator('.app-header h1').isVisible(),false,'secondary-screen header is compact');

     assert.equal(await page.locator('#vigorJourneyScreen .vigor-step').count(),5,'Five guided habit steps');
     assert.equal(await page.locator('#vigorJourneyManager .vjm-item-actions button').first().isVisible(),true,
       'compact habit actions visible by default');
     // Journey auto-prioritizes unfinished habits while preserving each habit's identity.
     const journeyOrder=await page.locator('#vigorJourneyManager .vjm-item').evaluateAll(rows=>rows.map(row=>Number(row.dataset.habitIndex)));
     const expectedOrder=await page.evaluate(()=>{
       const d=window.vigorCloudBridge.read(),today=new Date();
       const date=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
       const full=d.dailyCheckins?.[date]?.habits||[],mins=d.discipline?.minimums?.[date]||{};
       return d.habitLabels.map((_,i)=>i).filter(i=>!d.discipline?.settings?.[i]?.archivedAt)
         .sort((a,b)=>Number(!!full[a]||!!mins[a])-Number(!!full[b]||!!mins[b])||a-b);
     });
     assert.deepEqual(journeyOrder,expectedOrder,'Journey lists unfinished habits above completed habits');
     assert.equal(await page.locator('#vigorJourneyManager .vjm-item-more').first().isVisible(),false,
       'extra habit controls collapsed by default');
     assert.equal(await page.locator('#vigorJourneyManager .vjm-focus-strip').count(),0,'Today’s Focus box is removed');
     assert.deepEqual(await page.locator('#vigorJourneyManager .vjm-filter').allTextContents(),
       ['All habits','Building','Replacing','Archived'],'Habit filters are available without a focus list');
     assert.equal(journeyOrder.length,activeHabits,'All active habits are shown by default');

     assert.equal(await page.locator('#panel-today').isVisible(),false,'Today panel hidden while in Journey');
     await page.locator('#vigorNav [data-vigor-route="growth"]').click();
     assert.equal(await page.locator('#measurements').isVisible(),true,'Measurements are visible before reports');
     assert.equal(await page.locator('#panel-progress').locator(':scope > :first-child').getAttribute('id'),'measurements','Progress starts with measurements');
     assert.equal(await page.locator('#progressOverview').isVisible(),true,'A short progress summary is visible');
     const progress=page.locator('#panel-progress');
     assert.deepEqual(await progress.locator(':scope > details > summary').allTextContents(),
       ['Weight & waist charts','Habit calendar'],'Only charts and the habit calendar use expandable sections');
     assert.equal(await progress.locator('#progressReports,#disciplineReview,#progressInsights,#vigorRotationRecap,#vigorPersonalGrowth').count(),0,
       'Overlapping reports and training score are gone');
     await progress.getByText('Weight & waist charts',{exact:true}).click();
     assert.equal(await progress.locator('#weightChart').isVisible(),true,'Charts open directly');
     assert.equal(await progress.locator('#habitCalendar').isVisible(),false,'Charts leave the calendar closed');
     assert.equal(await progress.locator('#milestones').isVisible(),true,'Milestones are visible when Progress opens');
     assert.equal(await progress.locator('#milestones .milestone-item').count(),12,'All twelve milestones are available in Progress');
     await progress.getByText('Manage milestone rewards',{exact:true}).click();
     assert.equal(await progress.locator('#milestoneRewards input').count(),12,'Each milestone still has a reward field');
     const milestones=await progress.locator('#milestones .milestone-item strong').allTextContents();
     assert.deepEqual(milestones,['359.2 lb','348.3 lb','337.5 lb','326.7 lb','315.8 lb','305 lb',
       '294.2 lb','283.3 lb','272.5 lb','261.7 lb','250.8 lb','240 lb']);
     assert.equal(await page.locator('#panel-rewards #milestones').count(),0,'Milestones appear in one place');
     await progress.getByText('Manage milestone rewards',{exact:true}).click();
     await progress.getByText('Habit calendar',{exact:true}).click();
     assert.equal(await progress.locator('#habitCalendarGrid button').count(),8,'The calendar shows each day of the rotation');
     await progress.locator('#habitCalendarGrid button').first().click();
     assert.match(await progress.locator('#habitCalendarDetail').textContent(),/habit entry|full|recovery/i);
     const dateField=progress.locator('#measureDate');
     const todayDate=await dateField.inputValue();
     const earlierDates=await page.evaluate(()=>{
       const date=new Date();
       return [-2,-1].map(offset=>{
         const past=new Date(date);
         past.setDate(past.getDate()+offset);
         return [past.getFullYear(),String(past.getMonth()+1).padStart(2,'0'),String(past.getDate()).padStart(2,'0')].join('-');
       });
     });
     await dateField.fill(earlierDates[0]);
     await progress.locator('#weight').fill('355.4');
     await progress.locator('#saveMeasure').click();
     assert.equal(await progress.locator('#measureStatus').getAttribute('data-state'),'saved');
     assert.match(await progress.locator('#measureStatus').textContent(),/Saved.*355.4 lb weight/);
     await dateField.fill(earlierDates[1]);
     await progress.locator('#waist').fill('52.5');
     await progress.locator('#saveMeasure').click();
     assert.match(await progress.locator('#measureStatus').textContent(),/Saved.*52.5 in waist/);
     await dateField.fill(earlierDates[0]);
     assert.equal(await progress.locator('#weight').inputValue(),'','Saved weight is shown in the confirmation, not the input');
     assert.match(await progress.locator('#measureStatus').textContent(),/355.4 lb weight/);
     await progress.locator('#waist').fill('53');
     await progress.locator('#saveMeasure').click();
     assert.match(await progress.locator('#measureStatus').textContent(),/355.4 lb weight.*53 in waist/);
     assert.equal(await progress.locator('#weight').inputValue(),'');
     assert.equal(await progress.locator('#waist').inputValue(),'');
     await progress.locator('#weight').fill('354.4');
     await progress.locator('#waist').fill('52.8');
     await progress.locator('#saveMeasure').click();
     assert.match(await progress.locator('#measureStatus').textContent(),/354.4 lb weight.*52.8 in waist/);
     assert.equal(await progress.locator('#weight').inputValue(),'');
     assert.equal(await progress.locator('#waist').inputValue(),'');
     const savedMeasurements=await page.evaluate(()=>window.vigorCloudBridge.read().measurements);
     assert.deepEqual(savedMeasurements.find(x=>x.date===earlierDates[1]),{date:earlierDates[1],waist:52.5});
     assert.deepEqual(savedMeasurements.find(x=>x.date===earlierDates[0]),{date:earlierDates[0],weight:354.4,waist:52.8});
     await dateField.fill(todayDate);
     await page.locator('#vigorNav [data-vigor-route="fitness"]').click();
     assert.equal(await page.locator('#vigorFitnessScreen').isVisible(),true,'Dedicated Fitness screen visible');
     const library = page.getByText('Training library · Gym and home',{exact:true});
     assert.equal(await library.isVisible(),true,'Training library is available in Fitness');
     await library.click();
     const trainingLocation = page.getByRole('combobox',{name:'Training location'});
     await trainingLocation.selectOption('Home');
     await page.getByText('Full Body A · 16 working sets',{exact:true}).click();
     assert.equal(await page.getByText('DB Floor Press · 2 × 6–12',{exact:true}).isVisible(),true,'Home exercise alternatives still work');
     await library.click();
     assert.equal(await page.locator('.fitness-plan-list').getByText('Tempo run',{exact:true}).isVisible(),true,'Fitness shows the full personal plan before any workout is logged');
     assert.equal(await page.getByText("Coach's note:",{exact:false}).count(),0,'Coach’s note is removed');
     await page.locator('#fitnessEditPlan').click();
     assert.equal(await page.locator('#fitnessRoutineEditor #trainingRoutineForm').isVisible(),true,'Shared plan can also be edited from Fitness');
     await routineDay.selectOption('0');
     await routineActivities.fill('Mobility circuit\nEasy walk');
     await routineEditor.getByRole('button',{name:'Save workout plan'}).click();
     assert.equal(await page.locator('.fitness-plan-list').getByText('Easy walk',{exact:true}).isVisible(),true,'Saving in Fitness updates the full plan');
     await page.locator('#vigorNav [data-vigor-route="today"]').click();
     assert.equal(await page.getByRole('button',{name:'Complete Easy walk'}).isVisible(),true,'The same edit updates Today');
     await page.locator('#vigorNav [data-vigor-route="fitness"]').click();
     // The original collapsed shells must move too, not just their inner nodes.
     assert.equal(await page.locator('#panel-today>details.compact-details').filter({has:page.locator('summary:text-is("Zone 2 minutes")')}).count(),0,'Today has no empty Zone 2 accordion');
     assert.equal(await page.locator('#panel-today>details.compact-details').filter({has:page.locator('summary:text-is("All workouts & session logs")')}).count(),0,'Today has no empty workout log accordion');
     assert.equal(await page.locator('#vigorFitnessScreen>details.compact-details').filter({has:page.locator('#zone2')}).count(),1,'Zone 2 accordion is in Fitness');
     assert.equal(await page.locator('#vigorFitnessScreen>details.compact-details').filter({has:page.locator('#training')}).count(),1,'Workout log accordion is in Fitness');
     await page.locator('#vigorFitnessScreen>details.compact-details').filter({has:page.locator('#training')}).locator(':scope > summary').click();
     assert.equal(await page.locator('#training').isVisible(),true,'Open workout checklist reveals existing logs without navigating away');
     assert.equal(await page.locator('#vigorFitnessScreen').isVisible(),true,'Fitness remains selected after opening workouts');
     await page.locator('#vigorFitnessScreen>details.compact-details').filter({has:page.locator('#training')}).locator(':scope > summary').click();
     assert.equal(await page.locator('#training').isVisible(),false,'workout log accordion can collapse');

     // Zone 2 is one shared tracker, now housed in Fitness rather than Today.
     const zone=page.locator('#zone2');
     assert.equal(await zone.isVisible(),true,'Zone 2 visible inside Fitness');
     assert.equal(await zone.locator('#addZoneMinutes').isVisible(),true,'Zone 2 logging available in Fitness');
     assert.equal(await page.locator('#vigorFitnessScreen #zone2').count(),1,'original Zone 2 tracker lives inside Fitness');
     assert.equal(await page.locator('#panel-today #zone2').count(),0,'Zone 2 is no longer duplicated on Today');
     await page.evaluate(()=>{window.__zone2Original=document.querySelector('#zone2')});
     const initialMinutes=Number(await page.locator('#zoneTotal').textContent());
     const originalGoal=Number(await page.locator('#zoneGoalLabel').textContent());
     await page.locator('#zoneMinutes').fill('23');
     await page.locator('#addZoneMinutes').click();
     assert.equal(Number(await page.locator('#zoneTotal').textContent()),initialMinutes+23,'Zone 2 logs through existing save handler');
     const afterLog=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')).zone2Logs);
     assert(afterLog.some(x=>x.minutes===23),'Zone 2 session persisted to original data');
     await page.evaluate(()=>window.VigorPremiumScreens.refresh());
     assert.equal(await page.evaluate(()=>document.querySelector('#zone2')===window.__zone2Original),true,
       'Fitness refresh reuses original Zone 2 element and handlers');
     await page.locator('#editZoneGoal').click();
     await page.locator('#zoneGoalInput').fill(String(originalGoal+25));
     await page.locator('#saveZoneGoal').click();
     assert.equal(Number(await page.locator('#zoneGoalLabel').textContent()),originalGoal+25,
       'existing rotation target edits work inside Fitness');
     await page.reload({waitUntil:'domcontentloaded'});
     await page.locator('#vigorNav [data-vigor-route="fitness"]').click();
     assert.equal(Number(await page.locator('#zoneTotal').textContent()),initialMinutes+23,
       'Zone 2 minutes survive browser reload');
     assert.equal(Number(await page.locator('#zoneGoalLabel').textContent()),originalGoal+25,
       'Zone 2 target survives browser reload');
     await page.locator('#zoneLog .zone-log-row').filter({hasText:'23 min'}).locator('button').click();
     assert.equal(Number(await page.locator('#zoneTotal').textContent()),initialMinutes,
       'Zone 2 undo works from the Fitness screen');
     await page.locator('#editZoneGoal').click();
     await page.locator('#zoneGoalInput').fill(String(originalGoal));
     await page.locator('#saveZoneGoal').click();
     await page.locator('#vigorNav [data-vigor-route="today"]').click();
     assert.equal(await page.locator('#zone2').isVisible(),false,'Zone 2 is not displayed on Today');
     assert.equal(await page.locator('#panel-today>details.compact-details').filter({hasText:'Zone 2 minutes'}).count(),0,'Today has no Zone 2 heading after switching tabs');
     assert.equal(await page.locator('#panel-today>details.compact-details').filter({hasText:'All workouts & session logs'}).count(),0,'Today has no workout log heading after switching tabs');

     await page.locator('#vigorNav [data-vigor-route="fitness"]').click();

     await page.locator('#vigorNav [data-vigor-route="more"]').click();
     assert.equal(await page.locator('#vigorMoreMenu').isVisible(),true,'More menu visible');
     await page.locator('#vigorNav [data-vigor-route="today"]').click();
     const scriptureCard=page.locator('#todayBible');
     const scriptureTheme=await scriptureCard.locator('#todayBibleTheme').textContent();
     const scriptureReference=await scriptureCard.locator('#todayBibleReference').textContent();
     assert.ok(scriptureTheme.trim(),'Today shows the devotional theme');
     assert.match(scriptureReference,/\d+.* · NLT$/,'Today shows the passage reference and translation');
     assert.equal(await scriptureCard.evaluate(card=>card.scrollWidth<=card.clientWidth),true,
       'Scripture card fits the viewport');
     await scriptureCard.press('Enter');
     assert.equal(await page.locator('#panel-faith').isVisible(),true,'Faith remains reachable');
     assert.equal(await page.locator('#devotionalTitle').textContent(),scriptureTheme,'Theme matches the devotional');
     assert.equal(await page.locator('#verseRef').textContent(),scriptureReference+' reading','Reference matches the devotional');
     assert.equal(await page.locator('#verseTitle').evaluate(heading=>document.activeElement===heading),true,
       'Opening Scripture moves focus to the devotional');
     await page.locator('#vigorNav [data-vigor-route="today"]').click();
     assert.equal(await page.locator('#todayTraining').isVisible(),true,'Return to Today with training visible');
     assert.equal(await page.locator('.app-header h1').isVisible(),true,'Today retains full heading');
     assert.equal(await page.locator('#vigorJourneyScreen').isVisible(),false,'Journey hidden when returning Today');
     // A local habit check must survive a complete browser reload even without signing in.
     await page.locator('#vigorSyncBadge').waitFor({state:'visible'});
     assert.equal(await page.locator('#vigorSyncBadge').textContent(),'Saved on this device','signed-out account is not labeled cloud-synced');
     const trainingTasks=page.locator('#todayTrainingTasks');
     const firstWorkout=trainingTasks.getByRole('button',{name:/^(Complete|Undo) Mobility circuit$/});
     const zone2Check=trainingTasks.getByRole('button',{name:/^(Complete|Undo) Zone 2$/});
     assert.equal(await zone2Check.getAttribute('aria-pressed'),'false','Zone 2 starts unchecked');
     await firstWorkout.click();
     assert.equal(await zone2Check.getAttribute('aria-pressed'),'false','Checking off training leaves Zone 2 unchecked');
     await page.locator('#vigorNav [data-vigor-route="fitness"]').click();
     await page.locator('#fitnessWorkoutHistory > summary').click();
     assert.equal(await page.locator('#fitnessWorkoutHistory li').filter({hasText:'Mobility circuit'}).isVisible(),true,'A workout logged on Today appears in Fitness history');
     await page.locator('#vigorNav [data-vigor-route="today"]').click();
     await trainingTasks.getByText('Log custom minutes',{exact:true}).click();
     await trainingTasks.getByRole('spinbutton',{name:'Minutes completed'}).fill('7');
     await trainingTasks.getByRole('button',{name:'Log minutes'}).click();
     assert.equal(await zone2Check.getAttribute('aria-pressed'),'false','A partial Zone 2 log leaves Zone 2 unchecked');
     await zone2Check.click();
     assert.equal(await zone2Check.getAttribute('aria-pressed'),'true','Zone 2 can be checked off on its own');
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
     assert.equal(await firstWorkout.getAttribute('aria-pressed'),'true','training completion survives reload');
     assert.equal(await zone2Check.getAttribute('aria-pressed'),'true','Zone 2 completion survives reload');
     assert.deepEqual(saved.state.zone2Logs.map(log=>log.minutes),[7,23],'Zone 2 check-off records only the remaining planned minutes');
     await zone2Check.click();
     assert.equal(await zone2Check.getAttribute('aria-pressed'),'false','Zone 2 check-off can be undone');
     assert.equal(await firstWorkout.getAttribute('aria-pressed'),'true','Undoing Zone 2 leaves the workout checked');
     assert.equal(await trainingTasks.getByText('7 / 30 min logged',{exact:true}).isVisible(),true,'Undo keeps manually logged minutes');
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
           training:current(document.querySelector('#todayTraining')),
           nav:current(document.querySelector('#vigorNav'))
         };
       });
       assert(colors.header.includes('vigor-sunrise.svg'),'brand artwork remains for '+label);
       assert(colors.body.includes('gradient'),'body receives theme styling for '+label);
       assert(colors.training&&colors.nav,'all premium surfaces visible for '+label);
       signatures.add(colors.header+'|'+colors.training+'|'+colors.nav);
       await page.locator('#vigorNav [data-vigor-route="journey"]').click();
       assert.equal(await page.locator('#vigorJourneyScreen').isVisible(),true,'Journey renders for '+label);
       const journeyColor=await page.locator('#vigorJourneyScreen .vigor-step').first().evaluate(el=>getComputedStyle(el).backgroundColor);
       await page.locator('#vigorNav [data-vigor-route="growth"]').click();
       assert.equal(await page.locator('#progressOverview').isVisible(),true,'Progress renders for '+label);
       const growthColor=await page.locator('#progressOverview .insight-stat').first().evaluate(el=>getComputedStyle(el).backgroundColor);
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
     assert.deepEqual(await page.locator('#panel-settings > :nth-child(-n+2)').evaluateAll(items=>items.map(el=>el.id)),
       ['cloudSync','shiftSettings'],'Account and schedule are first in Settings');
     await page.getByText('Workout log settings',{exact:true}).click();
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
     await page.locator('#vigorNav [data-vigor-route="journey"]').click();
     await page.locator('#vigorJourneyManager .vjm-manage').click();
     assert.equal(await page.locator('#vigorJourneyScreen #habitEditor').isVisible(),true,'Order can be changed within Habits');
     const habitBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')).habitLabels);
     assert(habitBefore.length>=2,'at least two habits to reorder');
     await page.locator('#habitEditor .habit-add-row').first().locator('.reorder-actions button').nth(1).click();
     const habitSaved=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')).habitLabels);
     assert.equal(habitSaved[0],habitBefore[1],'habit order persisted');
     await page.reload({waitUntil:'domcontentloaded'});
     const habitReloaded=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')).habitLabels);
     assert.deepEqual(habitReloaded,habitSaved,'habit order survives reload');

     await page.locator('#vigorSyncBadge').click();
     assert.equal(await page.getByText('Focus anchor settings',{exact:true}).count(),0,'Settings has no focus anchor editor');
     // Journey is now a complete habit workspace, not just a passive five-stage display.
     await page.locator('#vigorNav [data-vigor-route="journey"]').click();
     assert.equal(await page.locator('#vigorJourneyManager .vjm-item').count(),
       (await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')).habitLabels.length)),
       'Journey lists every tracked habit');
     assert.equal(await page.locator('#vigorJourneyScreen .vjm-steps').isVisible(),true,'Five-step guide remains available but compact');
     await page.locator('#vigorJourneyManager .vjm-add').click();
     await page.locator('#vjmName').fill('Read 15 pages');
     await page.locator('#vigorJourneyForm .vjm-save').click();
     let newState=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')));
     const buildIndex=newState.habitLabels.indexOf('Read 15 pages');
     assert(buildIndex>=0,'new habit saved with just a name');
     assert.equal(newState.discipline.settings[buildIndex].kind,'build','build habit marked as build');
     await page.reload({waitUntil:'domcontentloaded'});
     await page.locator('#vigorNav [data-vigor-route="journey"]').click();
     assert(await page.locator('#vigorJourneyManager .vjm-item').filter({hasText:'Read 15 pages'}).count(),'new habit survives reload');
     await page.locator('#vigorJourneyManager .vjm-add').click();
     await page.locator('#vigorJourneyForm input[value="replace"]').check();
     await page.locator('#vjmName').fill('Choose water instead of soda');
     await page.locator('#vigorJourneyForm .vjm-optional > summary').click();
     await page.locator('#vjmminimum').fill('Pause and fill a glass of water');
     await page.locator('#vjmplan').fill('When tempted, pause and fill a glass of water.');
     await page.locator('#vigorJourneyForm .vjm-save').click();
     newState=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')));
     const replaceIndex=newState.habitLabels.indexOf('Choose water instead of soda');
     assert(replaceIndex>=0,'replacement habit added');
     assert.equal(newState.discipline.settings[replaceIndex].kind,'replace','replacement habit clearly distinguished');
     assert.equal(newState.discipline.settings[replaceIndex].plan,
       'When tempted, pause and fill a glass of water.','replacement if-then plan saved');
     await page.locator('#vigorJourneyManager .vjm-filter').filter({hasText:'Replacing'}).click();
     assert.equal(await page.locator('#vigorJourneyManager .vjm-item').count(),1,'Replace filter shows only replacement habits');
     assert.equal(await page.locator('#vigorJourneyManager .vjm-plan').count(),1,'replacement plan displayed');
     await page.locator('#vigorJourneyManager .vjm-filter').filter({hasText:'Building'}).click();
     assert.equal(await page.locator('#vigorJourneyManager .vjm-item').filter({hasText:'Choose water instead of soda'}).count(),0,'Build filter hides replacement habits');
     await page.locator('#vigorJourneyManager .vjm-filter').filter({hasText:'All habits'}).click();
     assert(await page.locator('#vigorJourneyManager .vjm-item').filter({hasText:'Choose water instead of soda'}).count(),'All restores the replacement habit');

     const replacementRow=page.locator('#vigorJourneyManager .vjm-item').filter({hasText:'Choose water instead of soda'});
     await replacementRow.locator('.vjm-expand').click();
     assert.equal(await replacementRow.locator('.vjm-item-more').isVisible(),true,'optional habit actions expand');
     await replacementRow.locator('.vjm-edit').click();
     await page.locator('#vjmName').fill('Choose water instead of sugary drinks');
     await page.locator('#vigorJourneyForm .vjm-save').click();
     newState=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')));
     assert.equal(newState.habitLabels[replaceIndex],'Choose water instead of sugary drinks','habit edited in Journey');
     const chosen=page.locator('#vigorJourneyManager .vjm-item').filter({hasText:'Choose water instead of sugary drinks'});
     await chosen.locator('.vjm-min').click();
     assert.equal(await chosen.locator('.vjm-min').getAttribute('aria-pressed'),'true',
       'minimum effort shows selected state');
     const selectedMin=await chosen.locator('.vjm-min').evaluate(el=>getComputedStyle(el).borderTopColor);
     assert.equal(selectedMin,'rgb(232, 185, 78)','gold ring appears around selected minimum');
     assert.equal(await chosen.locator('.vjm-done').getAttribute('aria-pressed'),'false',
       'Done is unselected when minimum is selected');

     const local=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')));
     const recordedMinimums=Object.values(local.discipline.minimums||{});
     assert(recordedMinimums.some(row=>row[replaceIndex]===true),'minimum effort saved through existing daily check-in');
     await chosen.locator('.vjm-done').click();
     assert.equal(await chosen.locator('.vjm-done').getAttribute('aria-pressed'),'true',
       'Done shows selected state');
     assert.equal(await chosen.locator('.vjm-min').getAttribute('aria-pressed'),'false',
       'Minimum becomes unselected after Done');
     const selectedDone=await chosen.locator('.vjm-done').evaluate(el=>getComputedStyle(el).borderTopColor);
     assert.equal(selectedDone,'rgb(232, 185, 78)','gold ring appears around selected Done');
     await page.locator('#vigorJourneyManager #vjmToggleCompleted').click();
     assert.equal(await chosen.count(),0,'hide completed removes recorded habit from the visible list');
     await page.locator('#vigorJourneyManager #vjmToggleCompleted').click();
     assert.equal(await chosen.count(),1,'show completed restores it');

     const updated=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')));
     assert(Object.values(updated.dailyCheckins||{}).some(row=>row.habits?.[replaceIndex]===true),'full effort saved on existing daily check-in');
     // Recover one habit without rewriting its historical full/minimum records.
     const beforeRecovery=await page.evaluate(()=>{
       const d=JSON.parse(localStorage.getItem('vigor-tracker'));
       return {dailyCheckins:d.dailyCheckins,minimums:d.discipline.minimums,
         otherSettings:d.discipline.settings[0]};
     });
     if(!(await chosen.locator('.vjm-item-more').isVisible()))await chosen.locator('.vjm-expand').click();
     await chosen.locator('.vjm-adjust').click();
     assert.equal(await page.locator('#vigorJourneyRecovery').isVisible(),true,'obstacle adjustment form is available');
     await page.locator('#vjmRecoveryObstacle').selectOption('energy');
     await page.locator('#vjmRecoveryStep').fill('Rest first, then prepare a glass of water.');
     await page.locator('#vigorJourneyRecovery .vjm-save').click();
     const afterRecovery=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')));
     assert.equal(afterRecovery.discipline.settings[replaceIndex].recovery.obstacle,'energy',
       'selected obstacle saved');
     assert.equal(afterRecovery.discipline.settings[replaceIndex].recovery.nextStep,
       'Rest first, then prepare a glass of water.','next easier step saved');
     assert.deepEqual(afterRecovery.dailyCheckins,beforeRecovery.dailyCheckins,'historical habit check-ins unchanged');
     assert.deepEqual(afterRecovery.discipline.minimums,beforeRecovery.minimums,'minimum efforts unchanged');
     assert.deepEqual(afterRecovery.discipline.settings[0],beforeRecovery.otherSettings,'other habit settings unchanged');
     if(!(await chosen.locator('.vjm-item-more').isVisible()))await chosen.locator('.vjm-expand').click();
     assert.equal(await chosen.locator('.vjm-recovery-note').isVisible(),true,'saved adjustment appears on habit');
     await page.reload({waitUntil:'domcontentloaded'});
     await page.locator('#vigorNav [data-vigor-route="journey"]').click();
     const restoredHabit=page.locator('#vigorJourneyManager .vjm-item').filter({hasText:'Choose water instead of sugary drinks'});
     await restoredHabit.locator('.vjm-expand').click();
     assert.equal(await restoredHabit.locator('.vjm-recovery-note').isVisible(),true,'adjustment survives browser reload');
     await restoredHabit.locator('.vjm-edit').click();
     await page.locator('#vigorJourneyForm .vjm-optional > summary').click();
     await page.locator('#vjmminimum').fill('Pause for a moment and fill one glass of water');
     await page.locator('#vigorJourneyForm .vjm-save').click();
     const afterEdit=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')));
     assert.equal(afterEdit.discipline.settings[replaceIndex].recovery.nextStep,
       'Rest first, then prepare a glass of water.','editing the habit preserves the recovery plan');
     await page.locator('#vigorJourneyManager .vjm-manage').click();
     assert.equal(await page.locator('#vigorJourneyScreen #habitEditor').isVisible(),true,'Reorder stays in Habits');
     // Archive an active habit without changing the underlying historical records.
     const beforeArchive=await page.evaluate(()=>{
       const d=JSON.parse(localStorage.getItem('vigor-tracker'));
       const activeIndex=d.habitLabels.findIndex((_,i)=>!d.discipline.settings[i]?.archivedAt);
       return {labels:d.habitLabels.slice(),checks:d.dailyCheckins,mins:d.discipline.minimums,
         priorities:d.discipline.big3.slice(),activeIndex};
     });
     const archivedIndex=beforeArchive.activeIndex;
     assert(archivedIndex>=0,'expected at least one active habit');
     await page.locator('#vigorNav [data-vigor-route="journey"]').click();
     await page.locator('#vigorJourneyManager .vjm-filter').filter({hasText:'All habits'}).click();
     let archivedRow=page.locator('#vigorJourneyManager .vjm-item[data-habit-index="'+archivedIndex+'"]');
     if(!(await archivedRow.locator('.vjm-item-more').isVisible()))await archivedRow.locator('.vjm-expand').click();
     page.once('dialog',dialog=>dialog.accept());
     await archivedRow.locator('.vjm-archive').click();
     const afterArchive=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')));
     assert.equal(afterArchive.discipline.settings[archivedIndex].archivedAt!==undefined,true,'archival timestamp stored');
     assert.deepEqual(afterArchive.habitLabels,beforeArchive.labels,'habit labels preserved by archive');
     assert.deepEqual(afterArchive.dailyCheckins,beforeArchive.checks,'check-in history preserved by archive');
     assert.deepEqual(afterArchive.discipline.minimums,beforeArchive.mins,'minimum history preserved by archive');
     assert.deepEqual(afterArchive.discipline.big3,beforeArchive.priorities.filter(key=>key!=='h:'+archivedIndex),
       'archiving preserves any other saved priority preferences');
     assert.equal(await page.locator('#vigorJourneyManager .vjm-item[data-habit-index="'+archivedIndex+'"]').count(),0,'archived item leaves active Journey');
     await page.locator('#vigorJourneyManager .vjm-filter').filter({hasText:'Archived'}).click();
     archivedRow=page.locator('#vigorJourneyManager .vjm-item[data-habit-index="'+archivedIndex+'"]');
     assert.equal(await archivedRow.isVisible(),true,'archived habit remains accessible for restore');
     assert.equal(await archivedRow.locator('.vjm-done').count(),0,'archived habit is no longer directly loggable');
     await page.locator('#vigorNav [data-vigor-route="today"]').click();
     assert.equal(await page.locator('#vigorHabitsTrack [data-habit-index="'+archivedIndex+'"]').count(),0,'archived habit leaves Today checklist');
     await page.reload({waitUntil:'domcontentloaded'});
     await page.locator('#vigorNav [data-vigor-route="journey"]').click();
     await page.locator('#vigorJourneyManager .vjm-filter').filter({hasText:'Archived'}).click();
     archivedRow=page.locator('#vigorJourneyManager .vjm-item[data-habit-index="'+archivedIndex+'"]');
     assert.equal(await archivedRow.isVisible(),true,'archived habit persists after page reload');
     await archivedRow.locator('.vjm-restore').click();
     const afterRestore=await page.evaluate(()=>JSON.parse(localStorage.getItem('vigor-tracker')));
     assert.equal(afterRestore.discipline.settings[archivedIndex].archivedAt,undefined,'habit becomes active after restore');
     assert.deepEqual(afterRestore.habitLabels,beforeArchive.labels,'restore preserves names and order');
     assert.deepEqual(afterRestore.dailyCheckins,beforeArchive.checks,'restore preserves check-in history');
     assert.deepEqual(afterRestore.discipline.minimums,beforeArchive.mins,'restore preserves historical minimums');
     assert(Array.isArray(afterRestore.discipline.settings[archivedIndex].archivePeriods),'archive interval retained for future calculations');
     await page.locator('#vigorNav [data-vigor-route="today"]').click();
     assert.equal(await page.locator('#vigorHabitsTrack [data-habit-index="'+archivedIndex+'"]').count(),1,'restored habit returns to Today');
     // Sorting only changes the visible Journey order, never saved habit or check-in data.
     await page.locator('#vigorNav [data-vigor-route="journey"]').click();
     const sortingStateBefore=await page.evaluate(()=>{
       const d=JSON.parse(localStorage.getItem('vigor-tracker'));
       return {habitLabels:d.habitLabels,checkins:d.dailyCheckins,minimums:d.discipline.minimums};
     });
     const allHabits=page.locator('#vigorJourneyManager .vjm-filter').filter({hasText:'All habits'});
     await allHabits.click();
     const sortInput=page.locator('#vigorJourneyManager #vjmSortHabits');
     assert.equal(await sortInput.inputValue(),'manual','manual sorting defaults to the user-defined order');
     const manualOrder=await page.locator('#vigorJourneyManager .vjm-item').evaluateAll(rows=>rows.map(el=>Number(el.dataset.habitIndex)));
     await sortInput.selectOption('unfinished');
     const unfinishedOrder=await page.locator('#vigorJourneyManager .vjm-item').evaluateAll(rows=>rows.map(el=>Number(el.dataset.habitIndex)));
     const calculated=await page.evaluate(()=>{
       const d=window.vigorCloudBridge.read(),now=new Date();
       const key=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
       const full=d.dailyCheckins?.[key]?.habits||[],mins=d.discipline?.minimums?.[key]||{};
       return d.habitLabels.map((_,i)=>i).filter(i=>!d.discipline?.settings?.[i]?.archivedAt)
         .sort((a,b)=>Number(!!full[a]||!!mins[a])-Number(!!full[b]||!!mins[b])||a-b);
     });
     assert.deepEqual(unfinishedOrder,calculated,'unfinished habits appear before already-recorded habits');
     await page.locator('#vigorJourneyManager #vjmSortHabits').selectOption('attention');
     assert.equal(await page.locator('#vigorJourneyManager #vjmSortHabits').inputValue(),'attention',
       'needs-attention sorting is available');
     await page.locator('#vigorJourneyManager #vjmSortHabits').selectOption('manual');
     const again=await page.locator('#vigorJourneyManager .vjm-item').evaluateAll(rows=>rows.map(el=>Number(el.dataset.habitIndex)));
     assert.deepEqual(again,manualOrder,'manual sorting restores the original visible order');
     const sortingStateAfter=await page.evaluate(()=>{
       const d=JSON.parse(localStorage.getItem('vigor-tracker'));
       return {habitLabels:d.habitLabels,checkins:d.dailyCheckins,minimums:d.discipline.minimums};
     });
     assert.deepEqual(sortingStateAfter,sortingStateBefore,'switching sort modes never edits saved records');
     await page.locator('#vigorNav [data-vigor-route="more"]').click();
     await page.locator('#vigorMoreMenu [data-vigor-old="settings"]').click();
     await page.locator('#cycleLength').selectOption('7');
     await page.locator('#vigorNav [data-vigor-route="today"]').click();
     assert.equal(await trainingTasks.getByText('Add your workouts to see what to do each day.').isVisible(),true,'Weekly schedules use a separate routine');
     await routineEditor.getByText('Set up my workouts',{exact:true}).click();
     assert.equal(await routineDay.locator('option').count(),7,'Weekly schedules have seven editable days');
     assert.equal(await routineDay.locator('option').first().textContent(),'Monday','Weekly schedules use weekday names');
     await routineActivities.fill('Weekly strength');
     await routineEditor.getByRole('button',{name:'Save workout plan'}).click();
     assert.equal(await page.getByRole('button',{name:'Complete Weekly strength'}).isVisible(),true,'Weekly routine appears on Today');
     await page.locator('#vigorNav [data-vigor-route="more"]').click();
     await page.locator('#vigorMoreMenu [data-vigor-old="settings"]').click();
     await page.locator('#cycleLength').selectOption('8');
     await page.locator('#vigorNav [data-vigor-route="today"]').click();
     assert.equal(await firstWorkout.getAttribute('aria-pressed'),'true','Switching schedule types preserves workout history');
     await page.locator('#vigorNav [data-vigor-route="more"]').click();
     await page.locator('#vigorMoreMenu [data-vigor-old="couples"]').click();
     assert.equal(await page.locator('#couplePartnerEmail').isVisible(),false,'Invite form stays hidden until chosen');
     assert.equal(await page.locator('#coupleInviteCode').isVisible(),false,'Join form stays hidden until chosen');
     await page.getByText('I have a code',{exact:true}).click();
     assert.equal(await page.locator('#coupleInviteCode').isVisible(),true,'Joining has its own clear entry point');
     await page.getByText('Invite my partner',{exact:true}).click();
     assert.equal(await page.locator('#couplePartnerEmail').isVisible(),true,'Inviting has its own clear entry point');
     await page.locator('#vigorNav [data-vigor-route="journey"]').click();
     await page.locator('#habitHistoryTools > summary').click();
     await page.locator('#habitReflections > summary').click();
     await page.locator('#disciplineWin').fill('I got outdoors.');
     await page.locator('#saveDisciplineReview').click();
     assert.equal(await page.locator('#disciplineReviewFeedback').textContent(),'Reflection saved.');
     assert.equal(await page.evaluate(()=>Object.values(window.vigorCloudBridge.read().discipline.reviews)
       .some(entry=>entry.win==='I got outdoors.')),true,'Reflections still save from Habits');
     const bounds=await page.locator('#vigorNav').boundingBox();
     assert(bounds&&bounds.x>=-1&&bounds.x+bounds.width<=viewport.width+2,'navigation fits screen');
     assert(!errors.some(e=>/Cannot read properties of undefined|SyntaxError|ReferenceError/.test(e)),errors.join('; '));
     console.log('PASS app navigation and screens at '+viewport.width+'x'+viewport.height);
     await context.close();
   }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(err=>{console.error(err);process.exitCode=1;server.close()});
