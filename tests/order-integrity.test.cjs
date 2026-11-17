// Run with: node tests/order-integrity.test.cjs
// Reordering must never attach historical records to the wrong habit.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const from=src.indexOf('function moveHabit(from,to){');
const to=src.indexOf('function renderDaily(){',from);
assert(from>=0&&to>from,'Cannot locate habit reordering logic');
const logic=src.slice(from,to);
new vm.Script(logic);
const create=()=>({
 habitLabels:['Read Bible','Pray','Stretch','Nutrition'],
 activities:[{id:'strength',name:'Strength',target:2},{id:'zone',name:'Zone 2',target:2}],
 completions:[{id:'c1',activityId:'strength',date:'2026-11-16'}],
 discipline:{
  big3:['h:1','w:strength','h:3'],
  settings:{0:{cue:'Before breakfast'},1:{cue:'After waking'},3:{cue:'Before dinner'}},
  minimums:{'2026-11-16':{0:true,3:true},'2026-11-17':{1:true}},
 },
 dailyCheckins:{
  '2026-11-16':{saved:true,habits:[true,false,true,false]},
  '2026-11-17':{saved:true,habits:[false,true,false,true]}
 }
});
let passed=0;
function check(label,fn){fn();console.log('PASS',label);passed++}
const state=create();
const moveHabit=new Function('state',logic+';return moveHabit;')(state);
check('move first habit to last',()=>{
 assert.equal(moveHabit(0,3),true);
 assert.deepEqual(state.habitLabels,['Pray','Stretch','Nutrition','Read Bible']);
});
check('historical full completions follow habit identity',()=>{
 assert.deepEqual(state.dailyCheckins['2026-11-16'].habits,[false,true,false,true]);
 assert.deepEqual(state.dailyCheckins['2026-11-17'].habits,[true,false,true,false]);
});
check('minimum efforts remain linked to correct habits',()=>{
 assert.equal(state.discipline.minimums['2026-11-16'][3],true);
 assert.equal(state.discipline.minimums['2026-11-16'][2],true);
 assert.equal(state.discipline.minimums['2026-11-17'][0],true);
});
check('habit cue configurations follow their habits',()=>{
 assert.equal(state.discipline.settings[3].cue,'Before breakfast');
 assert.equal(state.discipline.settings[0].cue,'After waking');
 assert.equal(state.discipline.settings[2].cue,'Before dinner');
});
check('Big 3 stays pointed to same selected habits',()=>{
 assert.deepEqual(state.discipline.big3,['h:0','w:strength','h:2']);
});
check('workout completion records never change during habit reordering',()=>{
 assert.deepEqual(state.completions,[{id:'c1',activityId:'strength',date:'2026-11-16'}]);
});
check('invalid and same-position moves leave state unchanged',()=>{
 const snapshot=JSON.stringify(state);
 assert.equal(moveHabit(-1,0),false);
 assert.equal(moveHabit(0,99),false);
 assert.equal(moveHabit(2,2),false);
 assert.equal(JSON.stringify(state),snapshot);
});
check('moving a habit back restores original mapping',()=>{
 assert.equal(moveHabit(3,0),true);
 assert.deepEqual(state.habitLabels,['Read Bible','Pray','Stretch','Nutrition']);
 assert.deepEqual(state.dailyCheckins['2026-11-16'].habits,[true,false,true,false]);
 assert.deepEqual(state.discipline.big3,['h:1','w:strength','h:3']);
});
console.log('Passed '+passed+' order integrity checks.');
