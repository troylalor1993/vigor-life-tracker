// Run with: node tests/adaptive-coach.test.cjs
// Data-only regression tests for the coaching decision logic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'adaptive-coach.js'), 'utf8');
new vm.Script(src);
const from = src.indexOf(' const iso=');
const to = src.indexOf(' const style=');
assert(from >= 0 && to > from, 'Could not locate the pure coaching functions');
const logic = vm.runInNewContext(src.slice(from, to) + '\n({summary,habitIntelligence,coaching,roadmap,shiftType,suggestedWorkout,workoutReview,progressionGuidance})');
const data = {
  cycleLength:8, anchor:'2026-11-12',
  habitLabels:['Pray','Nutrition'],
  activities:[{name:'Full-body strength'},{name:'Mobility / recovery'}],
  dailyCheckins:{}, discipline:{minimums:{}},
  bodyGoals:{startWeight:370,goalWeight:240},
  measurements:[{date:'2026-11-15',weight:360}]
};
const check = (name, fn) => { fn(); process.stdout.write('PASS ' + name + '\n'); };
check('day shift',()=>assert.equal(logic.shiftType(data,'2026-11-12'),'Day shift'));
check('night shift',()=>assert.equal(logic.shiftType(data,'2026-11-14'),'Night shift'));
check('recovery day',()=>assert.equal(logic.shiftType(data,'2026-11-16'),'Recovery day'));
check('day off',()=>assert.equal(logic.shiftType(data,'2026-11-17'),'Day off'));
check('seven-day routine',()=>assert.equal(logic.shiftType({...data,cycleLength:7},'2026-11-16'),'Flexible daily routine'));
check('neutral advice for missing records',()=>assert.equal(logic.coaching(data,'2026-11-16').rate,null));
check('recovery shift guidance',()=>assert.equal(logic.coaching(data,'2026-11-16').shift,'Recovery day'));
check('available recovery workout',()=>assert.equal(logic.coaching(data,'2026-11-16').workout,'Mobility / recovery'));
check('goal progress',()=>assert.equal(logic.roadmap(data,'2026-11-16').progress,8));
check('numeric value 12 is not low energy',()=>{
 const d={...data,dailyCheckins:{'2026-11-16':{saved:true,habits:[true,false],energy:12}}};
 assert(!logic.coaching(d,'2026-11-16').reason.includes('energy or sleep'));
});
check('explicit low energy',()=>{
 const d={...data,dailyCheckins:{'2026-11-16':{saved:true,habits:[true,false],energy:'low'}}};
 assert(logic.coaching(d,'2026-11-16').reason.includes('energy or sleep'));
});
check('yesterday was intentionally recorded as missed',()=>{
 const d={...data,dailyCheckins:{'2026-11-15':{saved:true,habits:[false,false]}}};
 assert.equal(logic.coaching(d,'2026-11-16').missedYesterday,true);
});
check('blank previous day does not count as failure',()=>{
 const d={...data,dailyCheckins:{}};
 assert.equal(logic.coaching(d,'2026-11-16').missedYesterday,false);
});

const workouts = {
  cycleLength:8, anchor:'2026-11-12',
  activities:[{id:'strength',name:'Full-body strength',target:3},{id:'cardio',name:'Zone 2 cardio',target:2},{id:'fast',name:'36-hour fast',target:1}],
  habitLabels:['Pray'], dailyCheckins:{}, discipline:{minimums:{},workoutMinimums:[]}, completions:[]
};
check('fasting excluded from workout sessions',()=>{
 const r=logic.workoutReview(workouts,'2026-11-16');
 assert.equal(r.target,5);assert.equal(r.items.length,2);
});
check('rotation remaining days',()=>assert.equal(logic.workoutReview(workouts,'2026-11-16').daysRemaining,3));
check('completed sessions and previous rotation',()=>{
 const d={...workouts,completions:[
  {activityId:'strength',date:'2026-11-12'},
  {activityId:'strength',date:'2026-11-14'},
  {activityId:'cardio',date:'2026-11-15'},
  {activityId:'strength',date:'2026-11-04'}
 ]};
 const r=logic.workoutReview(d,'2026-11-16');
 assert.equal(r.completed,3);assert.equal(r.previous,1);
});
check('minimum effort is tracked without inflating full sessions',()=>{
 const d={...workouts,discipline:{minimums:{},workoutMinimums:[{activityId:'cardio',date:'2026-11-16'}]}};
 const r=logic.workoutReview(d,'2026-11-16');
 assert.equal(r.completed,0);assert.equal(r.minimumEfforts,1);
});
check('future dated workout does not inflate totals',()=>{
 const d={...workouts,completions:[{activityId:'strength',date:'2026-11-17'}]};
 assert.equal(logic.workoutReview(d,'2026-11-16').completed,0);
});
check('no automatic adjustment of targets',()=>{
 const before=JSON.stringify(workouts);
 logic.workoutReview(workouts,'2026-11-16');
 assert.equal(JSON.stringify(workouts),before);
});


