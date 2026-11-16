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
const logic = vm.runInNewContext(src.slice(from, to) + '\n({summary,coaching,roadmap,shiftType,suggestedWorkout})');
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
console.log('Adaptive coaching regression checks passed.');
