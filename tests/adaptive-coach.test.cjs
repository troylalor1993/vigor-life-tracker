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
const logic = vm.runInNewContext(src.slice(from, to) + '\n({summary,coaching,roadmap,shiftType,suggestedWorkout,workoutReview})');
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

console.log('Adaptive coaching regression checks passed.');