check('progression recommends rebuilding when no previous workouts exist',()=>{
 const d={...workouts,activities:[{id:'strength',name:'Strength',target:2}]};
 assert.equal(logic.progressionGuidance(d,'2026-11-17').status,'rebuild');
});
check('progression review only after two complete prior rotations',()=>{
 const d={...workouts,activities:[{id:'strength',name:'Strength',target:2}],completions:[
  {activityId:'strength',date:'2026-10-29'},{activityId:'strength',date:'2026-10-30'},
  {activityId:'strength',date:'2026-11-05'},{activityId:'strength',date:'2026-11-06'}]};
 assert.equal(logic.progressionGuidance(d,'2026-11-17').status,'review');
 assert.equal(logic.progressionGuidance({...d,completions:d.completions.slice(2)},'2026-11-17').status,'maintain');
});
check('low-energy recovery guidance takes precedence',()=>{
 const d={...workouts,activities:[{id:'strength',name:'Strength',target:2}],
  dailyCheckins:{'2026-11-17':{energy:'low'}}};
 assert.equal(logic.progressionGuidance(d,'2026-11-17').status,'recover');
});
check('shift-based recovery overrides progression recommendation',()=>{
 const d={...workouts,activities:[{id:'strength',name:'Strength',target:2}]};
 assert.equal(logic.progressionGuidance(d,'2026-11-16').status,'recover');
});
check('minimum-effort sessions do not trigger progression',()=>{
 const d={...workouts,activities:[{id:'strength',name:'Strength',target:2}],completions:[
  {activityId:'strength',date:'2026-10-29'},{activityId:'strength',date:'2026-10-30'},
  {activityId:'strength',date:'2026-11-05'},{activityId:'strength',date:'2026-11-06'}],
  discipline:{minimums:{},workoutMinimums:[{activityId:'strength',date:'2026-11-17'}]}};
 assert.equal(logic.progressionGuidance(d,'2026-11-17').status,'maintain');
});


check('habit priorities favor a configured Big 3 habit',()=>{
 const d={...data,habitLabels:['Read Bible','Pray','Nutrition'],discipline:{minimums:{},restDays:{},settings:{1:{cue:'After waking',minimum:'Pray one minute'}},big3:['h:1']}};
 const x=logic.habitIntelligence(d,'2026-11-16');
 assert.equal(x.chosen.name,'Pray');assert.equal(x.cue,'After waking');
});
check('missed individual habit triggers supportive comeback',()=>{
 const d={...data,habitLabels:['Read Bible','Pray'],dailyCheckins:{'2026-11-15':{saved:true,habits:[true,false]}},discipline:{minimums:{},restDays:{}}};
 assert.equal(logic.habitIntelligence(d,'2026-11-16').missedYesterday,true);
 assert(logic.coaching(d,'2026-11-16').lead.includes('Return to one missed habit'));
});
check('rest days are neither missed nor scored',()=>{
 const d={...data,habitLabels:['Read Bible','Pray'],dailyCheckins:{'2026-11-15':{saved:true,habits:[false,false]}},discipline:{minimums:{},restDays:{'2026-11-15':true}}};
 const x=logic.habitIntelligence(d,'2026-11-16');
 assert.equal(x.missedYesterday,false);assert.equal(x.rate,null);
});
check('unrecorded days are not failures',()=>{
 const d={...data,dailyCheckins:{'2026-11-15':{saved:false,habits:[]}},discipline:{minimums:{},restDays:{}}};
 assert.equal(logic.habitIntelligence(d,'2026-11-16').missedYesterday,false);
});
check('minimum effort counts separately from full habit completion',()=>{
 const d={...data,habitLabels:['Bible','Pray'],dailyCheckins:{'2026-11-15':{saved:true,habits:[true,false]}},discipline:{minimums:{'2026-11-15':{1:true}},restDays:{}}};
 const x=logic.habitIntelligence(d,'2026-11-16');
 assert.equal(x.totalFull,1);assert.equal(x.totalMinimum,1);assert.equal(x.rate,100);
});
check('90 day roadmap prioritizes whole-life habit formation',()=>{
 assert.equal(logic.roadmap(data,'2026-11-16').stages[0].title,'Build the habit foundation');
});

console.log('Adaptive coaching regression checks passed.');
