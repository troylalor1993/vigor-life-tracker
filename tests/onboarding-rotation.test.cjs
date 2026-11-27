// Run: node tests/onboarding-rotation.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function pure(file,start,end,exportName){
 const src=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 new vm.Script(src);
 const a=src.indexOf(start),b=src.indexOf(end);
 assert(a>=0&&b>a,'Could not find pure logic in '+file);
 return vm.runInNewContext(src.slice(a,b)+'\n({'+exportName+'})')[exportName];
}
const onboardingState=pure('onboarding-guide.js',' function onboardingState(', " const anchor=$('transformationCoach')",'onboardingState');
const rotationSummary=pure('rotation-recap.js',' const dateOffset='," const progress=$('panel-progress')",'rotationSummary');
let tests=0;
const check=(title,test)=>{test();console.log('PASS',title);tests++};
const base={habitLabels:['Read','Pray'],activities:[{id:'a',name:'Strength',target:2}],dailyCheckins:{},completions:[],measurements:[],zone2Logs:[],discipline:{setupDone:false,minimums:{},restDays:{},workoutMinimums:[],reviews:{}}};
check('first-time account eligible',()=>assert.equal(onboardingState(base).eligible,true));
check('no account history mutated',()=>{const before=JSON.stringify(base);onboardingState(base);assert.equal(JSON.stringify(base),before)});
check('first-time setup shows incomplete cue stage',()=>assert.equal(onboardingState(base).steps[1].done,false));
check('onboarding stays available until first record',()=>assert.equal(onboardingState({...base,discipline:{...base.discipline,setupDone:true}}).eligible,true));
check('existing habits account not forced through onboarding',()=>assert.equal(onboardingState({...base,dailyCheckins:{'2026-11-15':{saved:true,habits:[false,false]}}}).eligible,false));
check('existing measurement account not forced',()=>assert.equal(onboardingState({...base,measurements:[{date:'2026-11-15',weight:270}]}).eligible,false));
check('existing workout account not forced',()=>assert.equal(onboardingState({...base,completions:[{date:'2026-11-15',activityId:'a'}]}).eligible,false));
check('empty completed rotation is neutral',()=>assert.equal(rotationSummary({...base,cycleLength:8,anchor:'2026-11-12'},'2026-11-16').meaningful,false));
const recorded={...base,cycleLength:8,anchor:'2026-11-12',dailyCheckins:{
 '2026-11-05':{saved:true,habits:[true,false]},
 '2026-11-06':{saved:true,habits:[false,false]},
 '2026-11-07':{saved:false,habits:[true,true]}
 },completions:[{activityId:'a',date:'2026-11-05'}],
 discipline:{...base.discipline,minimums:{'2026-11-06':{1:true}},restDays:{'2026-11-07':true},
   reviews:{'2026-11-04':{win:'Prepared a book',adjustment:'Read after dinner'}}}};
check('most recent completed rotation boundaries',()=>{const x=rotationSummary(recorded,'2026-11-16');assert.equal(x.latest.start,'2026-11-04');assert.equal(x.latest.end,'2026-11-11')});
check('habits and minimums counted separately',()=>{const x=rotationSummary(recorded,'2026-11-16');assert.equal(x.latest.full,1);assert.equal(x.latest.minimum,1)});
check('unrecorded day excluded',()=>assert.equal(rotationSummary(recorded,'2026-11-16').latest.recordedDays,2));
check('rest day reported but not scored',()=>assert.equal(rotationSummary(recorded,'2026-11-16').latest.restDays,1));
check('workout sessions recorded',()=>assert.equal(rotationSummary(recorded,'2026-11-16').latest.workoutSessions,1));
check('historical reflection preserved',()=>assert.equal(rotationSummary(recorded,'2026-11-16').review.win,'Prepared a book'));
check('seven-day rotation supported',()=>{const d={...recorded,cycleLength:7};const x=rotationSummary(d,'2026-11-16');assert.equal(x.length,7);assert.equal(x.latest.end,'2026-11-11')});
check('review function never changes input',()=>{const before=JSON.stringify(recorded);rotationSummary(recorded,'2026-11-16');assert.equal(JSON.stringify(recorded),before)});
console.log('Passed '+tests+' onboarding and rotation checks.');
